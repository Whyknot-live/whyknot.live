import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'
import { runScreenerAudit, type ScreenerAuditResult } from '../utils/screener'

const router = new Hono()

const scanSchema = z.object({
    url: z.string().trim().min(1).max(2048)
})

// In-memory cache for recent scans (keyed by scanId and by domain)
const scanCache = new Map<string, ScreenerAuditResult>()
const domainLatestScan = new Map<string, string>() // domain -> scanId

// Rate limiting (10 scans per 5 minutes per IP)
type RateEntry = { count: number; expiresAt: number }
const rateMap = new Map<string, RateEntry>()
const RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_SCANS_PER_WINDOW = 10

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = rateMap.get(ip)
    if (!entry || entry.expiresAt <= now) {
        rateMap.set(ip, { count: 1, expiresAt: now + RATE_WINDOW_MS })
        return { allowed: true, remaining: MAX_SCANS_PER_WINDOW - 1, resetAt: now + RATE_WINDOW_MS }
    }
    entry.count += 1
    return {
        allowed: entry.count <= MAX_SCANS_PER_WINDOW,
        remaining: Math.max(0, MAX_SCANS_PER_WINDOW - entry.count),
        resetAt: entry.expiresAt
    }
}

router.use('*', bodyLimit({ maxSize: 16 * 1024 }))

/**
 * POST /api/screener/scan
 * Performs live technical audit on the submitted URL
 */
router.post('/screener/scan', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = scanSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request', message: 'Please provide a valid website URL.' }, 400)
    }

    const ip = getClientAddress(c)
    const rate = checkRateLimit(ip)
    c.header('X-RateLimit-Limit', String(MAX_SCANS_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(rate.remaining))
    c.header('X-RateLimit-Reset', String(rate.resetAt))

    if (!rate.allowed) {
        apiLogger.warn('Screener scan rate limited', { ip })
        return c.json({
            error: 'rate_limited',
            message: 'Scan rate limit reached. Please wait a few minutes before scanning again.'
        }, 429)
    }

    try {
        const audit = await runScreenerAudit(parsed.data.url)
        
        // Cache audit result
        scanCache.set(audit.scanId, audit)
        domainLatestScan.set(audit.domain, audit.scanId)

        // Prune cache if over 500 items
        if (scanCache.size > 500) {
            const firstKey = scanCache.keys().next().value
            if (firstKey) scanCache.delete(firstKey)
        }

        apiLogger.info('Screener scan completed', {
            scanId: audit.scanId,
            domain: audit.domain,
            overallScore: audit.scores.overall,
            durationMs: audit.durationMs
        })

        return c.json({ ok: true, audit }, 200)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown_error'
        apiLogger.warn('Screener scan failed', { url: parsed.data.url, error: message })

        if (message === 'blocked_host') {
            return c.json({ error: 'blocked_host', message: 'Internal or private IP addresses cannot be scanned.' }, 400)
        }
        if (message === 'dns_unreachable') {
            return c.json({ error: 'dns_unreachable', message: 'Domain does not exist or DNS lookup failed.' }, 400)
        }
        if (message === 'timeout') {
            return c.json({ error: 'timeout', message: 'The website took too long to respond (>5s).' }, 408)
        }
        if (message === 'not_html') {
            return c.json({ error: 'not_html', message: 'The URL did not return an HTML webpage.' }, 400)
        }
        if (message.startsWith('http_')) {
            const code = message.replace('http_', '')
            return c.json({ error: 'http_error', message: `Website returned an HTTP ${code} error status.` }, 400)
        }

        return c.json({ error: 'scan_failed', message: 'Unable to complete scan. Please verify the URL and try again.' }, 500)
    }
})

/**
 * GET /api/screener/report/:id
 * Retrieves a previously completed scan by scan ID
 */
router.get('/screener/report/:id', async (c) => {
    const id = c.req.param('id')
    const cached = scanCache.get(id)
    if (cached) {
        return c.json({ ok: true, audit: cached }, 200)
    }
    return c.json({ error: 'not_found', message: 'Scan report not found or expired.' }, 404)
})

/**
 * GET /api/screener/domain/:domain
 * Retrieves the latest scan for a domain if cached
 */
router.get('/screener/domain/:domain', async (c) => {
    const domain = c.req.param('domain').toLowerCase().trim()
    const scanId = domainLatestScan.get(domain)
    if (scanId) {
        const cached = scanCache.get(scanId)
        if (cached) {
            return c.json({ ok: true, audit: cached }, 200)
        }
    }
    return c.json({ error: 'not_found', message: 'No recent scan found for this domain.' }, 404)
})

export default router
