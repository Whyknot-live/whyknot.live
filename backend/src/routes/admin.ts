import { Hono } from 'hono'
import { z } from 'zod'
import { sign, verify } from 'hono/jwt'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Filter } from 'mongodb'
import bcrypt from 'bcrypt'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { getClientAddress } from '../utils/request'
import { authLogger, apiLogger } from '../utils/logger'
import type { NewsletterSubscriberDoc } from './newsletter'
import { getSiteBase } from '../utils/email'

const router = new Hono()

const loginSchema = z.object({
  password: z.string().min(1),
})

const CSV_EXPORT_LIMIT = 5000

function escapeRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }

  const asString = String(value)
  if (asString === '') {
    return '""'
  }

  const escaped = asString.replace(/"/g, '""')
  return `"${escaped}"`
}

// Admin login - verify password and return JWT token
// Apply strict rate limiting: 5 attempts per 15 minutes
router.post('/admin/login',
  async (c, next) => {
    const ip = getClientAddress(c)
    const env = validateEnv()

    authLogger.debug('Admin login attempt', { ip })

    // Use Redis rate limiting if available
    if (env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL) {
      try {
        const { rateLimitCheck, connectRedis } = await import('../utils/redis')
        await connectRedis(env.REDIS_URL)
        const rateLimit = await rateLimitCheck(`admin-login:${ip}`, 5, 900) // 5 attempts per 15 minutes

        c.header('X-RateLimit-Limit', '5')
        c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
        c.header('X-RateLimit-Reset', String(rateLimit.resetAt))

        if (!rateLimit.allowed) {
          authLogger.warn('Admin login rate limit exceeded', { ip })
          return c.json({
            error: 'rate_limited',
            message: 'Too many login attempts. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
          }, 429)
        }
      } catch (error) {
        authLogger.error('Redis rate limit error during admin login', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    await next()
  },
  async (c) => {
    const body = await c.req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      authLogger.debug('Invalid admin login request format')
      return c.json({ error: 'invalid_request' }, 400)
    }

    const env = validateEnv()

    // Combine password with optional pepper for verification
    const pepper = env.ADMIN_PASSWORD_PEPPER ?? ''
    const passwordWithPepper = pepper ? `${parsed.data.password}${pepper}` : parsed.data.password

    // Use bcrypt for secure password comparison (constant-time comparison built-in)
    const isValidPassword = await bcrypt.compare(passwordWithPepper, env.ADMIN_PASSWORD_HASH)

    if (!isValidPassword) {
      const ip = getClientAddress(c)
      authLogger.warn('Failed admin login attempt', { ip })
      return c.json({ error: 'invalid_credentials' }, 401)
    }

    // Generate JWT token
    const token = await sign(
      {
        sub: 'admin',
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      },
      env.ADMIN_JWT_SECRET
    )

    // Set token as HttpOnly cookie for security
    // Use sameSite: 'None' for cross-origin (admin.whyknot.live -> api.whyknot.live)
    // Use sameSite: 'Strict' for localhost (same origin)
    const isProduction = process.env.NODE_ENV === 'production'
    setCookie(c, 'adminToken', token, {
      httpOnly: true,
      secure: isProduction, // Required when sameSite is 'None'
      sameSite: isProduction ? 'None' : 'Strict', // 'None' for cross-origin in prod
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    const ip = getClientAddress(c)
    authLogger.info('Admin login successful', { ip })

    return c.json({
      ok: true,
      expiresIn: 60 * 60 * 24 // 24 hours in seconds
    })
  }
)

// Middleware to verify admin token
async function verifyAdminToken(c: any, next: any) {
  // Read token from HttpOnly cookie
  const token = getCookie(c, 'adminToken')

  if (!token) {
    authLogger.debug('Admin token missing')
    return c.json({ error: 'unauthorized' }, 401)
  }

  const env = validateEnv()

  try {
    const payload = await verify(token, env.ADMIN_JWT_SECRET)

    // Validate expiration explicitly
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      authLogger.debug('Admin token expired')
      return c.json({ error: 'token_expired' }, 401)
    }

    if (payload.sub !== 'admin') {
      authLogger.warn('Invalid admin token subject', { subject: payload.sub })
      return c.json({ error: 'unauthorized' }, 401)
    }

    authLogger.debug('Admin token verified successfully')
    // Token is valid, proceed
    await next()
  } catch (err: any) {
    if (err.name === 'JwtTokenExpired') {
      authLogger.debug('Admin token JWT expired')
      return c.json({ error: 'token_expired' }, 401)
    }
    authLogger.warn('Invalid admin token', { error: err.message })
    return c.json({ error: 'invalid_token' }, 401)
  }
}

type WaitlistDoc = {
  email: string
  interests?: string[]
  createdAt?: Date
  [key: string]: unknown
}

// Get all waitlist users (protected route)
router.get('/admin/waitlist', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
    const limit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 200))
    const skip = (page - 1) * limit
    const search = (c.req.query('search') ?? '').trim()
    const interest = (c.req.query('interest') ?? '').trim()
    const format = (c.req.query('format') ?? 'json').toLowerCase()
    const sortParam = (c.req.query('sort') ?? 'createdAt').trim()
    const orderParam = (c.req.query('order') ?? 'desc').trim()

    const sortField = sortParam === 'email' ? 'email' : 'createdAt'
    const sortDirection = orderParam === 'asc' ? 1 : -1

    apiLogger.debug('Admin waitlist query', { page, limit, search, interest, format, sortField, sortDirection })

    const collection = db.collection<WaitlistDoc>('waitlist')
    const filter: Filter<WaitlistDoc> = {}

    // Ensure search is a string and sanitize for NoSQL injection
    if (search && typeof search === 'string') {
      filter.email = { $regex: escapeRegexFragment(search), $options: 'i' }
    }

    // Ensure interest is a string to prevent NoSQL injection
    if (interest && typeof interest === 'string') {
      filter.interests = interest
    }

    const total = await collection.countDocuments(filter)
    const cursor = collection
      .find(filter)
      .sort({ [sortField]: sortDirection as 1 | -1 })

    if (format === 'csv') {
      const exportLimit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? String(CSV_EXPORT_LIMIT), 10) || CSV_EXPORT_LIMIT, CSV_EXPORT_LIMIT))
      const users = await cursor.limit(exportLimit).toArray()
      const rows: string[] = ['\uFEFF"Position","Email","Interests","Joined"']

      users.forEach((user, index) => {
        const position = index + 1
        const interests = Array.isArray(user.interests) ? user.interests.join('; ') : ''
        const joined = user.createdAt ? new Date(user.createdAt).toISOString() : ''

        rows.push([
          position,
          toCsvField(user.email),
          toCsvField(interests),
          toCsvField(joined),
        ].join(','))
      })

      const csvContent = rows.join('\n')
      const filename = `waitlist-${new Date().toISOString().split('T')[0]}.csv`

      return c.text(csvContent, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
    }

    const users = await cursor.skip(skip).limit(limit).toArray()

    return c.json({
      ok: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        search,
        interest,
        sort: sortField,
        order: sortDirection === 1 ? 'asc' : 'desc',
      },
    })
  } catch (err) {
    // Environment-aware error logging
    apiLogger.error('Admin waitlist fetch error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    return c.json({ error: 'server_error' }, 500)
  }
})

