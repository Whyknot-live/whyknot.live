import { Hono } from 'hono'
import { z } from 'zod'
import { sign, verify } from 'hono/jwt'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Filter } from 'mongodb'
import bcrypt from 'bcrypt'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { getClientAddress } from '../utils/request'
import { authLogger, apiLogger } from '../utils/logger'

const router = new Hono()

const loginSchema = z.object({
  password: z.string().min(1),
})

const CSV_EXPORT_LIMIT = 5000

function escapeRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }

  const asString = String(value)
  if (asString === '') {
    return '""'
  }

  const escaped = asString.replace(/"/g, '""')
  return `"${escaped}"`
}

// Admin login - verify password and return JWT token
// Apply strict rate limiting: 5 attempts per 15 minutes
router.post('/admin/login',
  async (c, next) => {
    const ip = getClientAddress(c)
    const env = validateEnv()

    authLogger.debug('Admin login attempt', { ip })

    // Use Redis rate limiting if available
    if (env.USE_REDIS_RATE_LIMIT === '1' && env.REDIS_URL) {
      try {
        const { rateLimitCheck, connectRedis } = await import('../utils/redis')
        await connectRedis(env.REDIS_URL)
        const rateLimit = await rateLimitCheck(`admin-login:${ip}`, 5, 900) // 5 attempts per 15 minutes

        c.header('X-RateLimit-Limit', '5')
        c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
        c.header('X-RateLimit-Reset', String(rateLimit.resetAt))

        if (!rateLimit.allowed) {
          authLogger.warn('Admin login rate limit exceeded', { ip })
          return c.json({
            error: 'rate_limited',
            message: 'Too many login attempts. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
          }, 429)
        }
      } catch (error) {
        authLogger.error('Redis rate limit error during admin login', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    await next()
  },
  async (c) => {
    const body = await c.req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      authLogger.debug('Invalid admin login request format')
      return c.json({ error: 'invalid_request' }, 400)
    }

    const env = validateEnv()

    // Combine password with optional pepper for verification
    const pepper = env.ADMIN_PASSWORD_PEPPER ?? ''
    const passwordWithPepper = pepper ? `${parsed.data.password}${pepper}` : parsed.data.password

    // Use bcrypt for secure password comparison (constant-time comparison built-in)
    const isValidPassword = await bcrypt.compare(passwordWithPepper, env.ADMIN_PASSWORD_HASH)

    if (!isValidPassword) {
      const ip = getClientAddress(c)
      authLogger.warn('Failed admin login attempt', { ip })
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

    // Set token as HttpOnly cookie for security
    setCookie(c, 'adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    const ip = getClientAddress(c)
    authLogger.info('Admin login successful', { ip })

    return c.json({
      ok: true,
      expiresIn: 60 * 60 * 24 // 24 hours in seconds
    })
  }
)

// Middleware to verify admin token
async function verifyAdminToken(c: any, next: any) {
  // Read token from HttpOnly cookie
  const token = getCookie(c, 'adminToken')

  if (!token) {
    authLogger.debug('Admin token missing')
    return c.json({ error: 'unauthorized' }, 401)
  }

  const env = validateEnv()

  try {
    const payload = await verify(token, env.ADMIN_JWT_SECRET)

    // Validate expiration explicitly
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      authLogger.debug('Admin token expired')
      return c.json({ error: 'token_expired' }, 401)
    }

    if (payload.sub !== 'admin') {
      authLogger.warn('Invalid admin token subject', { subject: payload.sub })
      return c.json({ error: 'unauthorized' }, 401)
    }

    authLogger.debug('Admin token verified successfully')
    // Token is valid, proceed
    await next()
  } catch (err: any) {
    if (err.name === 'JwtTokenExpired') {
      authLogger.debug('Admin token JWT expired')
      return c.json({ error: 'token_expired' }, 401)
    }
    authLogger.warn('Invalid admin token', { error: err.message })
    return c.json({ error: 'invalid_token' }, 401)
  }
}

type WaitlistDoc = {
  email: string
  interests?: string[]
  createdAt?: Date
  [key: string]: unknown
}

// Get all waitlist users (protected route)
router.get('/admin/waitlist', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
    const limit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 200))
    const skip = (page - 1) * limit
    const search = (c.req.query('search') ?? '').trim()
    const interest = (c.req.query('interest') ?? '').trim()
    const format = (c.req.query('format') ?? 'json').toLowerCase()
    const sortParam = (c.req.query('sort') ?? 'createdAt').trim()
    const orderParam = (c.req.query('order') ?? 'desc').trim()

    const sortField = sortParam === 'email' ? 'email' : 'createdAt'
    const sortDirection = orderParam === 'asc' ? 1 : -1

    apiLogger.debug('Admin waitlist query', { page, limit, search, interest, format, sortField, sortDirection })

    const collection = db.collection<WaitlistDoc>('waitlist')
    const filter: Filter<WaitlistDoc> = {}

    // Ensure search is a string and sanitize for NoSQL injection
    if (search && typeof search === 'string') {
      filter.email = { $regex: escapeRegexFragment(search), $options: 'i' }
    }

    // Ensure interest is a string to prevent NoSQL injection
    if (interest && typeof interest === 'string') {
      filter.interests = interest
    }

    const total = await collection.countDocuments(filter)
    const cursor = collection
      .find(filter)
      .sort({ [sortField]: sortDirection as 1 | -1 })

    if (format === 'csv') {
      const exportLimit = Math.max(1, Math.min(Number.parseInt(c.req.query('limit') ?? String(CSV_EXPORT_LIMIT), 10) || CSV_EXPORT_LIMIT, CSV_EXPORT_LIMIT))
      const users = await cursor.limit(exportLimit).toArray()
      const rows: string[] = ['\uFEFF"Position","Email","Interests","Joined"']

      users.forEach((user, index) => {
        const position = index + 1
        const interests = Array.isArray(user.interests) ? user.interests.join('; ') : ''
        const joined = user.createdAt ? new Date(user.createdAt).toISOString() : ''

        rows.push([
          position,
          toCsvField(user.email),
          toCsvField(interests),
          toCsvField(joined),
        ].join(','))
      })

      const csvContent = rows.join('\n')
      const filename = `waitlist-${new Date().toISOString().split('T')[0]}.csv`

      return c.text(csvContent, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
    }

    const users = await cursor.skip(skip).limit(limit).toArray()

    return c.json({
      ok: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        search,
        interest,
        sort: sortField,
        order: sortDirection === 1 ? 'asc' : 'desc',
      },
    })
  } catch (err) {
    // Environment-aware error logging
    apiLogger.error('Admin waitlist fetch error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    return c.json({ error: 'server_error' }, 500)
  }
})

