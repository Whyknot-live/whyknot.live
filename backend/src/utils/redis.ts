import { createClient, RedisClientType } from 'redis'
import { setTimeout as delay } from 'node:timers/promises'

let redisClient: RedisClientType | null = null
let isConnecting = false

export async function connectRedis(url?: string): Promise<RedisClientType> {
 if (redisClient?.isOpen) {
 return redisClient
 }

 // Prevent multiple simultaneous connection attempts
 if (isConnecting) {
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

 redisClient = createClient({
 url: redisUrl,
 socket: {
 connectTimeout: 10000,
 reconnectStrategy: (retries: number) => {
 if (retries > 10) {
 console.error('Redis: Max reconnection attempts reached')
 return new Error('Max reconnection attempts reached')
 }
 // Exponential backoff: 100ms, 200ms, 400ms, etc., max 3s
 return Math.min(retries * 100, 3000)
 }
 }
 })

 redisClient.on('error', (err: Error) => {
 console.error('Redis Client Error:', err)
 })

 redisClient.on('connect', () => {
 console.info('Redis: Connected successfully')
 })

 redisClient.on('reconnecting', () => {
 console.info('Redis: Reconnecting...')
 })

 redisClient.on('end', () => {
 console.info('Redis: Connection closed')
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
 await redisClient.quit()
 redisClient = null
 console.info('Redis: Disconnected')
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
 const redisKey = `ratelimit:${key}`
 
 const current = await client.incr(redisKey)
 
 if (current === 1) {
 // First request in window, set expiration
 await client.expire(redisKey, windowSeconds)
 }
 
 const ttl = await client.ttl(redisKey)
 const resetAt = Date.now() + (ttl * 1000)
 
 const remaining = Math.max(0, maxRequests - current)
 const allowed = current <= maxRequests
 
 return {
 allowed,
 remaining,
 resetAt
 }
}

/**
 * Cache helper for storing data with TTL
 */
export async function cacheSet(
 key: string,
 value: string,
 ttlSeconds?: number
): Promise<void> {
 const client = getRedisClient()
 
 if (ttlSeconds) {
 await client.setEx(key, ttlSeconds, value)
 } else {
 await client.set(key, value)
 }
}

/**
 * Cache helper for retrieving data
 */
export async function cacheGet(key: string): Promise<string | null> {
 const client = getRedisClient()
 return await client.get(key)
}

/**
 * Delete cached data
 */
export async function cacheDelete(key: string): Promise<void> {
 const client = getRedisClient()
 await client.del(key)
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
 const client = getRedisClient()
 const exists = await client.exists(key)
 return exists === 1
}

/**
 * Session storage helper
 */
export async function sessionSet(
 sessionId: string,
 data: Record<string, unknown>,
 ttlSeconds: number = 86400 // 24 hours default
): Promise<void> {
 const client = getRedisClient()
 const key = `session:${sessionId}`
 await client.setEx(key, ttlSeconds, JSON.stringify(data))
}

/**
 * Session retrieval helper
 */
export async function sessionGet(sessionId: string): Promise<Record<string, unknown> | null> {
 const client = getRedisClient()
 const key = `session:${sessionId}`
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
 const key = `session:${sessionId}`
 await client.del(key)
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
 try {
 if (!redisClient || !redisClient.isOpen) {
 return false
 }
 await redisClient.ping()
 return true
 } catch {
 return false
 }
}
