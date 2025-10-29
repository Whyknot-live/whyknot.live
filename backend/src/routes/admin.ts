import { Hono } from 'hono'
import { z } from 'zod'
import { sign, verify } from 'hono/jwt'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'

const router = new Hono()

const loginSchema = z.object({
  password: z.string().min(1),
})

// Admin login - verify password and return JWT token
router.post('/admin/login', async (c) => {
  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: 'invalid_request' }, 400)
  }

  const env = validateEnv()
  
  // Check password against env variable
  if (parsed.data.password !== env.ADMIN_PASSWORD) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }

  // Generate JWT token
  const token = await sign(
    {
      sub: 'admin',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    },
    env.ADMIN_JWT_SECRET
  )

  return c.json({ 
    ok: true, 
    token,
    expiresIn: 60 * 60 * 24 // 24 hours in seconds
  })
})

// Middleware to verify admin token
async function verifyAdminToken(c: any, next: any) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  const env = validateEnv()

  try {
    const payload = await verify(token, env.ADMIN_JWT_SECRET)
    
    if (payload.sub !== 'admin') {
      return c.json({ error: 'unauthorized' }, 401)
    }
    
    // Token is valid, proceed
    await next()
  } catch (err) {
    return c.json({ error: 'invalid_token' }, 401)
  }
}

// Get all waitlist users (protected route)
router.get('/admin/waitlist', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    // Get query parameters for pagination
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = parseInt(c.req.query('limit') || '50', 10)
    const skip = (page - 1) * limit

    // Get total count
    const total = await db.collection('waitlist').countDocuments()

    // Get paginated users
    const users = await db
      .collection('waitlist')
      .find()
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .toArray()

    return c.json({
      ok: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('Admin waitlist error:', err)
    return c.json({ error: 'server_error' }, 500)
  }
})

// Get waitlist statistics (protected route)
router.get('/admin/stats', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    const total = await db.collection('waitlist').countDocuments()
    
    // Get signups in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last24h = await db.collection('waitlist').countDocuments({
      createdAt: { $gte: yesterday },
    })

    // Get signups in last 7 days
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const last7days = await db.collection('waitlist').countDocuments({
      createdAt: { $gte: lastWeek },
    })

    // Get interest distribution
    const interestAggregation = await db
      .collection('waitlist')
      .aggregate([
        { $unwind: '$interests' },
        { $group: { _id: '$interests', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray()

    return c.json({
      ok: true,
      stats: {
        total,
        last24h,
        last7days,
        interests: interestAggregation.map((item) => ({
          name: item._id,
          count: item.count,
        })),
      },
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return c.json({ error: 'server_error' }, 500)
  }
})

// Verify token endpoint (to check if token is still valid)
router.get('/admin/verify', verifyAdminToken, async (c) => {
  return c.json({ ok: true, valid: true })
})

export default router
