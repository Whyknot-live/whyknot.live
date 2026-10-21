import { describe, it } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { processWebhook, verifyOrderSignature, verifyWebhookSignature, type WebhookEffects } from '../routes/payments'

describe('Razorpay signatures', () => {
    it('verifies a valid order signature', () => {
        const secret = 'test_secret_123'
        const orderId = 'order_ABC123'
        const paymentId = 'pay_XYZ789'
        const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
        assert.strictEqual(verifyOrderSignature(orderId, paymentId, sig, secret), true)
    })

    it('rejects a tampered order signature', () => {
        assert.strictEqual(verifyOrderSignature('order_A', 'pay_B', 'deadbeef', 'test_secret_123'), false)
    })

    it('verifies a valid webhook signature', () => {
        const secret = 'whsec_test'
        const raw = JSON.stringify({ event: 'payment.captured' })
        const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex')
        assert.strictEqual(verifyWebhookSignature(raw, sig, secret), true)
    })

    it('rejects a wrong webhook signature', () => {
        assert.strictEqual(verifyWebhookSignature('{"a":1}', 'wrong', 'whsec_test'), false)
    })
})

// ---------- Sponsor slot paid flip, driven by the webhook (P1 exit: fill + revenue) ----------

const WEBHOOK_SECRET = 'whsec_test'

const capturedRaw = JSON.stringify({
    event: 'payment.captured',
    payload: {
        payment: {
            entity: {
                id: 'pay_SPOON1',
                order_id: 'spon_ORDER1',
                email: 'maker@example.com',
                amount: 250000,
                currency: 'INR',
                notes: { email: 'maker@example.com', slot: 'launch-boost' }
            }
        }
    }
})
const capturedSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(capturedRaw).digest('hex')

type Recorded = {
    connects: number
    record: unknown[]
    grant: unknown[]
    flip: unknown[]
    deleted: string[]
    warn: string[]
}

// Fake side effects. recordPaymentEvent dedupes by event id, exactly like the
// real payment_events unique key, so redelivery tests behave like production.
// deletePaymentEvent clears that same key, mirroring utils/entitlements.ts.
function makeEffects(seen: Set<string> = new Set()): { effects: WebhookEffects; calls: Recorded } {
    const calls: Recorded = { connects: 0, record: [], grant: [], flip: [], deleted: [], warn: [] }
    const effects: WebhookEffects = {
        connectDb: async () => {
            calls.connects += 1
        },
        recordPaymentEvent: async (input) => {
            calls.record.push(input)
            const key = input.eventId ?? 'no-key'
            if (seen.has(key)) return false
            seen.add(key)
            return true
        },
        grantEntitlement: async (input) => {
            calls.grant.push(input)
        },
        markSlotOrderPaid: async (input) => {
            calls.flip.push(input)
            return true
        },
        deletePaymentEvent: async (key) => {
            calls.deleted.push(key)
            seen.delete(key)
        },
        logWarn: (message) => {
            calls.warn.push(message)
        }
    }
    return { effects, calls }
}

describe('webhook sponsor slot paid flip', () => {
    it('flips exactly once on a valid captured webhook', async () => {
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: capturedRaw,
            signature: capturedSig,
            eventId: 'evt_cap_1',
            secret: WEBHOOK_SECRET,
            effects
        })
        assert.strictEqual(res.status, 200)
        assert.deepStrictEqual(res.body, { ok: true })
        assert.strictEqual(calls.flip.length, 1)
        assert.deepStrictEqual(calls.flip[0], {
            orderId: 'spon_ORDER1',
            amount: 250000,
            currency: 'INR'
        })
        // Entitlement flow keeps working alongside (no behaviour lost).
        assert.strictEqual(calls.grant.length, 1)
        assert.strictEqual(calls.connects, 1)
    })

    it('never flips on an invalid signature (negative control)', async () => {
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: capturedRaw,
            signature: 'deadbeef',
            eventId: 'evt_cap_1',
            secret: WEBHOOK_SECRET,
            effects
        })
        assert.strictEqual(res.status, 400)
        assert.deepStrictEqual(res.body, { error: 'invalid_signature' })
        assert.strictEqual(calls.flip.length, 0)
        assert.strictEqual(calls.record.length, 0)
        assert.strictEqual(calls.grant.length, 0)
        assert.strictEqual(calls.connects, 0)
    })

    it('does not flip twice when Razorpay redelivers the same event', async () => {
        const seen = new Set<string>()
        const first = makeEffects(seen)
        const res1 = await processWebhook({
            rawBody: capturedRaw,
            signature: capturedSig,
            eventId: 'evt_cap_42',
            secret: WEBHOOK_SECRET,
            effects: first.effects
        })
        assert.strictEqual(res1.status, 200)
        const second = makeEffects(seen)
        const res2 = await processWebhook({
            rawBody: capturedRaw,
            signature: capturedSig,
            eventId: 'evt_cap_42',
            secret: WEBHOOK_SECRET,
            effects: second.effects
        })
        assert.strictEqual(res2.status, 200)
        assert.deepStrictEqual(res2.body, { ok: true, deduped: true })
        assert.strictEqual(first.calls.flip.length, 1)
        assert.strictEqual(second.calls.flip.length, 0)
    })

    it('stays log-only on payment.authorized — never flips before capture', async () => {
        const authorizedRaw = JSON.stringify({
            event: 'payment.authorized',
            payload: { payment: { entity: { id: 'pay_A', order_id: 'spon_ORDER1', email: 'a@b.co' } } }
        })
        const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(authorizedRaw).digest('hex')
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: authorizedRaw,
            signature: sig,
            eventId: 'evt_auth_1',
            secret: WEBHOOK_SECRET,
            effects
        })
        assert.strictEqual(res.status, 200)
        assert.strictEqual(calls.record.length, 1)
        assert.strictEqual(calls.grant.length, 0)
        assert.strictEqual(calls.flip.length, 0)
    })

    it('rejects non-JSON bodies even with a valid signature (negative control)', async () => {
        const raw = 'not-json'
        const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: raw,
            signature: sig,
            eventId: 'evt_bad_json',
            secret: WEBHOOK_SECRET,
            effects
        })
        assert.strictEqual(res.status, 400)
        assert.deepStrictEqual(res.body, { error: 'invalid_json' })
        assert.strictEqual(calls.flip.length, 0)
    })
})

