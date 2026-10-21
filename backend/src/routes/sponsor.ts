import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { getRazorpay, isPaymentsConfigured } from '../utils/razorpay'
import { connectRedis, rateLimitCheck } from '../utils/redis'
import { getClientAddress } from '../utils/request'
import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'
import { apiLogger } from '../utils/logger'

// Sponsored slots (P1): sell attention, never rank (C3). Razorpay-first, INR-only (C1).
// Inventory lives OUTSIDE the ranked grid — BoostSlot renders SponsoredTag and
// rank inputs have no sponsored field (see /legal/methodology#sponsored-metrics).

export const SPONSORED_SLOTS = ['launch-boost', 'newsletter'] as const
export type SponsoredSlot = (typeof SPONSORED_SLOTS)[number]

// TrustMRR-ladder INR shape, stored in paise for Razorpay.
export const SLOT_AMOUNTS_PAISE: Record<SponsoredSlot, number> = {
    'launch-boost': 250000,
    newsletter: 1500000
} as const

// Event kinds CTR is computed from (see /sponsor/metrics).
export const SLOT_EVENT_KINDS = ['impression', 'click'] as const
export type SlotEventKind = (typeof SLOT_EVENT_KINDS)[number]

export const SLOT_CURRENCY = 'INR'
export const SLOT_CAPACITY_PER_DAY = 1
export const SLOT_WINDOW_DAYS = 30

// A checkout in flight holds its date for this long. The order row is created
// before the sponsor pays, so without a hold two sponsors could start paying
// for the same date. The hold is short on purpose: an abandoned checkout must
// not block the date for long (the old unique index blocked it forever).
export const SLOT_PENDING_HOLD_MINUTES = 15
export const SLOT_PENDING_HOLD_MS = SLOT_PENDING_HOLD_MINUTES * 60 * 1000

// True while an unfinished order still holds its date. A row without a usable
// createdAt is treated as expired: an unknown age must never block a date
// forever.
export function isPendingHoldActive(
    doc: { status?: string; createdAt?: Date | string | null },
    now: Date = new Date()
): boolean {
    if (doc.status !== 'created') return false
    if (!doc.createdAt) return false
    const created = doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt)
    const createdMs = created.getTime()
    if (Number.isNaN(createdMs)) return false
    return now.getTime() - createdMs < SLOT_PENDING_HOLD_MS
}

export const ELIGIBILITY_NOTE =
    'Sponsored slots are for listed + screened launches only (Product Hunt rule: never brand-new or unscreened). ' +
    'Sponsorship buys a labeled placement; it cannot change a score, a rank, or a badge.'

export function formatSlotDate(d: Date): string {
    return d.toISOString().slice(0, 10)
}

export function getSlotDateRange(now: Date = new Date()): string[] {
    const startStr = now.toISOString().slice(0, 10)
    const start = new Date(`${startStr}T00:00:00.000Z`)
    const out: string[] = []
    for (let i = 0; i < SLOT_WINDOW_DAYS; i += 1) {
        out.push(new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10))
    }
    return out
}

export function isValidSlotDate(dateStr: string, now: Date = new Date()): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
    const parsed = new Date(`${dateStr}T00:00:00.000Z`)
    if (Number.isNaN(parsed.valueOf())) return false
    // Reject calendar overflow (e.g. 2026-02-30 normalizes to March).
    if (parsed.toISOString().slice(0, 10) !== dateStr) return false
    const todayStr = now.toISOString().slice(0, 10)
    const today = new Date(`${todayStr}T00:00:00.000Z`)
    const max = new Date(today.getTime() + SLOT_WINDOW_DAYS * 86_400_000)
    return parsed >= today && parsed <= max
}

export function isEligibleForSponsorship(input: { listed: boolean; screened: boolean }): boolean {
    return input.listed === true && input.screened === true
}

const router = new Hono()

router.use('*', bodyLimit({ maxSize: 16 * 1024 }))

const emailSchema = z.string().email().max(254)

export type SlotOrderDoc = {
    orderId: string
    email: string
    slot: SponsoredSlot
    date: string
    url: string
    amount: number
    currency: string
    // 'created' = checkout started, 'paid' = the slot is sold, 'conflict' =
    // the sponsor paid but the date was taken first (needs a human decision).
    status: 'created' | 'paid' | 'conflict'
    createdAt: Date
    paidAt?: Date
    conflictAt?: Date
}

export type SlotEventDoc = {
    slot: SponsoredSlot
    kind: SlotEventKind
    date?: string
    createdAt: Date
}