// Get waitlist statistics (protected route)
router.get('/admin/stats', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    apiLogger.debug('Fetching admin stats')

    const total = await db.collection('waitlist').countDocuments()

    // Get signups in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last24h = await db.collection('waitlist').countDocuments({
      createdAt: { $gte: yesterday },
    })

    // Get signups in last 7 days
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const last7days = await db.collection('waitlist').countDocuments({
      createdAt: { $gte: lastWeek },
    })

    // Get interest distribution
    const interestAggregation = await db
      .collection('waitlist')
      .aggregate([
        { $unwind: '$interests' },
        { $group: { _id: '$interests', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray()

    apiLogger.info('Admin stats fetched', { total, last24h, last7days })

    return c.json({
      ok: true,
      stats: {
        total,
        last24h,
        last7days,
        interests: interestAggregation.map((item) => ({
          name: item._id,
          count: item.count,
        })),
      },
    })
  } catch (err) {
    // Environment-aware error logging
    apiLogger.error('Admin stats fetch error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    return c.json({ error: 'server_error' }, 500)
  }
})

// Check auth status gracefully (returns 200 with authenticated boolean, not 401)
// Use this on login page to avoid console errors
router.get('/admin/check', async (c) => {
  const token = getCookie(c, 'adminToken')

  if (!token) {
    return c.json({ ok: true, authenticated: false })
  }

  const env = validateEnv()

  try {
    const payload = await verify(token, env.ADMIN_JWT_SECRET)

    // Validate expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return c.json({ ok: true, authenticated: false })
    }

    if (payload.sub !== 'admin') {
      return c.json({ ok: true, authenticated: false })
    }

    authLogger.debug('Admin auth check: authenticated')
    return c.json({ ok: true, authenticated: true })
  } catch (_err) {
    return c.json({ ok: true, authenticated: false })
  }
})

// Verify token endpoint (to check if token is still valid)
router.get('/admin/verify', verifyAdminToken, async (c) => {
  authLogger.debug('Admin token verification successful')
  return c.json({ ok: true, valid: true })
})

// Logout endpoint - clear the HttpOnly cookie
router.post('/admin/logout', verifyAdminToken, async (c) => {
  const isProduction = process.env.NODE_ENV === 'production'
  deleteCookie(c, 'adminToken', {
    path: '/',
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Strict',
  })
  authLogger.info('Admin logout successful')
  return c.json({ ok: true })
})

type ClaimDoc = {
  claimId: string
  makerHandle: string
  domain: string
  method: string
  status: string
  createdAt?: Date
  reviewedAt?: Date
  [key: string]: unknown
}

// Maker-claim review queue (P1, C2: human review)
router.get('/admin/claims', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()
  try {
    const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
    const limit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 200))
    const skip = (page - 1) * limit
    const search = (c.req.query('search') ?? '').trim()
    const method = (c.req.query('method') ?? '').trim()
    const status = (c.req.query('status') ?? '').trim()
    if (c.req.query('stats') === '1') {
      const [pending, approved, decided] = await Promise.all([
        db.collection<ClaimDoc>('claims').countDocuments({ status: 'pending' }),
        db.collection<ClaimDoc>('claims').countDocuments({ status: 'approved' }),
        db.collection<ClaimDoc>('claims').find({ reviewedAt: { $exists: true }, createdAt: { $exists: true } }).project({ createdAt: 1, reviewedAt: 1 }).toArray()
      ])
      const durs = decided
        .map((d) => new Date(d.reviewedAt as Date).valueOf() - new Date(d.createdAt as Date).valueOf())
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b)
      const medianReviewTimeMs = durs.length === 0 ? null : durs[Math.floor(durs.length / 2)]
      return c.json({ ok: true, stats: { pending, approved, medianReviewTimeMs } })
    }
    const filter: Filter<ClaimDoc> = {}
    if (search) filter.makerHandle = { $regex: escapeRegexFragment(search), $options: 'i' }
    if (method) filter.method = method
    if (status) filter.status = status
    const total = await db.collection<ClaimDoc>('claims').countDocuments(filter)
    const items = await db.collection<ClaimDoc>('claims').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
    return c.json({ ok: true, data: items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } })
  } catch (err) {
    apiLogger.error('Admin claims fetch error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return c.json({ error: 'server_error' }, 500)
  }
})

