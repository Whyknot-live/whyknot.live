import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import crypto from 'node:crypto'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { connectRedis, rateLimitCheck } from '../utils/redis'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'

const router = new Hono()

const EMAIL_MAX_LENGTH = 254
const QUERY_MAX_LENGTH = 200

export const NEWSLETTER_SOURCES = ['footer', 'search-zero', 'archive'] as const
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number]

const subscribeSchema = z.object({
    email: z.string().email().max(EMAIL_MAX_LENGTH),
    source: z.enum(NEWSLETTER_SOURCES),
    query: z.string().trim().max(QUERY_MAX_LENGTH).optional(),
    // Honeypot — legit clients always send empty/missing; bots fill it in.
    company: z.string().max(100).optional(),
})

export type NewsletterSubscribeInput = z.infer<typeof subscribeSchema>

export interface NewsletterSubscriberDoc {
    email: string
    status: 'pending' | 'confirmed' | 'unsubscribed'
    source: NewsletterSource | string
    query?: string
    confirmToken?: string
    unsubscribeToken: string
    consentAt: Date
    ip: string
    createdAt: Date
    confirmedAt?: Date
    unsubscribedAt?: Date
}

/**
 * Pure email check shared with tests. Keeps route + job validation in sync.
 */
export function isValidNewsletterEmail(email: unknown): boolean {
    const result = z.string().email().max(EMAIL_MAX_LENGTH).safeParse(email)
    return result.success
}

/**
 * ESP decision for P1: stay on Resend (see watchlists-alerts.md ESP note —
 * Indian ESP evaluation deferred until scale forces it).
 * Unsubscribe links are HMAC-signed so they work without login.
 * Prefers a dedicated secret, falls back to the admin JWT secret, then dev-only default.
 */
export function getNewsletterUnsubSecret(): string {
    return process.env.NEWSLETTER_UNSUB_SECRET ?? process.env.ADMIN_JWT_SECRET ?? 'dev-newsletter-secret'
}

export function createUnsubscribeToken(email: string, secret: string): string {
    const normalized = email.trim().toLowerCase()
    return crypto.createHmac('sha256', secret).update(normalized).digest('hex')
}

export function verifyUnsubscribeToken(email: string, token: string, secret: string): boolean {
    try {
        const expected = createUnsubscribeToken(email, secret)
        const a = Buffer.from(expected, 'hex')
        const b = Buffer.from(token, 'hex')
        if (a.length !== b.length) return false
        return crypto.timingSafeEqual(a, b)
    } catch {
        return false
    }
}

export function createConfirmToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

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
        resetAt: entry.expiresAt,
    }
}

async function applyRateLimit(c: { header: (k: string, v: string) => void }, ip: string, env: { USE_REDIS_RATE_LIMIT?: string; REDIS_URL?: string }): Promise<{ allowed: boolean }> {
    const useRedis = env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL
    if (useRedis && env.REDIS_URL) {
        try {
            await connectRedis(env.REDIS_URL)
            const rateLimit = await rateLimitCheck(`newsletter:${ip}`, MAX_PER_WINDOW, 60)
            c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
            c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
            c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
            if (!rateLimit.allowed) {
                apiLogger.warn('Rate limit exceeded', { ip, endpoint: 'newsletter-subscribe' })
                return { allowed: false }
            }
            return { allowed: true }
        } catch (redisError) {
            apiLogger.error('Redis rate limit error, falling back to in-memory', {
                error: redisError instanceof Error ? redisError.message : 'Unknown error',
            })
        }
    }
    const now = Date.now()
    const localResult = applyLocalRateLimit(ip, now)
    c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(localResult.remaining))
    c.header('X-RateLimit-Reset', String(localResult.resetAt))
    if (!localResult.allowed) {
        apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'newsletter-subscribe' })
        return { allowed: false }
    }
    return { allowed: true }
}

