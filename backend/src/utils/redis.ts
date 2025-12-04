import { createClient, RedisClientType } from 'redis'
import { setTimeout as delay } from 'node:timers/promises'
import { redisLogger } from './logger'

let redisClient: RedisClientType | null = null
let isConnecting = false

export async function connectRedis(url?: string): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    redisLogger.debug('Using existing Redis connection')
    return redisClient
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    redisLogger.debug('Redis connection already in progress, waiting...')
    // Wait for existing connection attempt
    let attempts = 0
    while (isConnecting && attempts < 50) {
      await delay(100)
      attempts++
    }
    if (redisClient?.isOpen) {
      return redisClient
    }
  }

  isConnecting = true

  try {
    const redisUrl = url || process.env.REDIS_URL

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required')
    }

    redisLogger.debug('Creating new Redis connection')

    // Redis Free Tier (Upstash/Redis Cloud) Optimizations:
    // - Free tier: 10,000 commands/day, 30 connections max
    // - Use minimal connections and aggressive timeouts
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000, // Faster timeout for free tier
        reconnectStrategy: (retries: number) => {
          // Reduce reconnection attempts for free tier
          if (retries > 5) {
            redisLogger.error('Max reconnection attempts reached', { retries })
            return new Error('Max reconnection attempts reached')
          }
          const delay = Math.min(retries * 200, 3000)
          redisLogger.debug('Redis reconnecting', { retries, delay: `${delay}ms` })
          // Exponential backoff: 200ms, 400ms, 800ms, 1.6s, 3s
          return delay
        }
      }
    })

    redisClient.on('error', (err: Error) => {
      redisLogger.error('Redis client error', { error: err.message })
    })

    redisClient.on('connect', () => {
      redisLogger.info('Redis connected successfully')
    })

    redisClient.on('reconnecting', () => {
      redisLogger.debug('Redis reconnecting...')
    })

    redisClient.on('end', () => {
      redisLogger.info('Redis connection closed')
    })

    await redisClient.connect()

    return redisClient
  } finally {
    isConnecting = false
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client is not connected. Call connectRedis() first.')
  }
  return redisClient
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    redisLogger.debug('Disconnecting Redis...')
    await redisClient.quit()
    redisClient = null
    redisLogger.info('Redis disconnected')
  }
}

/**
 * Rate limiting using Redis
 * @param key - Unique identifier (e.g., IP address, user ID)
 * @param maxRequests - Maximum number of requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns Object with allowed status and remaining requests
 */
export async function rateLimitCheck(
  key: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const client = getRedisClient()
  const redisKey = `rl:${key}` // Shorter key to save memory

  redisLogger.debug('Rate limit check', { key: redisKey, maxRequests, windowSeconds })

  // Use pipeline to reduce round trips (saves commands for free tier)
  const pipeline = client.multi()
  pipeline.incr(redisKey)
  pipeline.ttl(redisKey)

  const results = await pipeline.exec()
  const current = results[0] as unknown as number
  const ttl = results[1] as unknown as number // Set expiration only on first request
  if (current === 1 || ttl === -1) {
    await client.expire(redisKey, windowSeconds)
  }

  const resetAt = Date.now() + ((ttl > 0 ? ttl : windowSeconds) * 1000)
  const remaining = Math.max(0, maxRequests - current)
  const allowed = current <= maxRequests

  if (!allowed) {
    redisLogger.debug('Rate limit exceeded', { key: redisKey, current, maxRequests })
  }

  return {
    allowed,
    remaining,
    resetAt
  }
}

/**
 * Cache helper for storing data with TTL
 * Optimized for free tier with shorter default TTLs
 */
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number = 300 // Default 5 minutes (reduced from no limit)
): Promise<void> {
  const client = getRedisClient()
  const redisKey = `c:${key}` // Shorter prefix

  await client.setEx(redisKey, ttlSeconds, value)
}

/**
 * Cache helper for retrieving data
 */
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedisClient()
  const redisKey = `c:${key}`
  return await client.get(redisKey)
}

/**
 * Delete cached data
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient()
  const redisKey = `c:${key}`
  await client.del(redisKey)
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  const client = getRedisClient()
  const redisKey = `c:${key}`
  const exists = await client.exists(redisKey)
  return exists === 1
}

/**
 * Session storage helper
 * Optimized for free tier with shorter TTL and keys
 */
export async function sessionSet(
  sessionId: string,
  data: Record<string, unknown>,
  ttlSeconds: number = 3600 // Default 1 hour (reduced from 24h)
): Promise<void> {
  const client = getRedisClient()
  const key = `s:${sessionId}` // Shorter prefix
  await client.setEx(key, ttlSeconds, JSON.stringify(data))
}

/**
 * Session retrieval helper
 */
export async function sessionGet(sessionId: string): Promise<Record<string, unknown> | null> {
  const client = getRedisClient()
  const key = `s:${sessionId}`
  const data = await client.get(key)

  if (!data) return null

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Delete session
 */
export async function sessionDelete(sessionId: string): Promise<void> {
  const client = getRedisClient()
  const key = `s:${sessionId}`
  await client.del(key)
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient || !redisClient.isOpen) {
      redisLogger.debug('Redis health check: not connected')
      return false
    }
    await redisClient.ping()
    redisLogger.debug('Redis health check: healthy')
    return true
  } catch (error) {
    redisLogger.warn('Redis health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}
