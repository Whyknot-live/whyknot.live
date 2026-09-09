/**
 * WhyKnot Screener Engine
 *
 * Provides deep, transparent website analysis across 4 pillars:
 * 1. Performance (TTFB, HTML payload weight, resource footprint, DOM size)
 * 2. Accessibility (HTML lang, viewport, heading hierarchy, image alt coverage)
 * 3. Best Practices (HTTPS, HSTS, CSP, X-Frame-Options, Content-Type headers, modern doctype)
 * 4. SEO & Structured Data (Title length, meta description, Open Graph, Canonical, JSON-LD)
 * Plus Technology Fingerprinting and Prioritized Actionable Findings.
 */

import { lookup } from 'node:dns/promises'
import {
    normalizeUrl,
    isBlockedHostname,
    isPrivateIp,
    SCRAPE_TIMEOUT_MS,
    MAX_SCRAPE_BYTES
} from './submit'

export interface Finding {
    id: string
    category: 'performance' | 'accessibility' | 'best-practices' | 'seo' | 'security'
    severity: 'high' | 'medium' | 'low' | 'pass'
    title: string
    description: string
    recommendation?: string
}

export interface SecurityHeaderCheck {
    name: string
    present: boolean
    value: string | null
    status: 'pass' | 'warning' | 'fail'
    description: string
}

export interface TechItem {
    name: string
    category: 'framework' | 'cms' | 'cdn' | 'styling' | 'analytics' | 'hosting' | 'library'
    confidence: number
    version?: string
}

export interface ScreenerAuditResult {
    scanId: string
    url: string
    domain: string
    status: 'complete' | 'partial' | 'failed'
    timestamp: string
    durationMs: number
    scores: {
        overall: number
        performance: number
        accessibility: number
        bestPractices: number
        seo: number
    }
    metrics: {
        ttfbMs: number
        contentLengthBytes: number
        domNodesEstimated: number
        scriptsCount: number
        stylesheetsCount: number
        imagesCount: number
        imagesMissingAltCount: number
        linksCount: number
    }
    meta: {
        title: string
        description: string
        lang: string | null
        charset: string | null
        canonical: string | null
        ogTitle: string | null
        ogDescription: string | null
        ogImage: string | null
        twitterCard: string | null
        hasJsonLd: boolean
    }
    security: {
        isHttps: boolean
        headers: SecurityHeaderCheck[]
        score: number
    }
    techStack: TechItem[]
    findings: Finding[]
}

