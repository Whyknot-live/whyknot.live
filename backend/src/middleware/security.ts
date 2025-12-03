import { createMiddleware } from 'hono/factory'
import { rateLimitCheck, connectRedis } from '../utils/redis'
import { getClientAddress } from '../utils/request'

type LocalRateLimitEntry = {
 count: number
 expiresAt: number
 limit: number
}

const localRateLimitMap = new Map<string, LocalRateLimitEntry>()
const MAX_LOCAL_RATE_KEYS = 2000

function pruneLocalRateLimiter(now: number) {
 for (const [key, entry] of localRateLimitMap) {
  if (entry.expiresAt <= now) {
   localRateLimitMap.delete(key)
  }
 }
 if (localRateLimitMap.size <= MAX_LOCAL_RATE_KEYS) {
  return
 }
 const snapshot = Array.from(localRateLimitMap.entries())
 snapshot.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
 for (const [key] of snapshot) {
  localRateLimitMap.delete(key)
  if (localRateLimitMap.size <= MAX_LOCAL_RATE_KEYS) {
   break
  }
 }
}

function applyLocalRateLimit(key: string, maxRequests: number, windowSeconds: number) {
 const now = Date.now()
 pruneLocalRateLimiter(now)
 const entry = localRateLimitMap.get(key)
 const windowMs = windowSeconds * 1000
 if (!entry || entry.expiresAt <= now) {
  const expiresAt = now + windowMs
  localRateLimitMap.set(key, { count: 1, expiresAt, limit: maxRequests })
  return { allowed: true, remaining: maxRequests - 1, resetAt: expiresAt }
 }
 entry.count += 1
 return {
  allowed: entry.count <= maxRequests,
  remaining: Math.max(0, maxRequests - entry.count),
  resetAt: entry.expiresAt
 }
}

export const securityHeaders = createMiddleware(async (c, next) => {
 await next()
 
 // Security headers
 c.header('X-Frame-Options', 'DENY')
 c.header('X-Content-Type-Options', 'nosniff')
 c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
 c.header('X-XSS-Protection', '1; mode=block')
 c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
 
 // HSTS - only in production
 if (process.env.NODE_ENV === 'production') {
 c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
 }
 
 // CSP - strict policy without unsafe-inline
 c.header(
 'Content-Security-Policy',
 "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
 )
})

// Rate limiting middleware factory
export function rateLimitMiddleware(options: {
 maxRequests?: number
 windowSeconds?: number
 keyPrefix?: string
} = {}) {
 const { 
 maxRequests = 100, 
 windowSeconds = 60,
 keyPrefix = 'global'
 } = options

 return createMiddleware(async (c, next) => {
 // Skip rate limiting for health checks
 if (c.req.path === '/health' || c.req.path === '/') {
 return next()
 }

 const ip = getClientAddress(c)
 const rateLimitKey = `${keyPrefix}:${ip}`
 let handledByRedis = false
 
 // Use Redis rate limiting if available
 if (process.env.REDIS_URL) {
 try {
 await connectRedis(process.env.REDIS_URL)
 const rateLimit = await rateLimitCheck(
 rateLimitKey, 
 maxRequests, 
 windowSeconds
 )
 
 // Add rate limit headers
 c.header('X-RateLimit-Limit', String(maxRequests))
 c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
 c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
 
  handledByRedis = true
 
 if (!rateLimit.allowed) {
 return c.json({ 
 error: 'rate_limited',
 message: 'Too many requests, please try again later',
 retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
 }, 429)
 }
 } catch (error) {
 // Log but don't block on Redis errors
 console.error('Rate limit check failed:', error)
 }
 }

 if (!handledByRedis) {
  const fallback = applyLocalRateLimit(rateLimitKey, maxRequests, windowSeconds)
  c.header('X-RateLimit-Limit', String(maxRequests))
  c.header('X-RateLimit-Remaining', String(fallback.remaining))
  c.header('X-RateLimit-Reset', String(fallback.resetAt))
  if (!fallback.allowed) {
   return c.json({
	error: 'rate_limited',
	message: 'Too many requests, please try again later',
	retryAfter: Math.ceil((fallback.resetAt - Date.now()) / 1000)
   }, 429)
  }
 }
 
 return next()
 })
}
