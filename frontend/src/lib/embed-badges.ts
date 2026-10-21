/**
 * Embed badge snippets (feature 04) — zero-JS, self-contained HTML that makers
 * paste into their own sites. Pure functions so every variant is testable.
 *
 * Rules honored:
 * - C3: badges reflect score/rank/editorial state only. Nothing here is sold.
 * - Zero-JS: pure HTML + CSS. The 'auto' theme uses a prefers-color-scheme
 *   media query inside the snippet — no script, works in plain HTML.
 * - UTM on every outbound link so embed click-throughs are measurable.
 */
export type EmbedSize = 'sm' | 'md' | 'lg'
export type EmbedTheme = 'light' | 'dark' | 'auto'

export interface EmbedScoreInput {
    slug: string
    name: string
    score: number
}

export interface EmbedVerifiedInput {
    slug: string
    name: string
}

export interface EmbedLaunchInput {
    slug: string
    name: string
    rank: number
    badge?: string
}

export interface EmbedOptions {
    size?: EmbedSize
    theme?: EmbedTheme
}

const UTM = 'utm_source=embed&utm_medium=badge&utm_campaign=whyknot-badges'

// Token-matched colors (tokens.css): light surface/text/border + dark pair.
const LIGHT = {
    bg: '#ffffff',
    border: '#cfe4e2',
    text: '#092a28',
    muted: '#486664',
    accent: '#0aa895',
} as const

const DARK = {
    bg: '#163330',
    border: '#1a4946',
    text: '#c5efe9',
    muted: '#7bd2c6',
    accent: '#7bd2c6',
} as const

const SIZES: Record<EmbedSize, { fontSize: string; padY: string; padX: string; gap: string }> = {
    sm: { fontSize: '10px', padY: '3px', padX: '8px', gap: '4px' },
    md: { fontSize: '12px', padY: '5px', padX: '12px', gap: '6px' },
    lg: { fontSize: '14px', padY: '7px', padX: '16px', gap: '8px' },
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

export function embedProfileUrl(kind: 'sites' | 'launches', slug: string): string {
    return `https://www.whyknot.live/${kind}/${slug}?${UTM}`
}

/**
 * The <style> block for a badge. 'auto' emits a prefers-color-scheme dark
 * override; 'light'/'dark' emit the single theme. Class names are unique per
 * slug so several badges can live on one page without colliding.
 */
interface BadgePalette {
    bg: string
    border: string
    text: string
    muted: string
    accent: string
}

function badgeStyle(cls: string, size: EmbedSize, theme: EmbedTheme): string {
    const s = SIZES[size]
    const base = (c: BadgePalette) =>
        `.${cls}{display:inline-flex;align-items:center;gap:${s.gap};padding:${s.padY} ${s.padX};` +
        `border:1px solid ${c.border};border-radius:999px;background:${c.bg};color:${c.text};` +
        `font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:${s.fontSize};` +
        `font-weight:600;line-height:1.2;text-decoration:none;}` +
        `.${cls} .wk-embed-accent{color:${c.accent};font-weight:800;}` +
        `.${cls} .wk-embed-muted{color:${c.muted};font-weight:500;}`

    if (theme === 'light') return `<style>${base(LIGHT)}</style>`
    if (theme === 'dark') return `<style>${base(DARK)}</style>`
    return `<style>${base(LIGHT)}@media (prefers-color-scheme:dark){${base(DARK)}}</style>`
}

function badgeLink(cls: string, kind: 'sites' | 'launches', slug: string): string {
    return `<a href="${escapeHtml(embedProfileUrl(kind, slug))}" class="${cls}" target="_blank" rel="noopener noreferrer">`
}

/** Score badge — every scored site can embed this one. */
export function buildScoreBadgeHtml(input: EmbedScoreInput, opts: EmbedOptions = {}): string {
    const size = opts.size ?? 'md'
    const theme = opts.theme ?? 'auto'
    const cls = `wk-embed-score-${input.slug}`
    const inner = `<span class="wk-embed-accent">${input.score}</span><span class="wk-embed-muted">WhyKnot score</span>`
    return `${badgeStyle(cls, size, theme)}\n${badgeLink(cls, 'sites', input.slug)}${inner}</a>`
}

/** Verified badge — only for sites that earned the domain-ownership state. */
export function buildVerifiedBadgeHtml(input: EmbedVerifiedInput, opts: EmbedOptions = {}): string {
    const size = opts.size ?? 'md'
    const theme = opts.theme ?? 'auto'
    const cls = `wk-embed-verified-${input.slug}`
    const check = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex:none;"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    const inner = `<span class="wk-embed-accent">${check}</span><span class="wk-embed-muted">Verified on WhyKnot</span>`
    return `${badgeStyle(cls, size, theme)}\n${badgeLink(cls, 'sites', input.slug)}${inner}</a>`
}

/** Editor's Pick badge — only for launches that carry the editorial badge. */
export function buildEditorsPickBadgeHtml(input: EmbedLaunchInput, opts: EmbedOptions = {}): string {
    if (input.badge !== "Editor's Pick") return ''
    const size = opts.size ?? 'md'
    const theme = opts.theme ?? 'auto'
    const cls = `wk-embed-pick-${input.slug}`
    const star = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex:none;"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.87L17.8 21 12 17.77 6.2 21l1.05-6.83L2.5 9.3l6.6-1.04L12 2z"/></svg>`
    const inner = `<span class="wk-embed-accent">${star}</span><span>WhyKnot Editor's Pick</span>`
    return `${badgeStyle(cls, size, theme)}\n${badgeLink(cls, 'launches', input.slug)}${inner}</a>`
}

/** Rank badge — every launch has a board rank. */
export function buildRankBadgeHtml(input: EmbedLaunchInput, opts: EmbedOptions = {}): string {
    const size = opts.size ?? 'md'
    const theme = opts.theme ?? 'auto'
    const cls = `wk-embed-rank-${input.slug}`
    const inner = `<span class="wk-embed-accent">#${input.rank}</span><span class="wk-embed-muted">on WhyKnot</span>`
    return `${badgeStyle(cls, size, theme)}\n${badgeLink(cls, 'launches', input.slug)}${inner}</a>`
}
