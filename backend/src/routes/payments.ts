import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import crypto from 'node:crypto'
import { validateEnv } from '../utils/env'
import { connectMongo, getDb } from '../utils/mongo'
import { getRazorpay, getSubscriptionPlanId, isPaymentsConfigured, PLANS } from '../utils/razorpay'
import { grantEntitlement, getEntitlement, recordPaymentEvent } from '../utils/entitlements'
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
// - Idempotency via X-Razorpay-Event-Id header (at-least-once delivery).
// - Events may arrive out of order (authorized before captured); grant only on captured/order.paid.
// - Must return 2xx within 5s or Razorpay retries with backoff for 24h, then disables + emails alert.
router.post('/payments/webhook', async (c) => {
    const env = validateEnv()
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET ?? ''
    const raw = await c.req.text()
    const signature = c.req.header('x-razorpay-signature') ?? ''
    const eventId = c.req.header('x-razorpay-event-id') ?? ''
    if (webhookSecret) {
        if (!signature || !verifyWebhookSignature(raw, signature, webhookSecret)) {
            apiLogger.warn('webhook signature mismatch')
            return c.json({ error: 'invalid_signature' }, 400)
        }
    } else {
        apiLogger.warn('webhook received without configured secret (dev only)')
    }
    let evt: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; email?: string; notes?: Record<string, string> } }; subscription?: { entity?: { id?: string; notes?: Record<string, string>; status?: string } } } }
    try {
        evt = JSON.parse(raw)
    } catch {
        return c.json({ error: 'invalid_json' }, 400)
    }
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const event = evt.event ?? 'unknown'
    const payment = evt.payload?.payment?.entity
    const subscription = evt.payload?.subscription?.entity
    const paymentId = payment?.id
    const orderId = payment?.order_id
    const email: string | undefined =
        payment?.email ?? payment?.notes?.email ?? subscription?.notes?.email
    const isNew = await recordPaymentEvent({
        eventId: eventId || `${event}:${paymentId ?? subscription?.id ?? Date.now()}`,
        paymentId,
        orderId,
        subscriptionId: subscription?.id,
        type: event,
        status: subscription?.status,
        raw: evt
    })
    if (!isNew) {
        return c.json({ ok: true, deduped: true })
    }
    // payment.authorized arrives before payment.captured and may be out of order — log only.
    // Grant on capture / subscription charge. Never expose internals.
    if ((event === 'payment.captured' || event === 'order.paid') && email) {
        await grantEntitlement({ email, tier: 'verified', razorpayPaymentId: paymentId, razorpayOrderId: orderId })
    }
    if (event === 'subscription.charged' && email && subscription?.id) {
        const plan = (subscription.notes?.plan === 'team' ? 'team' : 'pro') as 'pro' | 'team'
        await grantEntitlement({ email, tier: plan, razorpayPaymentId: paymentId, razorpaySubscriptionId: subscription.id })
    }
    return c.json({ ok: true })
})

export default router