/** Read response body up to maxBytes */
async function readCappedBody(res: Response, maxBytes: number): Promise<string> {
    if (!res.body) return ''
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
                total += value.byteLength
                if (total > maxBytes) break
                chunks.push(value)
            }
        }
    } finally {
        try {
            await reader.cancel()
        } catch {
            // Reader already closed
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

/** Extract attribute value from an HTML tag string */
function extractAttr(tag: string, attrName: string): string | null {
    const re = new RegExp(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    const match = tag.match(re)
    if (!match) return null
    return (match[1] ?? match[2] ?? match[3] ?? '').trim()
}

/** Generate a unique scan ID */
export function generateScanId(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let id = 'scan_'
    for (let i = 0; i < 12; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
}

/**
 * Perform full technical Screener audit on a given URL
 */
export async function runScreenerAudit(targetUrl: string): Promise<ScreenerAuditResult> {
    const startTime = Date.now()
    const normalized = normalizeUrl(targetUrl)
    const urlObj = new URL(normalized)
    const domain = urlObj.hostname
    const scanId = generateScanId()

    // 1. SSRF & Host Validation
    if (isBlockedHostname(domain)) {
        throw new Error('blocked_host')
    }

    try {
        const records = await lookup(domain, { all: true })
        if (!records.length || records.some((r) => isPrivateIp(r.address))) {
            throw new Error('blocked_host')
        }
    } catch (err: unknown) {
        if (err instanceof Error && err.message === 'blocked_host') throw err
        throw new Error('dns_unreachable')
    }

    // 2. Fetch Document & Time TTFB
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)
    let res: Response
    let ttfbMs = 0
    try {
        const fetchStart = Date.now()
        res = await fetch(normalized, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'WhyKnotScreener/1.0 (+https://whyknot.live/screener)',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        })
        ttfbMs = Date.now() - fetchStart
    } catch (err) {
        clearTimeout(timer)
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('timeout')
        }
        throw new Error('unreachable')
    } finally {
        clearTimeout(timer)
    }

    if (!res.ok) {
        throw new Error(`http_${res.status}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('not_html')
    }

    const html = await readCappedBody(res, MAX_SCRAPE_BYTES)
    const contentLengthBytes = html.length

    // 3. Security Headers Inspection
    const isHttps = urlObj.protocol === 'https:'
    const hsts = res.headers.get('strict-transport-security')
    const csp = res.headers.get('content-security-policy')
    const xFrame = res.headers.get('x-frame-options')
    const xContentType = res.headers.get('x-content-type-options')
    const referrerPolicy = res.headers.get('referrer-policy')

    const securityHeaders: SecurityHeaderCheck[] = [
        {
            name: 'Strict-Transport-Security (HSTS)',
            present: !!hsts,
            value: hsts,
            status: hsts ? 'pass' : isHttps ? 'warning' : 'fail',
            description: hsts ? 'Forces browsers to connect over encrypted HTTPS.' : 'Enforces HTTPS encryption to prevent SSL stripping.'
        },
        {
            name: 'Content-Security-Policy (CSP)',
            present: !!csp,
            value: csp ? (csp.length > 60 ? csp.slice(0, 57) + '...' : csp) : null,
            status: csp ? 'pass' : 'warning',
            description: csp ? 'Restricts resource loading to mitigate XSS attacks.' : 'Prevents cross-site scripting and unauthorized script execution.'
        },
        {
            name: 'X-Frame-Options',
            present: !!xFrame,
            value: xFrame,
            status: xFrame ? 'pass' : 'warning',
            description: xFrame ? 'Protects visitors from clickjacking embedding.' : 'Helps protect the site from clickjacking attacks.'
        },
        {
            name: 'X-Content-Type-Options',
            present: !!xContentType,
            value: xContentType,
            status: xContentType?.toLowerCase().includes('nosniff') ? 'pass' : 'warning',
            description: xContentType ? 'Prevents MIME-type sniffing by browsers.' : 'Disallows browsers from MIME-sniffing away from declared content-type.'
        },
        {
            name: 'Referrer-Policy',
            present: !!referrerPolicy,
            value: referrerPolicy,
            status: referrerPolicy ? 'pass' : 'warning',
            description: referrerPolicy ? 'Controls referrer information sent in outbound links.' : 'Protects user privacy across external link navigations.'
        }
    ]

    let securityScore = isHttps ? 50 : 0
    if (hsts) securityScore += 15
    if (csp) securityScore += 15
    if (xContentType?.toLowerCase().includes('nosniff')) securityScore += 10
    if (xFrame) securityScore += 5
    if (referrerPolicy) securityScore += 5
    securityScore = Math.min(100, securityScore)

    // 4. HTML Extraction & Heuristics
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
    const description = metaDescMatch ? metaDescMatch[1].trim() : ''

    const htmlTagMatch = html.match(/<html[^>]*>/i)
    const lang = htmlTagMatch ? extractAttr(htmlTagMatch[0], 'lang') : null

    const charsetMatch = html.match(/<meta[^>]+charset=["']([^"']*)["']/i)
    const charset = charsetMatch ? charsetMatch[1].trim() : (html.includes('charset=') ? 'utf-8' : null)

    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
                           html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i)
    const canonical = canonicalMatch ? canonicalMatch[1].trim() : null

    // OpenGraph & Twitter
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : null

    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)
    const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : null

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)
    const ogImage = ogImageMatch ? ogImageMatch[1].trim() : null

    const twitterCardMatch = html.match(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i)
    const twitterCard = twitterCardMatch ? twitterCardMatch[1].trim() : null

    const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html)

    // Metric counts
    const scripts = (html.match(/<script\b[^>]*>/gi) || []).length
    const stylesheets = (html.match(/<link\b[^>]+rel=["']stylesheet["'][^>]*>/gi) || []).length
    
    const imgTags = html.match(/<img\b[^>]*>/gi) || []
    const imagesCount = imgTags.length
    let imagesMissingAltCount = 0
    for (const img of imgTags) {
        if (!/alt\s*=\s*["'][^"']*["']/i.test(img)) {
            imagesMissingAltCount++
        }
    }

    const linksCount = (html.match(/<a\b[^>]*>/gi) || []).length
    const h1Count = (html.match(/<h1\b[^>]*>/gi) || []).length
    const domNodesEstimated = Math.max(20, Math.floor((html.match(/<[a-z0-9]+/gi) || []).length * 0.85))

    // 5. Tech Stack Detection
    const techStack: TechItem[] = []
    const lowerHtml = html.toLowerCase()
    const serverHeader = (res.headers.get('server') ?? '').toLowerCase()

    // Frameworks & Generators
    if (lowerHtml.includes('/_next/static') || lowerHtml.includes('__next_data__') || lowerHtml.includes('id="__next"')) {
        techStack.push({ name: 'Next.js', category: 'framework', confidence: 98 })
        techStack.push({ name: 'React', category: 'library', confidence: 98 })
    } else if (lowerHtml.includes('react') || lowerHtml.includes('data-reactroot')) {
        techStack.push({ name: 'React', category: 'library', confidence: 90 })
    }

    if (lowerHtml.includes('astro-island') || lowerHtml.includes('astro.build') || lowerHtml.includes('class="astro-')) {
        techStack.push({ name: 'Astro', category: 'framework', confidence: 99 })
    }

    if (lowerHtml.includes('/_nuxt/') || lowerHtml.includes('__nuxt')) {
        techStack.push({ name: 'Nuxt', category: 'framework', confidence: 98 })
        techStack.push({ name: 'Vue.js', category: 'framework', confidence: 98 })
    } else if (lowerHtml.includes('data-v-') || lowerHtml.includes('vue.js') || lowerHtml.includes('vue.min.js')) {
        techStack.push({ name: 'Vue.js', category: 'framework', confidence: 92 })
    }

    if (lowerHtml.includes('svelte') || lowerHtml.includes('__svelte')) {
        techStack.push({ name: 'Svelte', category: 'framework', confidence: 95 })
    }

    if (lowerHtml.includes('remix') || lowerHtml.includes('__remix')) {
        techStack.push({ name: 'Remix', category: 'framework', confidence: 95 })
    }

    // CMS & Builders
    if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes') || lowerHtml.includes('wordpress')) {
        techStack.push({ name: 'WordPress', category: 'cms', confidence: 99 })
    }

    if (lowerHtml.includes('cdn.shopify.com') || lowerHtml.includes('shopify-buy')) {
        techStack.push({ name: 'Shopify', category: 'cms', confidence: 99 })
    }

    if (lowerHtml.includes('webflow.com') || lowerHtml.includes('data-wf-page')) {
        techStack.push({ name: 'Webflow', category: 'cms', confidence: 99 })
    }

    if (lowerHtml.includes('framer.com') || lowerHtml.includes('framer-') || lowerHtml.includes('__framer__')) {
        techStack.push({ name: 'Framer', category: 'cms', confidence: 98 })
    }

    if (lowerHtml.includes('ghost.org') || lowerHtml.includes('ghost-portal')) {
        techStack.push({ name: 'Ghost', category: 'cms', confidence: 95 })
    }

    // Styling
    if (lowerHtml.includes('tailwind') || lowerHtml.includes('class="flex ') || lowerHtml.includes('class="grid ') || lowerHtml.includes('class="hidden md:')) {
        techStack.push({ name: 'Tailwind CSS', category: 'styling', confidence: 90 })
    }

    if (lowerHtml.includes('bootstrap') || lowerHtml.includes('class="container-fluid')) {
        techStack.push({ name: 'Bootstrap', category: 'styling', confidence: 90 })
    }

    // CDN & Hosting
    if (serverHeader.includes('cloudflare') || res.headers.has('cf-ray')) {
        techStack.push({ name: 'Cloudflare', category: 'cdn', confidence: 100 })
    }

    if (serverHeader.includes('vercel') || res.headers.has('x-vercel-id')) {
        techStack.push({ name: 'Vercel', category: 'hosting', confidence: 100 })
    }

    if (serverHeader.includes('netlify') || res.headers.has('x-nf-request-id')) {
        techStack.push({ name: 'Netlify', category: 'hosting', confidence: 100 })
    }

    if (res.headers.has('x-amz-cf-id') || serverHeader.includes('cloudfront')) {
        techStack.push({ name: 'Amazon CloudFront', category: 'cdn', confidence: 100 })
    }

    if (res.headers.has('x-github-request-id')) {
        techStack.push({ name: 'GitHub Pages', category: 'hosting', confidence: 100 })
    }

    // Analytics
    if (lowerHtml.includes('google-analytics.com') || lowerHtml.includes('googletagmanager.com') || lowerHtml.includes('gtag(')) {
        techStack.push({ name: 'Google Analytics', category: 'analytics', confidence: 95 })
    }

    if (lowerHtml.includes('plausible.io')) {
        techStack.push({ name: 'Plausible Analytics', category: 'analytics', confidence: 98 })
    }

    if (lowerHtml.includes('posthog.com')) {
        techStack.push({ name: 'PostHog', category: 'analytics', confidence: 95 })
    }

    if (lowerHtml.includes('fathom')) {
        techStack.push({ name: 'Fathom Analytics', category: 'analytics', confidence: 95 })
    }

    // 6. Multi-Pillar Scoring Algorithms

    // Performance (0-100)
    let perf = 100
    if (ttfbMs > 800) perf -= 25
    else if (ttfbMs > 400) perf -= 15
    else if (ttfbMs > 200) perf -= 5

    if (contentLengthBytes > 500 * 1024) perf -= 25
    else if (contentLengthBytes > 200 * 1024) perf -= 15
    else if (contentLengthBytes > 100 * 1024) perf -= 5

    if (scripts > 25) perf -= 20
    else if (scripts > 15) perf -= 10
    else if (scripts > 8) perf -= 5

    if (stylesheets > 8) perf -= 10
    else if (stylesheets > 4) perf -= 5

    if (domNodesEstimated > 1500) perf -= 15
    else if (domNodesEstimated > 800) perf -= 5

    perf = Math.max(30, Math.min(100, perf))

    // Accessibility (0-100)
    let a11y = 100
    if (!lang) a11y -= 25
    if (!/<meta[^>]+name=["']viewport["']/i.test(html)) a11y -= 25
    if (imagesCount > 0 && imagesMissingAltCount > 0) {
        const ratio = imagesMissingAltCount / imagesCount
        a11y -= Math.round(ratio * 30)
    }
    if (!title) a11y -= 20
    if (h1Count === 0) a11y -= 10
    a11y = Math.max(30, Math.min(100, a11y))

    // Best Practices (0-100)
    let bp = 100
    if (!isHttps) bp -= 40
    if (!hsts) bp -= 15
    if (!csp) bp -= 10
    if (!xContentType?.toLowerCase().includes('nosniff')) bp -= 10
    if (!html.toLowerCase().startsWith('<!doctype html')) bp -= 15
    if (!charset) bp -= 10
    bp = Math.max(30, Math.min(100, bp))

    // SEO (0-100)
    let seo = 100
    if (!title) seo -= 30
    else if (title.length < 15 || title.length > 70) seo -= 10

    if (!description) seo -= 25
    else if (description.length < 50 || description.length > 170) seo -= 10

    if (!canonical) seo -= 15
    if (!ogTitle || !ogImage) seo -= 15
    if (h1Count === 0) seo -= 15
    else if (h1Count > 1) seo -= 5
    if (!hasJsonLd) seo -= 5
    seo = Math.max(35, Math.min(100, seo))

    // Overall composite
    const overall = Math.round(perf * 0.3 + a11y * 0.25 + bp * 0.2 + seo * 0.25)

    // 7. Actionable Findings Generation
    const findings: Finding[] = []

    // Performance findings
    if (ttfbMs <= 250) {
        findings.push({
            id: 'perf-fast-ttfb',
            category: 'performance',
            severity: 'pass',
            title: `Blazing Fast Response Time (${ttfbMs}ms)`,
            description: 'The server responded quickly, ensuring users receive the initial HTML payload immediately.'
        })
    } else {
        findings.push({
            id: 'perf-slow-ttfb',
            category: 'performance',
            severity: ttfbMs > 600 ? 'high' : 'medium',
            title: `Server Response Time Could Be Optimized (${ttfbMs}ms)`,
            description: 'Time to First Byte (TTFB) is higher than recommended (>200ms).',
            recommendation: 'Use edge caching, CDN acceleration (e.g. Cloudflare), or optimize server database queries.'
        })
    }

    if (scripts > 15) {
        findings.push({
            id: 'perf-many-scripts',
            category: 'performance',
            severity: 'medium',
            title: `High Number of JavaScript Resources (${scripts} scripts)`,
            description: 'Excessive script tags can block browser rendering and hurt Core Web Vitals (TBT/INP).',
            recommendation: 'Bundle scripts, defer non-critical scripts with defer or async, or remove unused dependencies.'
        })
    }

    // Accessibility findings
    if (!lang) {
        findings.push({
            id: 'a11y-missing-lang',
            category: 'accessibility',
            severity: 'high',
            title: 'Missing HTML lang Attribute',
            description: 'Screen readers and assistive software require a valid language code to pronounce text properly.',
            recommendation: 'Add lang="en" (or the appropriate language code) to the root <html> element.'
        })
    } else {
        findings.push({
            id: 'a11y-valid-lang',
            category: 'accessibility',
            severity: 'pass',
            title: `Language Declared (${lang})`,
            description: 'The document explicitly declares its language for assistive technologies.'
        })
    }

    if (imagesMissingAltCount > 0) {
        findings.push({
            id: 'a11y-missing-alt',
            category: 'accessibility',
            severity: imagesMissingAltCount > 3 ? 'high' : 'medium',
            title: `${imagesMissingAltCount} Image(s) Missing alt Text`,
            description: 'Images without accessible alt descriptions prevent visually impaired users from understanding visual content.',
            recommendation: 'Add descriptive alt="..." attributes to all meaningful images, or alt="" for purely decorative images.'
        })
    }

    // Best Practices & Security findings
    if (isHttps) {
        findings.push({
            id: 'sec-https',
            category: 'best-practices',
            severity: 'pass',
            title: 'Encrypted HTTPS Connection',
            description: 'The site transmits data securely over TLS/SSL.'
        })
    } else {
        findings.push({
            id: 'sec-no-https',
            category: 'best-practices',
            severity: 'high',
            title: 'Site Does Not Enforce HTTPS',
            description: 'Data transmitted over unencrypted HTTP is vulnerable to interception and tampering.',
            recommendation: 'Acquire and configure a free TLS certificate via Let\'s Encrypt or Cloudflare.'
        })
    }

    if (hsts) {
        findings.push({
            id: 'sec-hsts',
            category: 'security',
            severity: 'pass',
            title: 'Strict-Transport-Security (HSTS) Active',
            description: 'Browsers are permanently instructed to only communicate via HTTPS.'
        })
    } else {
        findings.push({
            id: 'sec-no-hsts',
            category: 'security',
            severity: 'medium',
            title: 'HSTS Header Not Configured',
            description: 'Missing Strict-Transport-Security leaves users vulnerable to SSL stripping attacks.',
            recommendation: 'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload in your server headers.'
        })
    }

    // SEO findings
    if (title && title.length >= 20 && title.length <= 70) {
        findings.push({
            id: 'seo-title-pass',
            category: 'seo',
            severity: 'pass',
            title: `Well-Optimized Page Title (${title.length} chars)`,
            description: `"${title}" fits cleanly within standard search engine snippet displays.`
        })
    } else if (!title) {
        findings.push({
            id: 'seo-no-title',
            category: 'seo',
            severity: 'high',
            title: 'Missing Page Title Tag',
            description: 'The <title> tag is the most crucial on-page SEO element.',
            recommendation: 'Add a distinct, descriptive <title> tag between 30 and 60 characters.'
        })
    }

    if (ogImage) {
        findings.push({
            id: 'seo-og-image',
            category: 'seo',
            severity: 'pass',
            title: 'Social Share Image Configured',
            description: 'Open Graph og:image is present for social media previews.'
        })
    } else {
        findings.push({
            id: 'seo-no-og-image',
            category: 'seo',
            severity: 'low',
            title: 'Missing Social Share Image (og:image)',
            description: 'Without a preview image, shares on Twitter/LinkedIn/Discord will lack a visual thumbnail.',
            recommendation: 'Add <meta property="og:image" content="https://..."> pointing to a 1200x630 banner.'
        })
    }

    const durationMs = Date.now() - startTime

    return {
        scanId,
        url: normalized,
        domain,
        status: 'complete',
        timestamp: new Date().toISOString(),
        durationMs,
        scores: {
            overall,
            performance: perf,
            accessibility: a11y,
            bestPractices: bp,
            seo
        },
        metrics: {
            ttfbMs,
            contentLengthBytes,
            domNodesEstimated,
            scriptsCount: scripts,
            stylesheetsCount: stylesheets,
            imagesCount,
            imagesMissingAltCount,
            linksCount
        },
        meta: {
            title,
            description,
            lang,
            charset,
            canonical,
            ogTitle,
            ogDescription,
            ogImage,
            twitterCard,
            hasJsonLd
        },
        security: {
            isHttps,
            headers: securityHeaders,
            score: securityScore
        },
        techStack,
        findings
    }
}
