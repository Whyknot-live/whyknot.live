import { Hono } from 'hono'
import { z } from 'zod'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { sendWelcomeEmailIfEnabled } from '../utils/email'
import { connectRedis, rateLimitCheck } from '../utils/redis'

const router = new Hono()

const schema = z.object({
 email: z.string().email()
})

// naive in-memory rate limit per IP (fallback)
const recent = new Map<string, number[]>()
const WINDOW = 60 * 1000 // 1 minute
const MAX_PER_WINDOW = 10

router.post('/waitlist', async (c) => {
 const body = await c.req.json()
 const parsed = schema.safeParse(body)
 if (!parsed.success) return c.json({ error: 'invalid_email' }, 400)

 const env = validateEnv()
 await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
 const db = getDb()

 // rate limit
 const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
 
 // Use Redis rate limiting if configured, otherwise fall back to in-memory
 const useRedis = env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL
 
 if (useRedis) {
 try {
 await connectRedis(env.REDIS_URL)
 const rateLimit = await rateLimitCheck(ip, MAX_PER_WINDOW, 60)
 
 // Add rate limit headers
 c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
 c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
 c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
 
 if (!rateLimit.allowed) {
 return c.json({ error: 'rate_limited' }, 429)
 }
 } catch (redisError) {
 console.error('Redis rate limit error, falling back to in-memory:', redisError)
 // Fall through to in-memory rate limiting
 }
 }
 
 // In-memory rate limiting (fallback or when Redis not configured)
 if (!useRedis) {
 const now = Date.now()
 const hits = recent.get(ip) ?? []
 const filtered = hits.filter((t) => now - t < WINDOW)
 filtered.push(now)
 recent.set(ip, filtered)
 if (filtered.length > MAX_PER_WINDOW) return c.json({ error: 'rate_limited' }, 429)
 }

 try {
 const res = await db.collection('waitlist').insertOne({ email: parsed.data.email, createdAt: new Date() })
 // send optional email (fire-and-forget)
 void sendWelcomeEmailIfEnabled(parsed.data.email)
 return c.json({ ok: true, id: res.insertedId })
 } catch (err: unknown) {
 if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
 return c.json({ error: 'already_exists' }, 409)
 }
 console.error(err)
 return c.json({ error: 'server_error' }, 500)
 }
})

export default router