// Get waitlist statistics (protected route)
router.get('/admin/stats', verifyAdminToken, async (c) => {
  const env = validateEnv()
  await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
  const db = getDb()

  try {
    apiLogger.debug('Fetching admin stats')

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

    apiLogger.info('Admin stats fetched', { total, last24h, last7days })

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
    // Environment-aware error logging
    apiLogger.error('Admin stats fetch error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    return c.json({ error: 'server_error' }, 500)
  }
})

// Check auth status gracefully (returns 200 with authenticated boolean, not 401)
// Use this on login page to avoid console errors
router.get('/admin/check', async (c) => {
  const token = getCookie(c, 'adminToken')
  
  if (!token) {
    return c.json({ ok: true, authenticated: false })
  }

  const env = validateEnv()

  try {
    const payload = await verify(token, env.ADMIN_JWT_SECRET)

    // Validate expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return c.json({ ok: true, authenticated: false })
    }

    if (payload.sub !== 'admin') {
      return c.json({ ok: true, authenticated: false })
    }

    authLogger.debug('Admin auth check: authenticated')
    return c.json({ ok: true, authenticated: true })
  } catch (err) {
    return c.json({ ok: true, authenticated: false })
  }
})

// Verify token endpoint (to check if token is still valid)
router.get('/admin/verify', verifyAdminToken, async (c) => {
  authLogger.debug('Admin token verification successful')
  return c.json({ ok: true, valid: true })
})

// Logout endpoint - clear the HttpOnly cookie
router.post('/admin/logout', verifyAdminToken, async (c) => {
  deleteCookie(c, 'adminToken', {
    path: '/',
  })
  authLogger.info('Admin logout successful')
  return c.json({ ok: true })
})

export default router
