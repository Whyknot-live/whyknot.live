import { createMiddleware } from 'hono/factory'
import { rateLimitCheck, connectRedis } from '../utils/redis'

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
 
 // CSP - adjust based on your needs
 c.header(
 'Content-Security-Policy',
 "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
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

 const ip = c.req.header('x-forwarded-for') || 
 c.req.header('x-real-ip') || 
 c.req.header('cf-connecting-ip') ||
 'unknown'
 
 // Use Redis rate limiting if available
 if (process.env.REDIS_URL) {
 try {
 await connectRedis(process.env.REDIS_URL)
 const rateLimit = await rateLimitCheck(
 `${keyPrefix}:${ip}`, 
 maxRequests, 
 windowSeconds
 )
 
 // Add rate limit headers
 c.header('X-RateLimit-Limit', String(maxRequests))
 c.header('X-RateLimit-Remaining', String(rateLimit.remaining))
 c.header('X-RateLimit-Reset', String(rateLimit.resetAt))
 
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
 
 return next()
 })
}
