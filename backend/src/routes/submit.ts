import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'
import {
    signMakerSession,
    verifyMakerSession,
    type MakerSession
} from '../utils/maker-session'
import {
    normalizeUrl,
    slugify,
    TAGLINE_MAX_LENGTH,
    toSlotDateString,
    earliestSlotDate,
    findNextFreeSlot
} from '../utils/submit'

const router = new Hono()

const MAX_TOPICS = 5
const MAX_TOPIC_LENGTH = 48
const MAX_NAME_LENGTH = 120
const MAX_HANDLE_LENGTH = 64
const MAX_STORY_LENGTH = 5000

const topicSchema = z.string().trim().min(1).max(MAX_TOPIC_LENGTH)

const submitSchema = z.object({
    url: z.string().trim().min(1).max(2048),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    tagline: z.string().trim().min(1).max(TAGLINE_MAX_LENGTH),
    topics: z.array(topicSchema).max(MAX_TOPICS).default([]),
    makerHandle: z.string().trim().min(1).max(MAX_HANDLE_LENGTH),
    story: z.string().trim().max(MAX_STORY_LENGTH).optional()
})

const patchSchema = z
    .object({
        name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
        tagline: z.string().trim().min(1).max(TAGLINE_MAX_LENGTH).optional(),
        topics: z.array(topicSchema).max(MAX_TOPICS).optional(),
        story: z.string().trim().max(MAX_STORY_LENGTH).optional()
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'empty_patch' })

// A maker session is minted when a listing is submitted and is scoped to that
// one listing. PATCH requires it, so a listing can only be edited by the maker
// who submitted it. The admin review queue keeps its own route and its own
// admin token (routes/admin.ts), so this does not touch editorial review.
export function makerSessionSecret(env: {
    MAKER_SESSION_SECRET?: string
    ADMIN_JWT_SECRET: string
}): string {
    return env.MAKER_SESSION_SECRET ?? env.ADMIN_JWT_SECRET
}

// Reads the bearer token from the Authorization header.
export function extractBearerToken(header: string | undefined | null): string | null {
    if (!header) return null
    const match = /^Bearer\s+(.+)$/i.exec(header.trim())
    return match ? match[1].trim() : null
}

export type PatchAuthorization =
    | { ok: true; session: MakerSession }
    | { ok: false; status: 401 | 403; error: 'unauthorized' | 'forbidden' }

// Owner-scoped check: the session must belong to THIS submission. A valid
// session for someone else's listing is a 403, not a 401 — the caller proved
// who they are, they are just not the owner of this listing.
export function authorizeSubmissionPatch(input: {
    token: string | null
    session: MakerSession | null
    doc: { slug: string; makerHandle: string }
}): PatchAuthorization {
    if (!input.token || !input.session) {
        return { ok: false, status: 401, error: 'unauthorized' }
    }
    if (input.session.slug !== input.doc.slug) {
        return { ok: false, status: 403, error: 'forbidden' }
    }
    if (input.session.makerHandle !== input.doc.makerHandle) {
        return { ok: false, status: 403, error: 'forbidden' }
    }
    return { ok: true, session: input.session }
}

// Local in-memory rate limit state (mirrors waitlist.ts fallback)
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

function checkRateLimit(c: { header: (k: string, v: string) => void }, ip: string): boolean {
    const now = Date.now()
    pruneRecent(now)
    const entry = recent.get(ip)
    let result: { allowed: boolean; remaining: number; resetAt: number }
    if (!entry || entry.expiresAt <= now) {
        result = { allowed: true, remaining: MAX_PER_WINDOW - 1, resetAt: now + WINDOW }
        recent.set(ip, { count: 1, expiresAt: now + WINDOW })
    } else {
        entry.count += 1
        result = {
            allowed: entry.count <= MAX_PER_WINDOW,
            remaining: Math.max(0, MAX_PER_WINDOW - entry.count),
            resetAt: entry.expiresAt
        }
    }
    c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(result.remaining))
    c.header('X-RateLimit-Reset', String(result.resetAt))
    return result.allowed
}

async function slotCounts(db: ReturnType<typeof getDb>, fromDate: string): Promise<Record<string, number>> {
    const rows = await db
        .collection('submissions')
        .aggregate<{ _id: string; count: number }>([
            { $match: { slotDate: { $gte: fromDate } } },
            { $group: { _id: '$slotDate', count: { $sum: 1 } } }
        ])
        .toArray()
    const counts: Record<string, number> = {}
    for (const row of rows) {
        counts[row._id] = row.count
    }
    return counts
}

function publicView(doc: {
    slug: string
    name: string
    tagline: string
    topics: string[]
    makerHandle: string
    slotDate: string
    status: string
    url: string
}) {
    return {
        slug: doc.slug,
        name: doc.name,
        tagline: doc.tagline,
        topics: doc.topics,
        makerHandle: doc.makerHandle,
        slotDate: doc.slotDate,
        status: doc.status,
        url: doc.url
    }
}

