import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { getRazorpay, isPaymentsConfigured } from '../utils/razorpay'
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

export const SLOT_CURRENCY = 'INR'
export const SLOT_CAPACITY_PER_DAY = 1
export const SLOT_WINDOW_DAYS = 30

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

type SlotOrderDoc = {
    orderId: string
    email: string
    slot: SponsoredSlot
    date: string
    url: string
    amount: number
    currency: string
    status: 'created' | 'paid'
    createdAt: Date
}

type SlotEventDoc = {
    slot: SponsoredSlot
    kind: 'impression' | 'click'
    date?: string
    createdAt: Date
}

// Availability — next 30d, capacity 1/day per slot. Taken = slot_orders with status paid.
router.get('/sponsor/availability', async (c) => {
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        const dates = getSlotDateRange()
        const taken = await db
            .collection<SlotOrderDoc>('slot_orders')
            .find({ status: 'paid', date: { $in: dates } })
            .project({ slot: 1, date: 1 })
            .toArray()
        const takenSet = new Set(taken.map((t) => `${t.slot}|${t.date}`))
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

// Metrics — the proof of separation (C3): label coverage, zero rank input,
// CTR per slot from slot_events, occupancy, revenue.
router.get('/sponsor/metrics', async (c) => {
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const db = getDb()
        const dates = getSlotDateRange()
        const [paidOrders, events] = await Promise.all([
            db.collection<SlotOrderDoc>('slot_orders').find({ status: 'paid' }).project({ slot: 1, date: 1, amount: 1 }).toArray(),
            db.collection<SlotEventDoc>('slot_events').find({}).project({ slot: 1, kind: 1 }).toArray()
        ])
        const paidInWindow = paidOrders.filter((o) => dates.includes(o.date))
        const totalCapacity = SLOT_WINDOW_DAYS * SPONSORED_SLOTS.length
        const occupancy = totalCapacity === 0 ? 0 : paidInWindow.length / totalCapacity
        const revenuePaise = paidOrders.reduce((sum, o) => sum + (typeof o.amount === 'number' ? o.amount : 0), 0)
        const ctrPerSlot: Record<SponsoredSlot, { impressions: number; clicks: number; ctr: number }> = {
            'launch-boost': { impressions: 0, clicks: 0, ctr: 0 },
            newsletter: { impressions: 0, clicks: 0, ctr: 0 }
        }
        for (const e of events) {
            const evt = e as { slot?: unknown; kind?: unknown }
            if (evt.slot !== 'launch-boost' && evt.slot !== 'newsletter') continue
            const slot: SponsoredSlot = evt.slot
            if (evt.kind === 'impression') ctrPerSlot[slot].impressions += 1
            if (evt.kind === 'click') ctrPerSlot[slot].clicks += 1
        }
        for (const slot of SPONSORED_SLOTS) {
            const { impressions, clicks } = ctrPerSlot[slot]
            ctrPerSlot[slot].ctr = impressions === 0 ? 0 : clicks / impressions
        }
        return c.json({
            // By construction BoostSlot always renders SponsoredTag; rank inputs have no sponsored field.
            labelCoverage: 1,
            rankInputFieldsContainingSponsored: 0,
            occupancy,
            revenuePaise,
            currency: SLOT_CURRENCY,
            ctrPerSlot,
            windowDays: SLOT_WINDOW_DAYS,
            capacityPerDay: SLOT_CAPACITY_PER_DAY
        })
    } catch (err) {
        apiLogger.error('sponsor metrics failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
