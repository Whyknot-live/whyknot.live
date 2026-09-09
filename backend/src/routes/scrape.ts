import { Hono } from 'hono'
import { z } from 'zod'
import { bodyLimit } from 'hono/body-limit'
import { lookup } from 'node:dns/promises'
import { getClientAddress } from '../utils/request'
import { apiLogger } from '../utils/logger'
import {
    normalizeUrl,
    isBlockedHostname,
    isPrivateIp,
    detectStackHints,
    extractTitle,
    extractMetaDescription,
    SCRAPE_TIMEOUT_MS,
    MAX_SCRAPE_BYTES
} from '../utils/submit'

const router = new Hono()

const schema = z.object({
    url: z.string().trim().min(1).max(2048)
})

// Local in-memory rate limit state (mirrors waitlist.ts fallback)
type LocalRateEntry = { count: number; expiresAt: number }
const recent = new Map<string, LocalRateEntry>()
const WINDOW = 60 * 1000 // 1 minute
const MAX_PER_WINDOW = 10
const MAX_TRACKED_IPS = 1000

router.use('*', bodyLimit({ maxSize: 16 * 1024 }))

function pruneRecent(now: number) {
    for (const [ip, entry] of recent) {
        if (entry.expiresAt <= now) {
            recent.delete(ip)
        }
    }
    if (recent.size <= MAX_TRACKED_IPS) {
        return
    }
    const entries = Array.from(recent.entries())
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    for (const [ip] of entries) {
        recent.delete(ip)
        if (recent.size <= MAX_TRACKED_IPS) {
            break
        }
    }
}

function applyLocalRateLimit(ip: string, now: number) {
    pruneRecent(now)
    const entry = recent.get(ip)
    if (!entry || entry.expiresAt <= now) {
        recent.set(ip, { count: 1, expiresAt: now + WINDOW })
        return { allowed: true, remaining: MAX_PER_WINDOW - 1, resetAt: now + WINDOW }
    }
    entry.count += 1
    return {
        allowed: entry.count <= MAX_PER_WINDOW,
        remaining: Math.max(0, MAX_PER_WINDOW - entry.count),
        resetAt: entry.expiresAt
    }
}

/** Read a response body with a hard byte cap (C2: never buffer unbounded HTML). */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
    if (!res.body) {
        return ''
    }
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            if (value) {
                total += value.byteLength
                if (total > maxBytes) {
                    break
                }
                chunks.push(value)
            }
        }
    } finally {
        try {
            await reader.cancel()
        } catch {
            // Reader already closed — nothing to do.
        }
    }
    const merged = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0))
    let offset = 0
    for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

router.post('/scrape-preview', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }

    const ip = getClientAddress(c)
    const now = Date.now()
    const localResult = applyLocalRateLimit(ip, now)
    c.header('X-RateLimit-Limit', String(MAX_PER_WINDOW))
    c.header('X-RateLimit-Remaining', String(localResult.remaining))
    c.header('X-RateLimit-Reset', String(localResult.resetAt))
    if (!localResult.allowed) {
        apiLogger.warn('Rate limit exceeded (in-memory)', { ip, endpoint: 'scrape-preview' })
        return c.json({ error: 'rate_limited' }, 429)
    }

    let normalized: string
    try {
        normalized = normalizeUrl(parsed.data.url)
    } catch {
        return c.json({ error: 'invalid_url' }, 400)
    }

    const hostname = new URL(normalized).hostname

    // SSRF guard: refuse loopback / internal / metadata hosts before any fetch.
    if (isBlockedHostname(hostname)) {
        apiLogger.debug('Scrape blocked hostname', { hostname })
        return c.json({ error: 'blocked_host' }, 400)
    }

    // C2 self check: DNS must resolve, and no resolved IP may be private.
    try {
        const records = await lookup(hostname, { all: true })
        if (!records.length || records.some((r) => isPrivateIp(r.address))) {
            apiLogger.debug('Scrape blocked private IP', { hostname })
            return c.json({ error: 'blocked_host' }, 400)
        }
    } catch {
        apiLogger.debug('Scrape DNS unreachable', { hostname })
        return c.json({ error: 'unreachable' }, 400)
    }

    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)
        let res: Response
        try {
            res = await fetch(normalized, {
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'User-Agent': 'WhyKnotBot/1.0 (+https://whyknot.live)',
                    Accept: 'text/html,application/xhtml+xml'
                }
            })
        } finally {
            clearTimeout(timer)
        }
        if (!res.ok) {
            return c.json({ error: 'unreachable' }, 400)
        }
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('text/html')) {
            return c.json({ error: 'not_html' }, 400)
        }
        const html = await readCappedText(res, MAX_SCRAPE_BYTES)
        return c.json({
            title: extractTitle(html),
            description: extractMetaDescription(html),
            stackHints: detectStackHints(html),
            screenshotStatus: 'placeholder'
        })
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return c.json({ error: 'unreachable' }, 400)
        }
        apiLogger.error('scrape-preview failed', {
            error: err instanceof Error ? err.message : 'Unknown error'
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
