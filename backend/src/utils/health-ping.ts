/**
 * Health Ping Utility
 * 
 * Self-polling mechanism to keep the Render free instance alive
 * by pinging the health endpoint every 10 minutes.
 */

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
      console.info(`[health-ping] ✓ Ping #${pingCount} successful at ${lastPingTime.toISOString()}`)
    } else {
      console.warn(`[health-ping] ⚠ Ping #${pingCount} returned status ${response.status}`)
    }
  } catch (error) {
    pingCount++
    lastPingTime = new Date()
    lastPingStatus = 'failed'
    console.error(`[health-ping] ✗ Ping #${pingCount} failed:`, error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * Starts the health ping interval
 * Only runs in production environment
 */
export function startHealthPing(): void {
  // Only enable in production and if URL is configured
  if (process.env.NODE_ENV !== 'production') {
    console.info('[health-ping] Disabled in non-production environment')
    return
  }

  if (!process.env.HEALTH_PING_URL) {
    console.warn('[health-ping] HEALTH_PING_URL not configured, health ping disabled')
    return
  }

  if (pingInterval) {
    console.warn('[health-ping] Already running')
    return
  }

  console.info(`[health-ping] Starting health ping to ${HEALTH_ENDPOINT} every 10 minutes`)

  // Perform initial ping after 1 minute (give server time to fully start)
  setTimeout(() => {
    performHealthPing()
  }, 60000)

  // Set up recurring ping
  pingInterval = setInterval(() => {
    performHealthPing()
  }, PING_INTERVAL)

  console.info('[health-ping] ✓ Health ping started')
}

/**
 * Stops the health ping interval
 */
export function stopHealthPing(): void {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
    console.info('[health-ping] Stopped')
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
