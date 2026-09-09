import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import crypto from 'node:crypto'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { connectRedis, rateLimitCheck } from '../utils/redis'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'
import {
  CLAIM_METHODS,
  DOMAIN_RE,
  buildExpectedValue,
  isBlockedHostname,
  normalizeDomain,
  runCheck,
  verificationFilePath,
  type ClaimMethod,
} from '../utils/verify-checks'

const router = new Hono()

const MAKER_HANDLE_RE = /^[A-Za-z0-9_-]{1,64}$/
const CLAIM_ID_RE = /^[0-9a-f]{24}$/
const EMAIL_MAX_LENGTH = 254

export type ClaimStatus = 'pending' | 'verified' | 'failed' | 'approved' | 'rejected'

export type ClaimDoc = {
  claimId: string
  makerHandle: string
  domain: string
  method: ClaimMethod
  ownerEmail: string
  token: string
  status: ClaimStatus
  checkLog: Array<{ at: Date; ok: boolean; detail: string }>
  createdAt: Date
  updatedAt: Date
  reviewedAt?: Date
}

const startSchema = z.object({
  makerHandle: z.string().trim().min(1).max(64).regex(MAKER_HANDLE_RE, 'invalid_handle'),
  domain: z.string().trim().min(1).max(253),
  method: z.enum(CLAIM_METHODS as unknown as [ClaimMethod, ...ClaimMethod[]]),
  ownerEmail: z.string().trim().email().max(EMAIL_MAX_LENGTH),
})

const checkSchema = z.object({
  claimId: z.string().trim().regex(CLAIM_ID_RE, 'invalid_claim_id'),
})

// Local in-memory rate limit state used when Redis is unavailable (mirrors waitlist.ts)
type LocalRateEntry = { count: number; expiresAt: number }
const recent = new Map<string, LocalRateEntry>()
const WINDOW = 60 * 1000 // 1 minute
const MAX_PER_WINDOW = 10
const MAX_TRACKED_IPS = 1000

router.use('*', bodyLimit({ maxSize: 16 * 1024 }))

function pruneRecent(now: number) {
  for (const [ip, entry] of recent) {
    if (entry.expiresAt <= now) {
      recent.delete(ip)
    }
  }
  if (recent.size <= MAX_TRACKED_IPS) {
    return
  }
  const entries = Array.from(recent.entries())
  entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
  for (const [ip] of entries) {
    recent.delete(ip)
    if (recent.size <= MAX_TRACKED_IPS) {
      break
    }
  }
}

async function enforceRateLimit(c: Context): Promise<Response | null> {
  const env = validateEnv()
  const ip = getClientAddress(c)
  const key = `claim:${ip}`
  const useRedis = env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL

  if (useRedis && env.REDIS_URL) {
    try {
      await connectRedis(env.REDIS_URL)
      const rateLimit = await rateLimitCheck(key, MAX_PER_WINDOW, 60)
      c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
      c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
      c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
      if (!rateLimit.allowed) {
        apiLogger.warn('Rate limit exceeded', { ip, endpoint: 'claim' })
        return c.json({ error: 'rate_limited' }, 429)
      }
      return null
    } catch (redisError) {
      apiLogger.error('Redis rate limit error, falling back to in-memory', {
        error: redisError instanceof Error ? redisError.message : 'Unknown error',
      })
    }
  }

  const now = Date.now()
  pruneRecent(now)
  const entry = recent.get(key)
  if (!entry || entry.expiresAt <= now) {
    const resetAt = now + WINDOW
    recent.set(key, { count: 1, expiresAt: resetAt })
    c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(MAX_PER_WINDOW - 1))
    c.header('X-RateLimit-Reset', String(resetAt))
    return null
  }
  entry.count += 1
  c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
  c.header('X-RateLimit-Remaining', String(Math.max(0, MAX_PER_WINDOW - entry.count)))
  c.header('X-RateLimit-Reset', String(entry.expiresAt))
  if (entry.count > MAX_PER_WINDOW) {
    apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'claim' })
    return c.json({ error: 'rate_limited' }, 429)
  }
  return null
}

