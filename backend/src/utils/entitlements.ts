import { getDb } from './mongo'

// Entitlements are the source of truth for paid tiers.
// Collections: entitlements, payment_orders, payment_events.

export type Tier = 'verified' | 'pro' | 'team'

export async function grantEntitlement(input: {
    email: string
    tier: Tier
    razorpayPaymentId?: string
    razorpayOrderId?: string
    razorpaySubscriptionId?: string
}) {
    const db = getDb()
    const now = new Date()
    await db.collection('entitlements').updateOne(
        { email: input.email.toLowerCase() },
        {
            $set: {
                email: input.email.toLowerCase(),
                tier: input.tier,
                status: 'active',
                razorpayPaymentId: input.razorpayPaymentId ?? null,
                razorpayOrderId: input.razorpayOrderId ?? null,
                razorpaySubscriptionId: input.razorpaySubscriptionId ?? null,
                updatedAt: now
            },
            $setOnInsert: { createdAt: now }
        },
        { upsert: true }
    )
}

export async function getEntitlement(email: string) {
    const db = getDb()
    return db.collection('entitlements').findOne({ email: email.toLowerCase() })
}

export async function recordPaymentEvent(input: {
    eventId?: string
    paymentId?: string
    orderId?: string
    subscriptionId?: string
    type: string
    status?: string
    raw: unknown
}): Promise<boolean> {
    // Returns false if duplicate (idempotent), true if newly recorded.
    const db = getDb()
    const key = input.eventId ?? `${input.type}:${input.paymentId ?? input.orderId ?? input.subscriptionId ?? Date.now()}`
    try {
        await db.collection('payment_events').insertOne({
            key,
            ...input,
            createdAt: new Date()
        })
        return true
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
            return false
        }
        throw err
    }
}