router.post('/admin/claims/:id', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()
  try {
    const parsed = z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400)
    const res = await db.collection<ClaimDoc>('claims').updateOne(
      { claimId: c.req.param('id'), status: 'pending' },
      { $set: { status: parsed.data.decision, reviewerNote: parsed.data.note ?? null, reviewedAt: new Date() } }
    )
    if (res.matchedCount === 0) return c.json({ error: 'not_found' }, 404)
    return c.json({ ok: true })
  } catch (err) {
    apiLogger.error('Admin claim review error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return c.json({ error: 'server_error' }, 500)
  }
})

type SubmissionDoc = {
  slug: string
  url: string
  name: string
  status: string
  slotDate?: string
  [key: string]: unknown
}

// Submission review queue (P1 submit-flow: approve/request-changes/reject)
router.get('/admin/submissions', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()
  try {
    const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
    const limit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 200))
    const skip = (page - 1) * limit
    const status = (c.req.query('status') ?? '').trim()
    const filter: Filter<SubmissionDoc> = {}
    if (status) filter.status = status
    const total = await db.collection<SubmissionDoc>('submissions').countDocuments(filter)
    const items = await db.collection<SubmissionDoc>('submissions').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
    const queued = await db.collection<SubmissionDoc>('submissions').countDocuments({ status: 'queued' })
    return c.json({ ok: true, data: items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }, queued })
  } catch (err) {
    apiLogger.error('Admin submissions fetch error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return c.json({ error: 'server_error' }, 500)
  }
})

