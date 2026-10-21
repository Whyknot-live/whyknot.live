import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import crypto from 'node:crypto'
import { validateEnv } from '../utils/env'
import { connectMongo, getDb } from '../utils/mongo'
import { getRazorpay, getSubscriptionPlanId, isPaymentsConfigured, PLANS } from '../utils/razorpay'
import { deletePaymentEvent, grantEntitlement, getEntitlement, recordPaymentEvent } from '../utils/entitlements'
import { markSponsorOrderPaid, type SlotOrderDoc } from './sponsor'
import { apiLogger } from '../utils/logger'

const router = new Hono()

router.use('*', bodyLimit({ maxSize: 16 * 1024 }))

const emailSchema = z.string().email().max(254)

function timingSafeEqualHex(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
}

export function verifyOrderSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
    return timingSafeEqualHex(expected, signature)
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    return timingSafeEqualHex(expected, signature)
}

// Public config — keyId only, never the secret.
router.get('/payments/config', (c) => {
    const env = validateEnv()
    return c.json({
        configured: isPaymentsConfigured(),
        keyId: env.RAZORPAY_KEY_ID ?? '',
        currency: env.RAZORPAY_CURRENCY ?? 'INR',
        verifiedAmountPaise: PLANS.verified.amountPaise,
        proPlanConfigured: Boolean(env.RAZORPAY_PLAN_PRO_ID),
        teamPlanConfigured: Boolean(env.RAZORPAY_PLAN_TEAM_ID)
    })
})

const createOrderSchema = z.object({
    email: emailSchema,
    plan: z.literal('verified')
})