// ---------- Fail closed: no RAZORPAY_WEBHOOK_SECRET outside development ----------

describe('webhook refuses unsigned bodies without a configured secret', () => {
    it('refuses an unsigned webhook in a non-development context (negative control)', async () => {
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: capturedRaw,
            signature: '',
            eventId: 'evt_nosec_1',
            secret: '',
            allowUnsigned: false,
            effects
        })
        assert.strictEqual(res.status, 503)
        assert.deepStrictEqual(res.body, { error: 'webhook_not_configured' })
        // Nothing ran: no DB connect, no dedupe key, no grant, no flip.
        assert.strictEqual(calls.connects, 0)
        assert.strictEqual(calls.record.length, 0)
        assert.strictEqual(calls.grant.length, 0)
        assert.strictEqual(calls.flip.length, 0)
        // The warn names the missing env var (no secret values exist to leak).
        assert.ok(calls.warn.some((w) => w.includes('RAZORPAY_WEBHOOK_SECRET')))
    })

    it('keeps the unsigned bypass in development (control)', async () => {
        const { effects, calls } = makeEffects()
        const res = await processWebhook({
            rawBody: capturedRaw,
            signature: '',
            eventId: 'evt_dev_bypass',
            secret: '',
            allowUnsigned: true,
            effects
        })
        assert.strictEqual(res.status, 200)
        assert.deepStrictEqual(res.body, { ok: true })
        assert.strictEqual(calls.flip.length, 1)
        assert.ok(calls.warn.some((w) => w.includes('dev only')))
    })
})

// ---------- Dedupe durability: a failed side effect must be redeliverable ----------

describe('webhook dedupe key is removed when a side effect fails', () => {
    it('clears the key on failure so the retry reprocesses the flip', async () => {
        const seen = new Set<string>()
        const first = makeEffects(seen)
        let flipFails = true
        first.effects.markSlotOrderPaid = async (input) => {
            if (flipFails) throw new Error('flaky effect')
            first.calls.flip.push(input)
            return true
        }
        await assert.rejects(
            processWebhook({
                rawBody: capturedRaw,
                signature: capturedSig,
                eventId: 'evt_cap_fail',
                secret: WEBHOOK_SECRET,
                effects: first.effects
            }),
            /flaky effect/
        )
        // The key was committed, the flip did not run, and the key is now gone.
        assert.strictEqual(first.calls.record.length, 1)
        assert.strictEqual(first.calls.flip.length, 0)
        assert.deepStrictEqual(first.calls.deleted, ['evt_cap_fail'])

        // Razorpay redelivers the same event id: dedupe no longer swallows it.
        flipFails = false
        const second = makeEffects(seen)
        const res = await processWebhook({
            rawBody: capturedRaw,
            signature: capturedSig,
            eventId: 'evt_cap_fail',
            secret: WEBHOOK_SECRET,
            effects: second.effects
        })
        assert.strictEqual(res.status, 200)
        assert.deepStrictEqual(res.body, { ok: true })
        assert.strictEqual(second.calls.flip.length, 1)
        // Entitlement grant replays too — safe because grantEntitlement upserts.
        assert.strictEqual(second.calls.grant.length, 1)
    })
})
