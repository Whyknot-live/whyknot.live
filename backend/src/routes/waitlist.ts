import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { sendWelcomeEmailIfEnabled } from '../utils/email'
import { connectRedis, rateLimitCheck } from '../utils/redis'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'

const router = new Hono()

const MAX_INTERESTS = 10
const MAX_INTEREST_LENGTH = 48
const MAX_TYPE_LENGTH = 32
const EMAIL_MAX_LENGTH = 254

const schema = z.object({
    email: z.string().email().max(EMAIL_MAX_LENGTH),
    interests: z
        .array(z.string().trim().min(1).max(MAX_INTEREST_LENGTH))
        .max(MAX_INTERESTS)
        .optional(),
    timestamp: z.string().trim().max(64).optional(),
    type: z.string().trim().max(MAX_TYPE_LENGTH).optional()
})

// Local in-memory rate limit state used when Redis is unavailable
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
    // Drop oldest windows to maintain an upper bound
    const entries = Array.from(recent.entries())
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    for (const [ip] of entries) {
        recent.delete(ip)
        if (recent.size <= MAX_TRACKED_IPS) {
            break
        }
    }
}

function applyLocalRateLimit(ip: string, now: number) {
    pruneRecent(now)
    const entry = recent.get(ip)
    if (!entry || entry.expiresAt <= now) {
        recent.set(ip, { count: 1, expiresAt: now + WINDOW })
        return { allowed: true, remaining: MAX_PER_WINDOW - 1, resetAt: now + WINDOW }
    }
    entry.count += 1
    return {
        allowed: entry.count <= MAX_PER_WINDOW,
        remaining: Math.max(0, MAX_PER_WINDOW - entry.count),
        resetAt: entry.expiresAt
    }
}

router.post('/waitlist', async (c) => {
    const body = await c.req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        apiLogger.debug('Invalid waitlist submission', { errors: parsed.error.format() })
        return c.json({ error: 'invalid_email' }, 400)
    }

    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()

    // rate limit
    const ip = getClientAddress(c)

    apiLogger.debug('Processing waitlist submission', { email: parsed.data.email, ip })

    // Use Redis rate limiting if configured, otherwise fall back to in-memory
    const useRedis = env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL

    if (useRedis) {
        try {
            await connectRedis(env.REDIS_URL)
            const rateLimit = await rateLimitCheck(ip, MAX_PER_WINDOW, 60)

            // Add rate limit headers
            c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
            c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
            c.header('X-RateLimit-Reset', String(rateLimit.resetAt))

            if (!rateLimit.allowed) {
                apiLogger.warn('Rate limit exceeded', { ip, endpoint: 'waitlist' })
                return c.json({ error: 'rate_limited' }, 429)
            }
        } catch (redisError) {
            apiLogger.error('Redis rate limit error, falling back to in-memory', {
                error: redisError instanceof Error ? redisError.message : 'Unknown error'
            })
            // Fall through to in-memory rate limiting
        }
    }

    // In-memory rate limiting (fallback or when Redis not configured)
    if (!useRedis) {
        const now = Date.now()
        const localResult = applyLocalRateLimit(ip, now)
        c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
        c.header('X-RateLimit-Remaining', String(localResult.remaining))
        c.header('X-RateLimit-Reset', String(localResult.resetAt))
        if (!localResult.allowed) {
            apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'waitlist' })
            return c.json({ error: 'rate_limited' }, 429)
        }
    }

    try {
        // Prepare document with all data
        const interests = parsed.data.interests ?? []
        let submittedAt: Date | undefined
        if (parsed.data.timestamp) {
            const candidate = new Date(parsed.data.timestamp)
            if (Number.isNaN(candidate.valueOf())) {
                return c.json({ error: 'invalid_timestamp' }, 400)
            }
            submittedAt = candidate
        }
        const document = {
            email: parsed.data.email,
            interests,
            type: parsed.data.type || 'waitlist',
            createdAt: new Date(),
            ...(submittedAt ? { submittedAt } : {})
        }

        const res = await db.collection('waitlist').insertOne(document)

        // Get waitlist position for the email
        const position = await db.collection('waitlist').countDocuments()

        apiLogger.info('Waitlist entry created', {
            email: parsed.data.email,
            position,
            id: res.insertedId.toString()
        })

        // Send optional email with position (fire-and-forget)
        void sendWelcomeEmailIfEnabled(parsed.data.email, position)

        return c.json({ ok: true, id: res.insertedId, position })
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
            apiLogger.debug('Duplicate email attempt', { email: parsed.data.email })
            return c.json({ error: 'already_exists' }, 409)
        }

        // Environment-aware error logging to prevent information disclosure
        apiLogger.error('Waitlist submission error', {
            error: err instanceof Error ? err.message : 'Unknown error',
            code: err && typeof err === 'object' && 'code' in err ? err.code : undefined
        })

        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
