import { describe, it } from 'node:test'
import assert from 'node:assert'
import { z } from 'zod'

// Simple schema validation tests
describe('Waitlist Schema', () => {
 const schema = z.object({ email: z.string().email() })

 it('should accept valid email', () => {
 const result = schema.safeParse({ email: 'test@example.com' })
 assert.strictEqual(result.success, true)
 })

 it('should reject invalid email', () => {
 const result = schema.safeParse({ email: 'not-an-email' })
 assert.strictEqual(result.success, false)
 })

 it('should reject missing email', () => {
 const result = schema.safeParse({})
 assert.strictEqual(result.success, false)
 })
})
