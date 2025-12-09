import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { timeout } from 'hono/timeout'
import { securityHeaders, rateLimitMiddleware } from './middleware/security'
import waitlistRouter from './routes/waitlist'
import adminRouter from './routes/admin'
import { validateEnv } from './utils/env'
import { connectMongo, closeMongo, checkMongoHealth } from './utils/mongo'
import { connectRedis, disconnectRedis, checkRedisHealth } from './utils/redis'
import { logger, apiLogger, createRequestTimer } from './utils/logger'

const env = validateEnv()

const app = new Hono()

// Request logging middleware with timing
app.use('*', async (c, next) => {
    const timer = createRequestTimer()
    const method = c.req.method
    const path = c.req.path

    apiLogger.debug('Request received', { method, path })

    await next()

    const duration = timer.getDuration()
    const status = c.res.status

    // Use different log levels based on status code
    if (status >= 500) {
        apiLogger.error('Request completed', { method, path, status, duration: `${duration}ms` })
    } else if (status >= 400) {
        apiLogger.warn('Request completed', { method, path, status, duration: `${duration}ms` })
    } else {
        apiLogger.info('Request completed', { method, path, status, duration: `${duration}ms` })
    }
})

// Timeout for all requests (30 seconds)
app.use('*', timeout(30000))

// Security headers for all routes
app.use('*', securityHeaders)

// CORS for API routes - allow both www and non-www domains, plus admin
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) ?? ['https://whyknot.live', 'https://www.whyknot.live'];
// Add localhost only in development environment
if (process.env.NODE_ENV === 'development') {
    corsOrigins.push('http://localhost:4321', 'http://127.0.0.1:4321', 'http://localhost:4322', 'http://127.0.0.1:4322');
}
// Log CORS origins at startup for debugging
logger.info('CORS origins configured', { origins: corsOrigins });

app.use('/api/*', cors({
    origin: corsOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400
}))

// Global rate limiting for API routes
app.use('/api/*', rateLimitMiddleware())

app.route('/api', waitlistRouter)
app.route('/api', adminRouter)

// Root health check
app.get('/', (c) => c.json({
    ok: true,
    service: 'whyknot-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString()
}))

// Detailed health check endpoint for Render
app.get('/health', async (c) => {
    try {
        const checks = {
            mongodb: await checkMongoHealth(),
            redis: await checkRedisHealth(),
            timestamp: new Date().toISOString()
        }

        const allHealthy = checks.mongodb && checks.redis

        return c.json({
            ok: allHealthy,
            status: allHealthy ? 'healthy' : 'degraded',
            checks
        }, allHealthy ? 200 : 503)
    } catch (error) {
        return c.json({
            ok: false,
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, 503)
    }
})

// Startup function with retry logic
async function startup() {
    const maxRetries = 3
    let retries = 0

    while (retries < maxRetries) {
        try {
            // Connect to MongoDB
            logger.info(`Attempting MongoDB connection`, { attempt: retries + 1, maxRetries })
            await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
            logger.info('MongoDB connected successfully')

            // Connect to Redis if configured
            if (env.REDIS_URL) {
                await connectRedis(env.REDIS_URL)
                logger.info('Redis connected')
            } else {
                logger.warn('Redis not configured - using in-memory rate limiting')
            }

            return // Success
        } catch (error) {
            retries++
            logger.error(`Failed to connect to services`, {
                attempt: retries,
                maxRetries,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            if (retries >= maxRetries) {
                logger.error('Max retries reached. Exiting...')
                process.exit(1)
            }

            // Wait before retrying (exponential backoff)
            const waitTime = Math.min(1000 * Math.pow(2, retries - 1), 5000)
            logger.info(`Retrying in ${waitTime}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
        }
    }
}

const port = Number(process.env.PORT ?? 10000)
const host = '0.0.0.0' // Required for Render

// Graceful shutdown
async function shutdown(signal: string) {
    logger.info(`${signal} received, starting graceful shutdown...`)

    try {
        await disconnectRedis()
        await closeMongo()
        logger.info('All connections closed')
        process.exit(0)
    } catch (error) {
        logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error'
        })
        process.exit(1)
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start server
startup().then(() => {
    if (process.env.NODE_ENV !== 'test') {
        logger.info('Server started', {
            host,
            port,
            environment: process.env.NODE_ENV || 'development',
            healthCheck: `http://${host}:${port}/health`
        })
    }
}).catch((error) => {
    logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : 'Unknown error'
    })
    process.exit(1)
})

// Export for Bun server
export default {
    port,
    hostname: host,
    fetch: app.fetch,
}