router.post('/submit', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
        apiLogger.debug('Invalid submit payload', { errors: parsed.error.format() })
        return c.json({ error: 'invalid_request' }, 400)
    }

    const ip = getClientAddress(c)
    if (!checkRateLimit(c, ip)) {
        apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'submit' })
        return c.json({ error: 'rate_limited' }, 429)
    }

    let normalized: string
    try {
        normalized = normalizeUrl(parsed.data.url)
    } catch {
        return c.json({ error: 'invalid_url' }, 400)
    }

    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()

    try {
        const existing = await db
            .collection('submissions')
            .findOne({ urlNormalized: normalized.toLowerCase() })
        if (existing) {
            return c.json({ error: 'already_submitted' }, 409)
        }

        // Reserve a permanent slug (never changes after this — SEO URL from day one).
        const base = slugify(parsed.data.name) || 'launch'
        let slug = base
        for (let attempt = 2; ; attempt++) {
            const clash = await db.collection('submissions').findOne({ slug })
            if (!clash) {
                break
            }
            slug = `${base}-${attempt}`
        }

        // Auto-assign the next free launch day.
        const today = toSlotDateString(new Date())
        const counts = await slotCounts(db, today)
        const slotDate = findNextFreeSlot(counts, earliestSlotDate(), 90)
        if (!slotDate) {
            return c.json({ error: 'no_slots' }, 503)
        }

        const now = new Date()
        await db.collection('submissions').insertOne({
            url: normalized,
            urlNormalized: normalized.toLowerCase(),
            name: parsed.data.name,
            slug,
            tagline: parsed.data.tagline,
            topics: parsed.data.topics,
            makerHandle: parsed.data.makerHandle,
            story: parsed.data.story ?? '',
            status: 'queued',
            slotDate,
            createdAt: now,
            updatedAt: now
        })

        apiLogger.info('Submission queued', { slug, slotDate, ip })

        // The maker session is handed to the maker, not stored: it is the only
        // credential that can edit this listing later.
        const editToken = await signMakerSession(
            { slug, makerHandle: parsed.data.makerHandle },
            makerSessionSecret(env)
        )

        return c.json({ slug, slotDate, url: `/launches/${slug}`, editToken }, 201)
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
            return c.json({ error: 'already_submitted' }, 409)
        }
        apiLogger.error('Submit failed', {
            error: err instanceof Error ? err.message : 'Unknown error'
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

router.get('/submissions/:slug', async (c) => {
    const slug = c.req.param('slug')
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()
    try {
        const doc = await db.collection('submissions').findOne({ slug })
        if (!doc) {
            return c.json({ error: 'not_found' }, 404)
        }
        const view = publicView({
            slug: String(doc.slug),
            name: String(doc.name),
            tagline: String(doc.tagline),
            topics: Array.isArray(doc.topics) ? doc.topics.map(String) : [],
            makerHandle: String(doc.makerHandle),
            slotDate: String(doc.slotDate),
            status: String(doc.status),
            url: String(doc.url)
        })
        // The maker story is only shown to the maker who submitted it. A valid
        // maker session for THIS listing unlocks it; everyone else gets the
        // public view, so the edit form can never wipe a story it never read.
        const token = extractBearerToken(c.req.header('Authorization'))
        const session = token ? await verifyMakerSession(token, makerSessionSecret(env)) : null
        if (session && session.slug === view.slug && session.makerHandle === view.makerHandle) {
            return c.json({ ...view, story: String(doc.story ?? '') })
        }
        return c.json(view)
    } catch (err) {
        apiLogger.error('Submission fetch failed', {
            error: err instanceof Error ? err.message : 'Unknown error'
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

router.patch('/submissions/:slug', async (c) => {
    const slug = c.req.param('slug')
    const body = await c.req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }

    const ip = getClientAddress(c)
    if (!checkRateLimit(c, ip)) {
        apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'submission-patch' })
        return c.json({ error: 'rate_limited' }, 429)
    }

    const env = validateEnv()

    // Authenticate BEFORE any database work: an unauthenticated caller gets a
    // 401 without the request ever reaching Mongo.
    const token = extractBearerToken(c.req.header('Authorization'))
    const session = token ? await verifyMakerSession(token, makerSessionSecret(env)) : null
    if (!token || !session) {
        apiLogger.warn('Submission patch without a valid maker session', { ip, slug })
        return c.json({ error: 'unauthorized' }, 401)
    }

    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()

    try {
        const doc = await db.collection('submissions').findOne({ slug })
        if (!doc) {
            return c.json({ error: 'not_found' }, 404)
        }
        const authz = authorizeSubmissionPatch({
            token,
            session,
            doc: { slug: String(doc.slug), makerHandle: String(doc.makerHandle) }
        })
        if (!authz.ok) {
            apiLogger.warn('Submission patch by a non-owner maker session', { ip, slug })
            return c.json({ error: authz.error }, authz.status)
        }
        if (doc.status !== 'queued') {
            return c.json({ error: 'locked' }, 409)
        }
        const update: Record<string, unknown> = { updatedAt: new Date() }
        if (parsed.data.name !== undefined) {
            update.name = parsed.data.name
        }
        if (parsed.data.tagline !== undefined) {
            update.tagline = parsed.data.tagline
        }
        if (parsed.data.topics !== undefined) {
            update.topics = parsed.data.topics
        }
        if (parsed.data.story !== undefined) {
            update.story = parsed.data.story
        }
        await db.collection('submissions').updateOne({ slug }, { $set: update })
        const next = await db.collection('submissions').findOne({ slug })
        if (!next) {
            return c.json({ error: 'server_error' }, 500)
        }
        return c.json(
            publicView({
                slug: String(next.slug),
                name: String(next.name),
                tagline: String(next.tagline),
                topics: Array.isArray(next.topics) ? next.topics.map(String) : [],
                makerHandle: String(next.makerHandle),
                slotDate: String(next.slotDate),
                status: String(next.status),
                url: String(next.url)
            })
        )
    } catch (err) {
        apiLogger.error('Submission patch failed', {
            error: err instanceof Error ? err.message : 'Unknown error'
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