router.post('/admin/submissions/:slug', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()
  try {
    const parsed = z.object({ decision: z.enum(['approved', 'changes_requested', 'rejected']), reason: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400)
    const status = parsed.data.decision === 'approved' ? 'approved' : parsed.data.decision === 'rejected' ? 'rejected' : 'changes_requested'
    const res = await db.collection<SubmissionDoc>('submissions').updateOne(
      { slug: c.req.param('slug') },
      { $set: { status, reviewReason: parsed.data.reason ?? null, reviewedAt: new Date() } }
    )
    if (res.matchedCount === 0) return c.json({ error: 'not_found' }, 404)
    // Note: paid-skip refund on reject is wired when Razorpay refunds land (submit-flow follow-up).
    return c.json({ ok: true, status })
  } catch (err) {
    apiLogger.error('Admin submission review error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return c.json({ error: 'server_error' }, 500)
  }
})

// Newsletter preview/send (P1 newsletter-531; send stays 501 until ESP scale decision)
router.post('/admin/newsletter/preview', verifyAdminToken, async (c) => {
  try {
    const { buildIssueFromContent } = await import('../jobs/send-newsletter')
    const { buildNewsletterHtml, buildNewsletterText } = await import('../templates/newsletter-531')
    const body = await c.req.json().catch(() => null)
    const parsed = z.object({
      rising: z.array(z.object({ name: z.string(), tagline: z.string(), url: z.string(), sponsored: z.boolean().optional() })).length(5),
      deals: z.array(z.object({ name: z.string(), tagline: z.string(), url: z.string(), sponsored: z.boolean().optional() })).length(3),
      underdog: z.object({ name: z.string(), tagline: z.string(), url: z.string() })
    }).safeParse(body)
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400)
    const issue = await buildIssueFromContent(parsed.data.rising, parsed.data.deals, parsed.data.underdog)
    return c.json({ ok: true, html: buildNewsletterHtml(issue), text: buildNewsletterText(issue) })
  } catch (err) {
    apiLogger.error('Newsletter preview error', { error: err instanceof Error ? err.message : 'Unknown error' })
    return c.json({ error: 'server_error' }, 500)
  }
})

router.post('/admin/newsletter/send', verifyAdminToken, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = z.object({
    rising: z.array(z.object({ name: z.string(), tagline: z.string(), url: z.string(), sponsored: z.boolean().optional() })).length(5),
    deals: z.array(z.object({ name: z.string(), tagline: z.string(), url: z.string(), sponsored: z.boolean().optional() })).length(3),
    underdog: z.object({ name: z.string(), tagline: z.string(), url: z.string() }),
    sponsor: z.object({ name: z.string(), tagline: z.string(), url: z.string(), sponsored: z.boolean() }).optional(),
    meta: z.object({ number: z.number().int().optional(), slug: z.string().optional(), subject: z.string().optional(), date: z.string().optional(), intro: z.string().optional() }).optional(),
  }).safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid_request' }, 400)

  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  const { buildIssueFromContent, sendIssueToSubscribers } = await import('../jobs/send-newsletter')
  const { sendNewsletterEmail } = await import('../utils/email')
  const issue = await buildIssueFromContent(
    parsed.data.rising,
    parsed.data.deals,
    parsed.data.underdog,
    parsed.data.sponsor,
    parsed.data.meta ?? {},
  )

  const subs = await db
    .collection<NewsletterSubscriberDoc>('newsletter_subscribers')
    .find({ status: 'confirmed' })
    .toArray()
  const recipients = subs.map((s) => ({ email: s.email, unsubscribeToken: s.unsubscribeToken }))

  const run = await sendIssueToSubscribers({
    issue,
    recipients,
    send: async (to, subject, html, text) => {
      const result = await sendNewsletterEmail({
        to,
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: 'newsletter' },
          { name: 'type', value: 'issue' },
        ],
      })
      return result.ok
    },
    siteBase: getSiteBase(),
  })

  // Record every attempt so sponsor-slot CTR can be split later and a
  // failed send is visible instead of silently dropped.
  const rows = run.attempts.map((a) => ({
    issueSlug: issue.slug,
    email: a.email,
    sentAt: new Date(),
    status: a.ok ? 'sent' : 'failed',
    sponsor: run.sponsor,
    ...(a.ok ? {} : { error: a.error ?? 'send_failed' }),
  }))
  if (rows.length > 0) {
    await db.collection('newsletter_sends').insertMany(rows)
  }

  apiLogger.info('Newsletter issue sent', {
    issue: issue.slug,
    recipients: recipients.length,
    sent: run.sent,
    failed: run.failed,
    sponsor: run.sponsor,
  })
  return c.json({ ok: true, recipients: recipients.length, sent: run.sent, failed: run.failed, sponsor: run.sponsor })
})

export default router