router.post('/newsletter/subscribe', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
        apiLogger.debug('Invalid newsletter subscription', { errors: parsed.error.format() })
        return c.json({ error: 'invalid_email' }, 400)
    }

    // Honeypot: silently accept so bots learn nothing.
    if (parsed.data.company && parsed.data.company.trim() !== '') {
        apiLogger.debug('Newsletter honeypot triggered')
        return c.json({ ok: true, pending: true })
    }

    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()

    const ip = getClientAddress(c)
    apiLogger.debug('Processing newsletter subscription', { email: parsed.data.email, ip })

    const rate = await applyRateLimit(c, ip, env)
    if (!rate.allowed) {
        return c.json({ error: 'rate_limited' }, 429)
    }

    try {
        const email = parsed.data.email.trim().toLowerCase()
        const confirmToken = createConfirmToken()
        const unsubscribeToken = createUnsubscribeToken(email, getNewsletterUnsubSecret())
        const document: NewsletterSubscriberDoc = {
            email,
            status: 'pending',
            source: parsed.data.source,
            ...(parsed.data.query ? { query: parsed.data.query } : {}),
            confirmToken,
            unsubscribeToken,
            consentAt: new Date(),
            ip,
            createdAt: new Date(),
        }

        const res = await db.collection<NewsletterSubscriberDoc>('newsletter_subscribers').insertOne(document)

        apiLogger.info('Newsletter subscriber created (pending double opt-in)', {
            email,
            source: parsed.data.source,
            id: res.insertedId.toString(),
        })

        // TODO(P1): send double-opt-in confirm email via Resend (stays on Resend
        // for P1; Indian ESP later). Fire-and-forget so API never blocks on mail.
        // Template: backend/src/templates/newsletter-531.ts confirm variant.

        return c.json({ ok: true, pending: true, id: res.insertedId })
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
            apiLogger.debug('Duplicate newsletter attempt', { email: parsed.data.email })
            return c.json({ error: 'already_exists' }, 409)
        }
        apiLogger.error('Newsletter subscription error', {
            error: err instanceof Error ? err.message : 'Unknown error',
            code: err && typeof err === 'object' && 'code' in err ? err.code : undefined,
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

router.get('/newsletter/confirm', async (c) => {
    const token = (c.req.query('token') ?? '').trim()
    if (!token) {
        return c.json({ error: 'missing_token' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()
    try {
        const existing = await db.collection<NewsletterSubscriberDoc>('newsletter_subscribers').findOne({ confirmToken: token })
        if (!existing) {
            return c.json({ error: 'invalid_token' }, 404)
        }
        if (existing.status === 'confirmed') {
            return c.json({ ok: true, already: true })
        }
        await db.collection<NewsletterSubscriberDoc>('newsletter_subscribers').updateOne(
            { confirmToken: token },
            { $set: { status: 'confirmed', confirmedAt: new Date() } },
        )
        apiLogger.info('Newsletter subscription confirmed', { email: existing.email })
        return c.json({ ok: true })
    } catch (err) {
        apiLogger.error('Newsletter confirm error', {
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

router.get('/newsletter/unsubscribe', async (c) => {
    const token = (c.req.query('token') ?? '').trim()
    if (!token) {
        return c.json({ error: 'missing_token' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()
    try {
        // No login required — the HMAC-signed token IS the credential.
        const existing = await db.collection<NewsletterSubscriberDoc>('newsletter_subscribers').findOne({ unsubscribeToken: token })
        if (!existing) {
            return c.json({ error: 'invalid_token' }, 404)
        }
        // Defense in depth: recompute HMAC so forged tokens never match even on lookup collision.
        const secret = getNewsletterUnsubSecret()
        if (!verifyUnsubscribeToken(existing.email, token, secret)) {
            apiLogger.warn('Newsletter unsubscribe token mismatch', { email: existing.email })
            return c.json({ error: 'invalid_token' }, 404)
        }
        if (existing.status === 'unsubscribed') {
            return c.json({ ok: true, already: true })
        }
        await db.collection<NewsletterSubscriberDoc>('newsletter_subscribers').updateOne(
            { unsubscribeToken: token },
            { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } },
        )
        apiLogger.info('Newsletter unsubscribe', { email: existing.email })
        return c.json({ ok: true })
    } catch (err) {
        apiLogger.error('Newsletter unsubscribe error', {
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

router.get('/newsletter/issues', async (c) => {
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()
    try {
        const issues = await db
            .collection('newsletter_issues')
            .find({})
            .sort({ number: -1 })
            .limit(4)
            .toArray()
        // Empty fallback: archive page renders EmptyState + subscribe form when 0.
        return c.json({ ok: true, issues })
    } catch (err) {
        apiLogger.error('Newsletter issues fetch error', {
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
