/**
 * Health Ping Utility
 * 
 * Self-polling mechanism to keep the Render free instance alive
 * by pinging the health endpoint every 10 minutes.
 */

import { healthLogger } from './logger'

const PING_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds
const HEALTH_ENDPOINT = process.env.HEALTH_PING_URL || 'http://localhost:9000/health'

let pingInterval: NodeJS.Timeout | null = null
let pingCount = 0
let lastPingTime: Date | null = null
let lastPingStatus: 'success' | 'failed' | null = null

/**
 * Performs a health check ping
 */
async function performHealthPing(): Promise<void> {
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'User-Agent': 'whyknot-health-ping/1.0',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    pingCount++
    lastPingTime = new Date()
    lastPingStatus = response.ok ? 'success' : 'failed'

    if (response.ok) {
      healthLogger.info('Health ping successful', {
        pingCount,
        timestamp: lastPingTime.toISOString()
      })
    } else {
      healthLogger.warn('Health ping returned non-OK status', {
        pingCount,
        status: response.status
      })
    }
  } catch (error) {
    pingCount++
    lastPingTime = new Date()
    lastPingStatus = 'failed'
    healthLogger.error('Health ping failed', {
      pingCount,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Starts the health ping interval
 * Only runs in production environment
 */
export function startHealthPing(): void {
  // Only enable in production and if URL is configured
  if (process.env.NODE_ENV !== 'production') {
    healthLogger.debug('Health ping disabled in non-production environment')
    return
  }

  if (!process.env.HEALTH_PING_URL) {
    healthLogger.warn('HEALTH_PING_URL not configured, health ping disabled')
    return
  }

  if (pingInterval) {
    healthLogger.warn('Health ping already running')
    return
  }

  healthLogger.info('Starting health ping', {
    endpoint: HEALTH_ENDPOINT,
    intervalMs: PING_INTERVAL
  })

  // Perform initial ping after 1 minute (give server time to fully start)
  setTimeout(() => {
    performHealthPing()
  }, 60000)

  // Set up recurring ping
  pingInterval = setInterval(() => {
    performHealthPing()
  }, PING_INTERVAL)

  healthLogger.info('Health ping started successfully')
}

/**
 * Stops the health ping interval
 */
export function stopHealthPing(): void {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
    healthLogger.info('Health ping stopped')
  }
}

/**
 * Gets the current health ping status
 */
export function getHealthPingStatus() {
  return {
    enabled: pingInterval !== null,
    endpoint: HEALTH_ENDPOINT,
    pingCount,
    lastPingTime,
    lastPingStatus,
    intervalMs: PING_INTERVAL,
  }
}