// Minimal structural handle for slot_orders (lets the webhook flip paid in
// payments.ts and lets tests inject a fake store without a Mongo connection).
export interface SlotOrderStore {
    findOne(filter: Record<string, unknown>): Promise<SlotOrderDoc | null>
    updateOne(
        filter: Record<string, unknown>,
        update: Record<string, unknown>
    ): Promise<{ matchedCount: number }>
}

// A captured Razorpay payment for a sponsor order flips its slot_order
// created -> paid (wired from the payments webhook). Idempotent: the update
// only matches status 'created', so redeliveries and concurrent deliveries
// flip exactly once — fill and revenue can never double-count.
// Amount/currency come from the signature-verified webhook payload; a
// mismatch fails closed (log, no flip), mirroring the /payments/verify
// amount_mismatch behaviour.
export async function markSponsorOrderPaid(
    store: SlotOrderStore,
    input: { orderId: string; amount?: number; currency?: string }
): Promise<boolean> {
    const doc = await store.findOne({ orderId: input.orderId })
    // Not a sponsor order (entitlement orders live in payment_orders) — nothing to flip.
    if (!doc) return false
    if (doc.status !== 'created') return false
    if (typeof input.amount === 'number' && input.amount !== doc.amount) {
        apiLogger.warn('sponsor slot payment amount mismatch', { orderId: input.orderId })
        return false
    }
    if (typeof input.currency === 'string' && input.currency !== doc.currency) {
        apiLogger.warn('sponsor slot payment currency mismatch', { orderId: input.orderId })
        return false
    }
    // One paid order per slot+date, enforced by a partial unique index. If
    // another order already owns that date the update is rejected by the
    // database: this sponsor has paid, but the date is gone. Do not grant the
    // slot and do not hide it either — mark the order as a conflict so it is
    // counted in the admin metrics and a human can decide on a refund.
    try {
        const res = await store.updateOne(
            { orderId: input.orderId, status: 'created' },
            { $set: { status: 'paid', paidAt: new Date() } }
        )
        return res.matchedCount === 1
    } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined
        if (code !== 11000) throw err
        apiLogger.error('sponsor slot conflict: the date was already paid for', {
            orderId: input.orderId,
            slot: doc.slot,
            date: doc.date
        })
        await store.updateOne(
            { orderId: input.orderId },
            { $set: { status: 'conflict', conflictAt: new Date() } }
        )
        return false
    }
}
// Availability — next 30d, capacity 1/day per slot.
// Taken = a paid order, or an unfinished checkout still inside its hold
// window. Both are excluded here so this endpoint and the order insert agree
// on what a sponsor can buy (the two used to disagree: availability counted
// paid orders only while the database blocked on every status).
router.get('/sponsor/availability', async (c) => {
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        const dates = getSlotDateRange()
        const holdCutoff = new Date(Date.now() - SLOT_PENDING_HOLD_MS)
        const orders = await db
            .collection<SlotOrderDoc>('slot_orders')
            .find({
                date: { $in: dates },
                $or: [
                    { status: 'paid' },
                    { status: 'created', createdAt: { $gte: holdCutoff } }
                ]
            })
            .project({ slot: 1, date: 1 })
            .toArray()
        const takenSet = new Set(orders.map((t) => `${t.slot}|${t.date}`))
        return c.json({
            currency: SLOT_CURRENCY,
            capacityPerDay: SLOT_CAPACITY_PER_DAY,
            windowDays: SLOT_WINDOW_DAYS,
            amountsPaise: { ...SLOT_AMOUNTS_PAISE },
            days: dates.map((date) => ({
                date,
                slots: {
                    'launch-boost': { available: !takenSet.has(`launch-boost|${date}`), capacity: SLOT_CAPACITY_PER_DAY },
                    newsletter: { available: !takenSet.has(`newsletter|${date}`), capacity: SLOT_CAPACITY_PER_DAY }
                }
            }))
        })
    } catch (err) {
        apiLogger.error('sponsor availability failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

// ---------- Boost-slot campaign read (the static board's beacon gate) ----------
// The launch board is static: <BoostSlot /> cannot know at build time whether a
// sponsor paid for today, so it fetches this endpoint client-side and arms its
// impression/click beacons ONLY when a paid campaign exists. An open slot must
// record nothing, or the first sponsor's CTR is diluted forever (sponsors are
// shown these numbers — C3). Public read, deliberately tiny: slot id + title +
// url only. Never revenue, occupancy, email, or any other order field. Rate
// limiting/CORS/security headers come from the global /api middleware; errors
// stay generic like the other routes in this file.

// Query: optional board date (YYYY-MM-DD inside the 30d window), today by default.
const boostQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

export type BoostCampaignRead = {
    slot: 'launch-boost'
    campaign: { title: string; url: string } | null
}

// The order form collects only email/slot/date/url, so the destination host is
// the honest campaign title (no invented copy). Leading "www." dropped.
export function campaignTitleFromUrl(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

// Pure read shared with tests (store injection, same pattern as
// markSponsorOrderPaid): a paid boost order on `date` -> the campaign, else null.
export async function getActiveBoostCampaign(
    store: Pick<SlotOrderStore, 'findOne'>,
    date: string
): Promise<BoostCampaignRead> {
    const doc = await store.findOne({ slot: 'launch-boost', date, status: 'paid' })
    if (!doc || typeof doc.url !== 'string' || !doc.url) {
        return { slot: 'launch-boost', campaign: null }
    }
    return { slot: 'launch-boost', campaign: { title: campaignTitleFromUrl(doc.url), url: doc.url } }
}

router.get('/sponsor/boost', async (c) => {
    const parsed = boostQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    const date = parsed.data.date ?? formatSlotDate(new Date())
    if (!isValidSlotDate(date)) {
        return c.json({ error: 'invalid_date' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        return c.json(await getActiveBoostCampaign(db.collection<SlotOrderDoc>('slot_orders'), date))
    } catch (err) {
        apiLogger.error('sponsor boost read failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

const orderSchema = z.object({
    email: emailSchema,
    slot: z.enum(SPONSORED_SLOTS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    url: z.string().url().max(2048)
})

router.post('/sponsor/order', async (c) => {
    if (!isPaymentsConfigured()) {
        return c.json({ error: 'payments_not_configured' }, 503)
    }
    const body = await c.req.json().catch(() => null)
    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    if (!isValidSlotDate(parsed.data.date)) {
        return c.json({ error: 'invalid_date' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        const existing = await db.collection<SlotOrderDoc>('slot_orders').findOne({
            slot: parsed.data.slot,
            date: parsed.data.date,
            status: 'paid'
        })
        if (existing) {
            return c.json({ error: 'slot_taken' }, 409)
        }
        // A checkout that is still in flight holds its date. Without this the
        // paid-only unique index would let a second sponsor pay for a date the
        // first one already bought.
        const holdCutoff = new Date(Date.now() - SLOT_PENDING_HOLD_MS)
        const pending = await db.collection<SlotOrderDoc>('slot_orders').findOne({
            slot: parsed.data.slot,
            date: parsed.data.date,
            status: 'created',
            createdAt: { $gte: holdCutoff }
        })
        if (pending) {
            return c.json({ error: 'slot_pending' }, 409)
        }
        const amount = SLOT_AMOUNTS_PAISE[parsed.data.slot]
        const currency = env.RAZORPAY_CURRENCY ?? SLOT_CURRENCY
        const rzp = getRazorpay()
        const receipt = `spon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = await (rzp.orders as any).create({
            amount,
            currency,
            receipt,
            notes: {
                email: parsed.data.email.toLowerCase(),
                slot: parsed.data.slot,
                date: parsed.data.date,
                url: parsed.data.url
            }
        })
        const doc: SlotOrderDoc = {
            orderId: order.id,
            email: parsed.data.email.toLowerCase(),
            slot: parsed.data.slot,
            date: parsed.data.date,
            url: parsed.data.url,
            amount: order.amount,
            currency: order.currency,
            status: 'created',
            createdAt: new Date()
        }
        try {
            await db.collection<SlotOrderDoc>('slot_orders').insertOne(doc)
        } catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
                apiLogger.warn('sponsor slot race (duplicate key)', { slot: parsed.data.slot, date: parsed.data.date })
                return c.json({ error: 'slot_taken' }, 409)
            }
            throw err
        }
        return c.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.RAZORPAY_KEY_ID,
            eligibility: {
                listedAndScreenedRequired: true,
                eligiblePredicate: 'listed && screened',
                note: ELIGIBILITY_NOTE,
                methodology: '/legal/methodology#sponsored-metrics'
            }
        })
    } catch (err) {
        apiLogger.error('sponsor order failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

// ---------- Slot event ingest (CTR input; fields exactly what metrics reads) ----------

const eventSchema = z.object({
    slot: z.enum(SPONSORED_SLOTS),
    kind: z.enum(SLOT_EVENT_KINDS)
})
export type SlotEventInput = z.infer<typeof eventSchema>

// Pure parse shared with tests. Zod strips unknown keys, so a client-supplied
// timestamp (or anything else) can never reach slot_events — server time only.
export function parseSlotEvent(body: unknown): SlotEventInput | null {
    const parsed = eventSchema.safeParse(body)
    return parsed.success ? parsed.data : null
}

export function buildSlotEvent(input: SlotEventInput, now: Date = new Date()): SlotEventDoc {
    return { slot: input.slot, kind: input.kind, createdAt: now }
}

// Per-IP budget for the beacon (mirrors claim.ts/waitlist.ts: Redis when
// configured, in-memory otherwise). Separate from the shared /api limiter so
// impressions cannot starve other API calls from the same visitor.
type LocalRateEntry = { count: number; expiresAt: number }
const recentEvents = new Map<string, LocalRateEntry>()
const EVENT_WINDOW = 60 * 1000 // 1 minute
const EVENT_MAX_PER_WINDOW = 30
const EVENT_MAX_TRACKED_IPS = 1000

function pruneEventRecent(now: number) {
    for (const [key, entry] of recentEvents) {
        if (entry.expiresAt <= now) {
            recentEvents.delete(key)
        }
    }
    if (recentEvents.size <= EVENT_MAX_TRACKED_IPS) {
        return
    }
    const entries = Array.from(recentEvents.entries())
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    for (const [key] of entries) {
        recentEvents.delete(key)
        if (recentEvents.size <= EVENT_MAX_TRACKED_IPS) {
            break
        }
    }
}

async function enforceEventRateLimit(c: Context): Promise<Response | null> {
    const env = validateEnv()
    const ip = getClientAddress(c)
    const key = `sponsor-event:${ip}`
    const useRedis = env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL

    if (useRedis && env.REDIS_URL) {
        try {
            await connectRedis(env.REDIS_URL)
            const rateLimit = await rateLimitCheck(key, EVENT_MAX_PER_WINDOW, 60)
            c.header('X-RateLimit-Limit', String(EVENT_MAX_PER_WINDOW))
            c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
            c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
            if (!rateLimit.allowed) {
                apiLogger.warn('Rate limit exceeded', { ip, endpoint: 'sponsor-event' })
                return c.json({ error: 'rate_limited' }, 429)
            }
            return null
        } catch (redisError) {
            apiLogger.error('Redis rate limit error, falling back to in-memory', {
                error: redisError instanceof Error ? redisError.message : 'Unknown error'
            })
        }
    }

    const now = Date.now()
    pruneEventRecent(now)
    const entry = recentEvents.get(key)
    if (!entry || entry.expiresAt <= now) {
        const resetAt = now + EVENT_WINDOW
        recentEvents.set(key, { count: 1, expiresAt: resetAt })
        c.header('X-RateLimit-Limit', String(EVENT_MAX_PER_WINDOW))
        c.header('X-RateLimit-Remaining', String(EVENT_MAX_PER_WINDOW - 1))
        c.header('X-RateLimit-Reset', String(resetAt))
        return null
    }
    entry.count += 1
    c.header('X-RateLimit-Limit', String(EVENT_MAX_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(Math.max(0, EVENT_MAX_PER_WINDOW - entry.count)))
    c.header('X-RateLimit-Reset', String(entry.expiresAt))
    if (entry.count > EVENT_MAX_PER_WINDOW) {
        apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'sponsor-event' })
        return c.json({ error: 'rate_limited' }, 429)
    }
    return null
}

// POST /sponsor/event — public beacon: records a slot impression or click.
// No PII: slot id + event type only. The timestamp is server time; no client
// input beyond the two enum fields (Zod-validated). Errors stay generic.
router.post('/sponsor/event', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = parseSlotEvent(body)
    if (!parsed) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    const limited = await enforceEventRateLimit(c)
    if (limited) return limited
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        await db.collection<SlotEventDoc>('slot_events').insertOne(buildSlotEvent(parsed))
        return c.json({ ok: true })
    } catch (err) {
        apiLogger.error('sponsor event ingest failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

// Metrics — the proof of separation (C3): label coverage, zero rank input,
// CTR per slot from slot_events, occupancy, revenue.
// Pure computation, shared with tests: given the paid orders and the events
// that A (paid flip) and B (ingest) wrote, every number below is real.

// The fields launch-board ordering actually reads: the stored `rank` (archive
// order) plus the velocity inputs every boost-adjacent board sorts by —
// votes + triple-weighted comments per day live over publishedAt (see
// launchEventVelocity in utils/launch-events.ts, mirrored in the frontend lib).
// This is the single source the C3 proof derives from: /sponsor/metrics counts
// how many of these contain a sponsored string, so a sponsored field leaking
// into ranking flips the metric (and its test) off zero instead of passing.
export const RANK_INPUT_FIELDS = ['rank', 'publishedAt', 'votes', 'comments'] as const

export function countSponsoredRankInputs(rankInputs: readonly string[]): number {
    return rankInputs.filter((field) => /sponsor/i.test(field)).length
}

export function computeSponsorMetrics(input: {
    paidOrders: Array<{ date?: string; amount?: number }>
    events: Array<{ slot?: unknown; kind?: unknown }>
    dates: string[]
    /** Orders that were paid but lost their date to another order. */
    conflictOrders?: Array<{ date?: string }>
    /** Defaults to RANK_INPUT_FIELDS; tests pass realistic/leaked lists. */
    rankInputs?: readonly string[]
}): {
    labelCoverage: number
    rankInputFieldsContainingSponsored: number
    occupancy: number
    revenuePaise: number
    currency: string
    ctrPerSlot: Record<SponsoredSlot, { impressions: number; clicks: number; ctr: number }>
    windowDays: number
    capacityPerDay: number
    conflicts: number
} {
    const { paidOrders, events, dates, conflictOrders, rankInputs } = input
    const paidInWindow = paidOrders.filter((o) => o.date !== undefined && dates.includes(o.date))
    const totalCapacity = SLOT_WINDOW_DAYS * SPONSORED_SLOTS.length
    const occupancy = totalCapacity === 0 ? 0 : paidInWindow.length / totalCapacity
    const revenuePaise = paidOrders.reduce((sum, o) => sum + (typeof o.amount === 'number' ? o.amount : 0), 0)
    const ctrPerSlot: Record<SponsoredSlot, { impressions: number; clicks: number; ctr: number }> = {
        'launch-boost': { impressions: 0, clicks: 0, ctr: 0 },
        newsletter: { impressions: 0, clicks: 0, ctr: 0 }
    }
    for (const evt of events) {
        if (evt.slot !== 'launch-boost' && evt.slot !== 'newsletter') continue
        const slot: SponsoredSlot = evt.slot
        if (evt.kind === 'impression') ctrPerSlot[slot].impressions += 1
        if (evt.kind === 'click') ctrPerSlot[slot].clicks += 1
    }
    for (const slot of SPONSORED_SLOTS) {
        const { impressions, clicks } = ctrPerSlot[slot]
        ctrPerSlot[slot].ctr = impressions === 0 ? 0 : clicks / impressions
    }
    return {
        // Label coverage is 1 by construction: BoostSlot always renders
        // SponsoredTag. sponsor.test.ts guards the component sources themselves
        // (there is no frontend test runner), so this constant is never
        // self-asserted in tests.
        labelCoverage: 1,
        rankInputFieldsContainingSponsored: countSponsoredRankInputs(rankInputs ?? RANK_INPUT_FIELDS),
        occupancy,
        revenuePaise,
        currency: SLOT_CURRENCY,
        ctrPerSlot,
        windowDays: SLOT_WINDOW_DAYS,
        capacityPerDay: SLOT_CAPACITY_PER_DAY,
        // Sponsors are shown these numbers (C3): a paid order that lost its
        // date must be visible, never quietly dropped.
        conflicts: (conflictOrders ?? []).length
    }
}

router.get('/sponsor/metrics', async (c) => {
    // Admin-only: this returns lifetime revenue and CTR, not a public methodology
    // page (see /legal/methodology#sponsored-metrics for the public explanation).
    const token = getCookie(c, 'adminToken')
    if (!token) {
        return c.json({ error: 'unauthorized' }, 401)
    }
    const env = validateEnv()
    try {
        const payload = await verify(token, env.ADMIN_JWT_SECRET)
        if (payload.sub !== 'admin') {
            return c.json({ error: 'unauthorized' }, 401)
        }
    } catch {
        return c.json({ error: 'unauthorized' }, 401)
    }

    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        const dates = getSlotDateRange()
        const [paidOrders, events, conflictOrders] = await Promise.all([
            db.collection<SlotOrderDoc>('slot_orders').find({ status: 'paid' }).project({ slot: 1, date: 1, amount: 1 }).toArray(),
            db.collection<SlotEventDoc>('slot_events').find({}).project({ slot: 1, kind: 1 }).toArray(),
            db.collection<SlotOrderDoc>('slot_orders').find({ status: 'conflict' }).project({ slot: 1, date: 1 }).toArray()
        ])
        return c.json(computeSponsorMetrics({ paidOrders, events, dates, conflictOrders }))
    } catch (err) {
        apiLogger.error('sponsor metrics failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
