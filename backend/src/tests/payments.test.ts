import { describe, it } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { verifyOrderSignature, verifyWebhookSignature } from '../routes/payments'

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