// POST /api/claim/start — open a claim, mint a verification token.
router.post('/claim/start', async (c) => {
  const limited = await enforceRateLimit(c)
  if (limited) return limited

  const body = await c.req.json().catch(() => null)
  const parsed = startSchema.safeParse(body)
  if (!parsed.success) {
    apiLogger.debug('Invalid claim start submission', { errors: parsed.error.format() })
    return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
  }

  const domain = normalizeDomain(parsed.data.domain)
  if (!domain || !DOMAIN_RE.test(domain)) {
    return c.json({ error: 'invalid_domain' }, 400)
  }
  if (isBlockedHostname(domain)) {
    return c.json({ error: 'blocked_domain' }, 400)
  }
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  const claimId = crypto.randomBytes(12).toString('hex')
  const token = crypto.randomBytes(16).toString('hex')
  const now = new Date()
  const doc: ClaimDoc = {
    claimId,
    makerHandle: parsed.data.makerHandle,
    domain,
    method: parsed.data.method,
    ownerEmail: parsed.data.ownerEmail,
    token,
    status: 'pending',
    checkLog: [],
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.collection<ClaimDoc>('claims').insertOne(doc)
  } catch (err) {
    apiLogger.error('Claim start insert error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return c.json({ error: 'server_error' }, 500)
  }

  apiLogger.info('Claim started', {
    claimId,
    makerHandle: doc.makerHandle,
    domain,
    method: doc.method,
  })

  // TODO: send owner email with the token + instructions via
  // sendClaimVerificationEmail(ownerEmail, { makerHandle, domain, method, token })
  // once the email.ts hook lands (see integrator patch notes).

  return c.json(
    {
      ok: true,
      claimId,
      token,
      method: doc.method,
      domain,
      status: 'pending' as ClaimStatus,
      expected: buildExpectedValue(token),
      filePath: verificationFilePath(token),
    },
    201
  )
})

// POST /api/claim/check — run the live DNS/file/meta check for a pending claim.
router.post('/claim/check', async (c) => {
  const limited = await enforceRateLimit(c)
  if (limited) return limited

  const body = await c.req.json().catch(() => null)
  const parsed = checkSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  const claim = await db.collection<ClaimDoc>('claims').findOne({ claimId: parsed.data.claimId })
  if (!claim) {
    return c.json({ error: 'claim_not_found' }, 404)
  }
  if (claim.status === 'approved' || claim.status === 'rejected') {
    return c.json({ ok: true, verified: claim.status === 'approved', status: claim.status })
  }

  const result = await runCheck(claim.method, claim.domain, claim.token)
  const nextStatus: ClaimStatus = result.ok ? 'verified' : 'failed'
  const now = new Date()

  await db.collection<ClaimDoc>('claims').updateOne(
    { claimId: claim.claimId },
    {
      $set: { status: nextStatus, updatedAt: now },
      $push: { checkLog: { at: now, ok: result.ok, detail: result.detail } },
    }
  )

  apiLogger.info('Claim check completed', {
    claimId: claim.claimId,
    ok: result.ok,
    detail: result.detail,
  })

  return c.json({ ok: true, verified: result.ok, status: nextStatus, detail: result.detail })
})

// GET /api/claim/status?makerHandle= — latest claim status for a profile.
// Never exposes the token or owner email (public endpoint).
router.get('/claim/status', async (c) => {
  const makerHandle = (c.req.query('makerHandle') ?? '').trim()
  if (!makerHandle || !MAKER_HANDLE_RE.test(makerHandle)) {
    return c.json({ error: 'invalid_handle' }, 400)
  }

  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  const latest = await db
    .collection<ClaimDoc>('claims')
    .find({ makerHandle })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()

  const claim = latest[0]
  if (!claim) {
    return c.json({ ok: true, claim: null })
  }

  return c.json({
    ok: true,
    claim: {
      claimId: claim.claimId,
      makerHandle: claim.makerHandle,
      domain: claim.domain,
      method: claim.method,
      status: claim.status,
      updatedAt: claim.updatedAt,
      checks: claim.checkLog.length,
    },
  })
})

export default router