router.post('/payments/create-order', async (c) => {
    if (!isPaymentsConfigured()) {
        return c.json({ error: 'payments_not_configured' }, 503)
    }
    const body = await c.req.json().catch(() => null)
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const rzp = getRazorpay()
        const currency = env.RAZORPAY_CURRENCY ?? 'INR'
        const receipt = `vrf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = await (rzp.orders as any).create({
            amount: PLANS.verified.amountPaise,
            currency,
            receipt,
            notes: { email: parsed.data.email.toLowerCase(), plan: 'verified' }
        })
        const db = getDb()
        await db.collection('payment_orders').insertOne({
            orderId: order.id,
            email: parsed.data.email.toLowerCase(),
            plan: 'verified',
            amount: order.amount,
            currency: order.currency,
            status: 'created',
            createdAt: new Date()
        })
        return c.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.RAZORPAY_KEY_ID
        })
    } catch (err) {
        apiLogger.error('create-order failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

const createSubSchema = z.object({
    email: emailSchema,
    plan: z.enum(['pro', 'team'])
})

router.post('/payments/create-subscription', async (c) => {
    if (!isPaymentsConfigured()) {
        return c.json({ error: 'payments_not_configured' }, 503)
    }
    const body = await c.req.json().catch(() => null)
    const parsed = createSubSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    const planId = getSubscriptionPlanId(parsed.data.plan)
    if (!planId) {
        return c.json({ error: 'subscription_plan_not_configured' }, 501)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    try {
        const rzp = getRazorpay()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = await (rzp.subscriptions as any).create({
            plan_id: planId,
            customer_notify: 1,
            notes: { email: parsed.data.email.toLowerCase(), plan: parsed.data.plan }
        })
        const db = getDb()
        await db.collection('subscriptions').insertOne({
            subscriptionId: sub.id,
            email: parsed.data.email.toLowerCase(),
            plan: parsed.data.plan,
            status: sub.status ?? 'created',
            createdAt: new Date()
        })
        return c.json({ subscriptionId: sub.id, keyId: env.RAZORPAY_KEY_ID })
    } catch (err) {
        apiLogger.error('create-subscription failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

const verifySchema = z.object({
    email: emailSchema,
    plan: z.enum(['verified', 'pro', 'team']),
    razorpay_order_id: z.string().min(1).optional(),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    razorpay_subscription_id: z.string().min(1).optional()
})

router.post('/payments/verify', async (c) => {
    if (!isPaymentsConfigured()) {
        return c.json({ error: 'payments_not_configured' }, 503)
    }
    const body = await c.req.json().catch(() => null)
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }
    const env = validateEnv()
    const secret = env.RAZORPAY_KEY_SECRET ?? ''
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_subscription_id } = parsed.data
    // Per Razorpay docs (Integration Steps → Verify Payment Signature):
    // HMAC-SHA256(order_id|payment_id, key_secret). order_id must be the
    // server-created order — re-fetch it below and check amount, never trust checkout.
    // Subscriptions: HMAC-SHA256(payment_id|subscription_id, key_secret).
    let ok = false
    if (razorpay_order_id) {
        ok = verifyOrderSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret)
    } else if (razorpay_subscription_id) {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex')
        ok = timingSafeEqualHex(expected, razorpay_signature)
    }
    if (!ok) {
        apiLogger.warn('payment verify signature mismatch', { email: parsed.data.email })
        return c.json({ error: 'invalid_signature' }, 400)
    }
    // Server-side order check: order must exist and match the plan amount.
    if (razorpay_order_id && parsed.data.plan === 'verified') {
        try {
            const rzp = getRazorpay()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const order = await (rzp.orders as any).fetch(razorpay_order_id)
            if (order?.amount !== PLANS.verified.amountPaise || order?.currency !== (env.RAZORPAY_CURRENCY ?? 'INR')) {
                apiLogger.warn('payment verify amount mismatch', { orderId: razorpay_order_id })
                return c.json({ error: 'amount_mismatch' }, 400)
            }
        } catch (err) {
            apiLogger.error('payment verify order fetch failed', { error: err instanceof Error ? err.message : 'Unknown' })
            return c.json({ error: 'server_error' }, 500)
        }
    }
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const isNew = await recordPaymentEvent({
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        subscriptionId: razorpay_subscription_id,
        type: 'verify',
        status: 'verified',
        raw: { email: parsed.data.email, plan: parsed.data.plan }
    })
    if (isNew) {
        await grantEntitlement({
            email: parsed.data.email,
            tier: parsed.data.plan,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySubscriptionId: razorpay_subscription_id
        })
    }
    return c.json({ ok: true })
})

router.get('/payments/status', async (c) => {
    const email = c.req.query('email') ?? ''
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
        return c.json({ error: 'invalid_email' }, 400)
    }
    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const ent = await getEntitlement(parsed.data)
    if (!ent) return c.json({ tier: null, status: 'none' })
    return c.json({ tier: ent.tier, status: ent.status, updatedAt: ent.updatedAt })
})

// Webhook — per Razorpay docs (Validate and Test Webhooks + Best Practices):
// - Read the RAW body for HMAC (never JSON.parse then re-stringify).
// - Verify X-Razorpay-Signature = HMAC-SHA256(rawBody, webhookSecret).
// - Fail closed: with no RAZORPAY_WEBHOOK_SECRET configured, an unsigned body is
//   refused outside development — this endpoint flips money (entitlements +
//   sponsor slot orders), so it must never process unverifiable input.
// - Idempotency via X-Razorpay-Event-Id header (at-least-once delivery).
// - Events may arrive out of order (authorized before captured); grant only on captured/order.paid.
// - Must return 2xx within 5s or Razorpay retries with backoff for 24h, then disables + emails alert.
// - If a side effect fails after the dedupe key was written, the key is removed
//   before the error returns so Razorpay's retry reprocesses instead of
//   deduping past the failure (both effects are idempotent).
// processWebhook() holds that exact flow with injected side effects so tests
// can prove the sponsor paid flip fires once on a valid captured event,
// never on a bad signature or an unverifiable body, without a Mongo/Razorpay
// connection.

type WebhookEventPayload = {
    payment?: {
        entity?: {
            id?: string
            order_id?: string
            email?: string
            // Signed payload fields read for the sponsor slot flip only.
            amount?: number
            currency?: string
            notes?: Record<string, string>
        }
    }
    subscription?: { entity?: { id?: string; notes?: Record<string, string>; status?: string } }
}
type WebhookEvent = { event?: string; payload?: WebhookEventPayload }

export type WebhookEffects = {
    connectDb: () => Promise<unknown>
    recordPaymentEvent: (input: {
        eventId?: string
        paymentId?: string
        orderId?: string
        subscriptionId?: string
        type: string
        status?: string
        raw: unknown
    }) => Promise<boolean>
    grantEntitlement: (input: {
        email: string
        tier: 'verified' | 'pro' | 'team'
        razorpayPaymentId?: string
        razorpayOrderId?: string
        razorpaySubscriptionId?: string
    }) => Promise<unknown>
    // Marks the matching slot_orders row paid (no-op for entitlement orders).
    markSlotOrderPaid: (input: { orderId: string; amount?: number; currency?: string }) => Promise<unknown>
    // Removes the payment_events dedupe key so a redelivery reprocesses after a
    // failed side effect (idempotent effects make the replay safe).
    deletePaymentEvent: (key: string) => Promise<unknown>
    logWarn: (message: string, meta?: Record<string, unknown>) => void
}

export type WebhookResult = { status: 200 | 400 | 500 | 503; body: Record<string, unknown> }

export async function processWebhook(input: {
    rawBody: string
    signature: string
    eventId: string
    secret: string
    /** Only true in development (NODE_ENV); the sole path that may run unsigned. */
    allowUnsigned?: boolean
    effects: WebhookEffects
}): Promise<WebhookResult> {
    const { rawBody, signature, eventId, secret, allowUnsigned = false, effects } = input
    // Fail closed first: without a configured secret nothing can be verified, so
    // refuse (generic error, warn names the missing env var — never a secret).
    // Development keeps the unsigned bypass for local tests and the Razorpay CLI.
    if (!secret && !allowUnsigned) {
        effects.logWarn('webhook refused: RAZORPAY_WEBHOOK_SECRET is not configured (non-development runtime)')
        return { status: 503, body: { error: 'webhook_not_configured' } }
    }
    if (secret) {
        if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
            effects.logWarn('webhook signature mismatch')
            return { status: 400, body: { error: 'invalid_signature' } }
        }
    } else {
        effects.logWarn('webhook received without configured secret (dev only)')
    }
    let evt: WebhookEvent
    try {
        evt = JSON.parse(rawBody)
    } catch {
        return { status: 400, body: { error: 'invalid_json' } }
    }
    await effects.connectDb()
    const event = evt.event ?? 'unknown'
    const payment = evt.payload?.payment?.entity
    const subscription = evt.payload?.subscription?.entity
    const paymentId = payment?.id
    const orderId = payment?.order_id
    const email: string | undefined =
        payment?.email ?? payment?.notes?.email ?? subscription?.notes?.email
    // One dedupe key, used both to record and (on a failed side effect) to clear.
    const dedupeKey = eventId || `${event}:${paymentId ?? subscription?.id ?? Date.now()}`
    const isNew = await effects.recordPaymentEvent({
        eventId: dedupeKey,
        paymentId,
        orderId,
        subscriptionId: subscription?.id,
        type: event,
        status: subscription?.status,
        raw: evt
    })
    if (!isNew) {
        return { status: 200, body: { ok: true, deduped: true } }
    }
    try {
        // payment.authorized arrives before payment.captured and may be out of order — log only.
        // Grant on capture / subscription charge. Never expose internals.
        if ((event === 'payment.captured' || event === 'order.paid') && email) {
            await effects.grantEntitlement({ email, tier: 'verified', razorpayPaymentId: paymentId, razorpayOrderId: orderId })
        }
        if (event === 'subscription.charged' && email && subscription?.id) {
            const plan = (subscription.notes?.plan === 'team' ? 'team' : 'pro') as 'pro' | 'team'
            await effects.grantEntitlement({ email, tier: plan, razorpayPaymentId: paymentId, razorpaySubscriptionId: subscription.id })
        }
        // Sponsor inventory: the same captured payment flips slot_orders created -> paid
        // (idempotent inside), so /sponsor/metrics occupancy and revenue read real numbers.
        if ((event === 'payment.captured' || event === 'order.paid') && orderId) {
            await effects.markSlotOrderPaid({ orderId, amount: payment?.amount, currency: payment?.currency })
        }
    } catch (err) {
        // The dedupe key was committed BEFORE the side effects, so returning the
        // error as-is would let Razorpay's retry hit the dedupe and skip the
        // effect forever (a paid slot stuck at 'created'). Remove the key first:
        // redelivery then reprocesses, and both effects are idempotent
        // (grantEntitlement upserts, markSponsorOrderPaid only flips 'created').
        // Cleanup is best-effort: the original failure still surfaces as 500.
        try {
            await effects.deletePaymentEvent(dedupeKey)
        } catch {
            effects.logWarn('webhook dedupe key cleanup failed')
        }
        throw err
    }
    return { status: 200, body: { ok: true } }
}

router.post('/payments/webhook', async (c) => {
    const env = validateEnv()
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET ?? ''
    const raw = await c.req.text()
    const signature = c.req.header('x-razorpay-signature') ?? ''
    const eventId = c.req.header('x-razorpay-event-id') ?? ''
    try {
        const result = await processWebhook({
            rawBody: raw,
            signature,
            eventId,
            secret: webhookSecret,
            // Development keeps the unsigned bypass (local tests, Razorpay CLI);
            // every other runtime refuses an unverifiable webhook (fail closed).
            allowUnsigned: process.env.NODE_ENV === 'development',
            effects: {
                connectDb: () => connectMongo(env.MONGODB_URI, env.MONGODB_DB),
                recordPaymentEvent,
                grantEntitlement,
                markSlotOrderPaid: (input) =>
                    markSponsorOrderPaid(getDb().collection<SlotOrderDoc>('slot_orders'), input),
                deletePaymentEvent,
                logWarn: (message, meta) => apiLogger.warn(message, meta)
            }
        })
        return c.json(result.body, result.status)
    } catch (err) {
        // Side effects failed after signature checks — generic client error, detail in logs only.
        apiLogger.error('webhook processing failed', { error: err instanceof Error ? err.message : 'Unknown' })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
