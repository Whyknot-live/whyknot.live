/**
 * Submit-flow shared helpers (P1).
 *
 * Pure functions only — no DB, no network — so they stay unit-testable
 * with node:test and reusable across the scrape / submit / slots routes.
 * Slug style intentionally mirrors frontend/src/lib/content.ts.
 */

export const SLOT_CAPACITY = 3
export const TAGLINE_MAX_LENGTH = 60
export const SCRAPE_TIMEOUT_MS = 5000
export const MAX_SCRAPE_BYTES = 1024 * 1024 // 1MB cap (C2: own scrape code only)

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Normalize a user-pasted URL for storage + dedupe.
 * Prepends https:// when no scheme is present, lowercases the host,
 * drops default ports and fragments. Throws Error('invalid_url') when
 * the input is not a usable http(s) URL.
 */
export function normalizeUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) {
        throw new Error('invalid_url')
    }
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
    let parsed: URL
    try {
        parsed = new URL(withScheme)
    } catch {
        throw new Error('invalid_url')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid_url')
    }
    if (!parsed.hostname || /\s/.test(parsed.hostname)) {
        throw new Error('invalid_url')
    }
    parsed.hostname = parsed.hostname.toLowerCase()
    if (
        (parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
        parsed.port = ''
    }
    parsed.hash = ''
    const out = parsed.toString()
    if (parsed.pathname === '/' && !parsed.search) {
        return out.slice(0, -1)
    }
    return out
}

/** Tagline rule from the submit spec: non-empty, max 60 chars. */
export function isTaglineValid(tagline: string): boolean {
    const trimmed = tagline.trim()
    return trimmed.length > 0 && trimmed.length <= TAGLINE_MAX_LENGTH
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

// --- SSRF guard (C2: own checks only, never fetch blindly) ---

/** Hostnames we refuse to resolve/fetch: loopback, metadata, internal zones. */
export function isBlockedHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, '')
    if (host === 'localhost' || host === '::1' || host === '[::1]') {
        return true
    }
    if (
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.endsWith('.invalid') ||
        host.endsWith('.test')
    ) {
        return true
    }
    if (/^127\./.test(host) || host === '0.0.0.0' || host === '2130706433') {
        return true
    }
    // Cloud metadata endpoints (AWS / GCP)
    if (host === '169.254.169.254' || host.startsWith('169.254.') || host === 'metadata.google.internal') {
        return true
    }
    return false
}

/** True for loopback / private / link-local / reserved IPs (v4 + common v6). */
export function isPrivateIp(ip: string): boolean {
    const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (v4) {
        const parts = v4.slice(1).map(Number)
        if (parts.some((n) => n < 0 || n > 255)) {
            return true
        }
        const [a, b] = parts as [number, number, number, number]
        if (a === 10 || a === 127 || a === 0) {
            return true
        }
        if (a === 172 && b >= 16 && b <= 31) {
            return true
        }
        if (a === 192 && b === 168) {
            return true
        }
        if (a === 169 && b === 254) {
            return true
        }
        if (a === 100 && b >= 64 && b <= 127) {
            return true
        }
        if (a === 192 && (b === 0 || b === 18 || b === 19)) {
            return true
        }
        if (a === 198 && (b === 18 || b === 19 || b === 51 || b === 52)) {
            return true
        }
        if (a === 203 && b === 0) {
            return true
        }
        if (a >= 224) {
            return true
        }
        return false
    }
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (lower === '::1' || lower === '::' || lower === '::ffff:127.0.0.1') {
        return true
    }
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) {
        return true
    }
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped?.[1]) {
        return isPrivateIp(mapped[1])
    }
    return false
}

// --- Scrape parsing (title / meta description / stack hints) ---

export function extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!match?.[1]) {
        return ''
    }
    return match[1].replace(/\s+/g, ' ').trim().slice(0, 200)
}

export function extractMetaDescription(html: string): string {
    const tags = html.match(/<meta[^>]+>/gi) ?? []
    const byName = (name: string): string => {
        const pattern = new RegExp(`name=["']${name}["']`, 'i')
        for (const tag of tags) {
            if (pattern.test(tag)) {
                const content = tag.match(/content=["']([\s\S]*?)["']/i)
                if (content?.[1]?.trim()) {
                    return content[1].trim().slice(0, 500)
                }
            }
        }
        return ''
    }
    return byName('description') || byName('og:description') || byName('twitter:description')
}

const STACK_HINT_PATTERNS: Array<{ hint: string; pattern: RegExp }> = [
    { hint: 'astro', pattern: /<meta[^>]+generator[^>]*astro|astro-island/i },
    { hint: 'nextjs', pattern: /_next\/static|__next/i },
    { hint: 'nuxt', pattern: /_nuxt\/|__nuxt/i },
    { hint: 'gatsby', pattern: /gatsby/i },
    { hint: 'remix', pattern: /remix\./i },
    { hint: 'react', pattern: /data-reactroot|__react|react-dom/i },
    { hint: 'vue', pattern: /data-v-[a-f0-9]+|__vue__|vue\./i },
    { hint: 'svelte', pattern: /svelte/i },
    { hint: 'tailwind', pattern: /tailwind/i },
    { hint: 'wordpress', pattern: /wp-content|wp-includes|wordpress/i },
    { hint: 'webflow', pattern: /webflow/i },
    { hint: 'framer', pattern: /framer/i },
    { hint: 'shopify', pattern: /cdn\.shopify|myshopify\.com/i },
    { hint: 'ghost', pattern: /ghost\.(css|js)|"ghost":/i }
]

/** Best-effort stack hints from raw HTML (regex only, own code per C2). */
export function detectStackHints(html: string): string[] {
    const hints: string[] = []
    for (const { hint, pattern } of STACK_HINT_PATTERNS) {
        if (pattern.test(html)) {
            hints.push(hint)
        }
    }
    return hints
}

// --- Launch slots ---

export interface SlotAvailability {
    date: string // YYYY-MM-DD (UTC)
    capacity: number
    taken: number
    available: number
}

export function toSlotDateString(date: Date): string {
    return date.toISOString().slice(0, 10)
}

/** Tomorrow (UTC) — the earliest day a fresh submission can launch. */
export function earliestSlotDate(from: Date = new Date()): string {
    return toSlotDateString(new Date(from.getTime() + 24 * 60 * 60 * 1000))
}

export function buildAvailability(
    counts: Record<string, number>,
    startDate: string,
    days: number
): SlotAvailability[] {
    const base = new Date(`${startDate}T00:00:00.000Z`)
    const slots: SlotAvailability[] = []
    for (let i = 0; i < days; i++) {
        const date = toSlotDateString(new Date(base.getTime() + i * 24 * 60 * 60 * 1000))
        const taken = counts[date] ?? 0
        slots.push({
            date,
            capacity: SLOT_CAPACITY,
            taken,
            available: Math.max(0, SLOT_CAPACITY - taken)
        })
    }
    return slots
}

/** First date with free capacity, scanning forward from startDate. */
export function findNextFreeSlot(
    counts: Record<string, number>,
    startDate: string,
    maxDays = 90
): string | null {
    for (const slot of buildAvailability(counts, startDate, maxDays)) {
        if (slot.available > 0) {
            return slot.date
        }
    }
    return null
}
