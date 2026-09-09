/**
 * Newsletter 5-3-1 issue templates (Resend).
 * P1 ESP decision: stay on Resend; Indian ESP evaluation deferred until scale.
 * Reuses the XSS-escaped template pattern from waitlist-welcome.ts.
 */

export interface NewsletterEntry {
    name: string
    tagline: string
    url: string
    slug?: string
    score?: number
    votes?: number
    sponsored?: boolean
    blurb?: string
}

export interface NewsletterSponsorSlot {
    name: string
    tagline: string
    url: string
    /** true = paid buyer, false = house fallback (still labeled Sponsored). */
    sponsored: boolean
}

export interface NewsletterIssue {
    number: number
    slug: string
    subject: string
    date: string
    intro?: string
    rising: NewsletterEntry[]
    deals: NewsletterEntry[]
    underdog: NewsletterEntry
    sponsor?: NewsletterSponsorSlot
}

export interface NewsletterRenderOptions {
    unsubscribeUrl?: string
    browserUrl?: string
}

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

const HOUSE_SPONSOR: NewsletterSponsorSlot = {
    name: 'Your product in front of makers',
    tagline: 'The 5-3-1 roundup reaches builders every Sunday. Claim this slot.',
    url: 'https://www.whyknot.live/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-531',
    sponsored: false,
}

function entryBlock(entry: NewsletterEntry, index: string): string {
    const name = escapeHtml(entry.name)
    const tagline = escapeHtml(entry.tagline)
    const url = escapeHtml(entry.url)
    const blurb = entry.blurb ? `<p style="margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #486664;">${escapeHtml(entry.blurb)}</p>` : ''
    const meta: string[] = []
    if (typeof entry.score === 'number') meta.push(`Score ${entry.score}`)
    if (typeof entry.votes === 'number') meta.push(`${entry.votes} votes`)
    const metaLine = meta.length > 0 ? `<p style="margin: 8px 0 0; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #486664;">${escapeHtml(meta.join(' · '))}</p>` : ''
    const badge = entry.sponsored
        ? `<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #042726; background-color: #fff3bf; border: 1px solid #ead27a; border-radius: 999px; vertical-align: middle;">Sponsored</span>`
        : ''
    return `
        <tr>
            <td style="padding: 16px 0; border-bottom: 1px solid rgba(78,104,102,0.16);">
                <p style="margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #486664;">${escapeHtml(index)}</p>
                <p style="margin: 6px 0 0; font-size: 18px; font-weight: 700; color: #092a28;">
                    <a href="${url}" style="color: #092a28; text-decoration: none;">${name}</a>${badge}
                </p>
                <p style="margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: #092a28;">${tagline}</p>
                ${blurb}
                ${metaLine}
                <p style="margin: 10px 0 0;"><a href="${url}" style="font-size: 14px; color: #0aa895; text-decoration: none;">Visit site →</a></p>
            </td>
        </tr>
    `
}

function sponsorBlock(sponsor: NewsletterSponsorSlot): string {
    const name = escapeHtml(sponsor.name)
    const tagline = escapeHtml(sponsor.tagline)
    const url = escapeHtml(sponsor.url)
    return `
        <tr>
            <td style="padding: 20px; background-color: #fffdf0; border: 1px dashed #d9c25a; border-radius: 12px;">
                <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7a6410;">
                    Sponsored
                </p>
                <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #092a28;">
                    <a href="${url}" style="color: #092a28; text-decoration: none;">${name}</a>
                </p>
                <p style="margin: 4px 0 12px; font-size: 14px; line-height: 1.6; color: #486664;">${tagline}</p>
                <a href="${url}" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 700; color: #042726; background-color: #20c5b5; text-decoration: none; border-radius: 8px;">Learn more</a>
            </td>
        </tr>
    `
}

export function buildNewsletterHtml(issue: NewsletterIssue, opts: NewsletterRenderOptions = {}): string {
    const colors = {
        primary: '#20c5b5',
        primaryDark: '#042726',
        surface: '#ffffff',
        onSurface: '#092a28',
        onSurfaceVariant: '#486664',
        outline: 'rgba(78,104,102,0.28)',
    }
    const sponsor = issue.sponsor ?? HOUSE_SPONSOR
    const browserUrl = escapeHtml(opts.browserUrl ?? `https://www.whyknot.live/newsletter/${issue.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-531`)
    const unsubscribeUrl = escapeHtml(opts.unsubscribeUrl ?? 'https://www.whyknot.live/newsletter?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-531#unsubscribe')
    const subject = escapeHtml(issue.subject)
    const intro = issue.intro ? escapeHtml(issue.intro) : 'Five fastest-rising, three editor deals, one underdog. The Sunday roundup that writes itself from our data.'
    const risingRows = issue.rising.map((entry, i) => entryBlock(entry, `Rising ${i + 1}`)).join('')
    const dealRows = issue.deals.map((entry, i) => entryBlock(entry, `Deal ${i + 1}`)).join('')
    const underdogRow = entryBlock(issue.underdog, 'Underdog')

    return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
    <meta charset="utf-8">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; word-break: break-word; -webkit-font-smoothing: antialiased; background-color: #f2fbfa;">
    <div role="article" aria-roledescription="email" aria-label="${subject}" lang="en">
        <div style="display: none;">${subject} · 5 rising, 3 deals, 1 underdog.&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>
        <table align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0; padding: 0; width: 100%; background-color: #f2fbfa;">
            <tr>
                <td align="center" style="padding: 24px 16px;">
                    <p style="margin: 0 0 12px; font-size: 12px; color: ${colors.onSurfaceVariant};">
                        <a href="${browserUrl}" style="color: ${colors.primary}; text-decoration: none;">View in browser</a>
                    </p>
                    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; width: 600px; max-width: 100%; background-color: ${colors.surface}; border-radius: 16px;">
                        <tr>
                            <td style="padding: 40px 48px 16px; text-align: center;">
                                <div style="font-size: 28px; color: ${colors.primary}; letter-spacing: 0.02em; text-transform: uppercase;">whyknot.live</div>
                                <p style="margin: 12px 0 0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: ${colors.onSurfaceVariant};">Issue #${issue.number} · ${escapeHtml(issue.date)}</p>
                                <h1 style="margin: 12px 0 0; font-size: 30px; line-height: 1.2; color: ${colors.onSurface};">${subject}</h1>
                                <p style="margin: 12px 0 0; font-size: 15px; line-height: 1.6; color: ${colors.onSurfaceVariant};">${intro}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 48px;">
                                <h2 style="margin: 24px 0 0; font-size: 20px; color: ${colors.onSurface};">5 fastest-rising</h2>
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${risingRows}</table>
                            </td>
                        </tr>
                        <tr><td style="padding: 16px 48px 0;">${sponsorBlock(sponsor)}</td></tr>
                        <tr>
                            <td style="padding: 0 48px;">
                                <h2 style="margin: 24px 0 0; font-size: 20px; color: ${colors.onSurface};">3 editor deals</h2>
                                <p style="margin: 6px 0 0; font-size: 12px; color: ${colors.onSurfaceVariant};">Sponsored slots are always labeled Sponsored. Money never buys a score. See our <a href="https://www.whyknot.live/legal/methodology?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=newsletter-531" style="color: ${colors.primary};">methodology</a>.</p>
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${dealRows}</table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 48px 8px;">
                                <h2 style="margin: 24px 0 0; font-size: 20px; color: ${colors.onSurface};">1 underdog</h2>
                                <p style="margin: 6px 0 0; font-size: 13px; color: ${colors.onSurfaceVariant};">Low votes, high score: our voice.</p>
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${underdogRow}</table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 24px 48px 32px; border-top: 1px solid ${colors.outline};">
                                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                                    You're receiving the WhyKnot 5-3-1 Sunday roundup. <a href="${unsubscribeUrl}" style="color: ${colors.primary};">Unsubscribe in one click</a> (no login needed).
                                </p>
                                <p style="margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                                    WhyKnot Live ·hello@whyknot.live · <a href="https://www.whyknot.live/legal/methodology?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=newsletter-531" style="color: ${colors.primary};">How we score</a>
                                </p>
                                <p style="margin: 12px 0 0; font-size: 12px; color: ${colors.onSurfaceVariant};">© ${new Date().getFullYear()} whyknot.live. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
    `.trim()
}

export function buildNewsletterText(issue: NewsletterIssue, opts: NewsletterRenderOptions = {}): string {
    const sponsor = issue.sponsor ?? HOUSE_SPONSOR
    const browserUrl = opts.browserUrl ?? `https://www.whyknot.live/newsletter/${issue.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-531`
    const unsubscribeUrl = opts.unsubscribeUrl ?? 'https://www.whyknot.live/newsletter#unsubscribe'
    const line = (entry: NewsletterEntry, label: string): string => {
        const flag = entry.sponsored ? ' [Sponsored]' : ''
        const meta: string[] = []
        if (typeof entry.score === 'number') meta.push(`score ${entry.score}`)
        if (typeof entry.votes === 'number') meta.push(`${entry.votes} votes`)
        const metaStr = meta.length > 0 ? ` (${meta.join(', ')})` : ''
        return `${label}: ${entry.name}${flag}${metaStr}\n${entry.tagline}\n${entry.url}${entry.blurb ? `\n${entry.blurb}` : ''}`
    }
    return `
WhyKnot 5-3-1 | Issue #${issue.number} (${issue.date})
${issue.subject}

View in browser: ${browserUrl}

${issue.intro ?? 'Five fastest-rising, three editor deals, one underdog.'}

--- 5 FASTEST-RISING ---
${issue.rising.map((entry, i) => line(entry, `${i + 1}`)).join('\n\n')}

--- SPONSORED ---
Sponsored: ${sponsor.name}\n${sponsor.tagline}\n${sponsor.url}

--- 3 EDITOR DEALS ---
${issue.deals.map((entry, i) => line(entry, `${i + 1}`)).join('\n\n')}
(Sponsored slots are always labeled Sponsored. Money never buys a score: https://www.whyknot.live/legal/methodology)

--- 1 UNDERDOG ---
${line(issue.underdog, 'Underdog')}

---
You're receiving the WhyKnot Sunday roundup. Unsubscribe in one click (no login): ${unsubscribeUrl}
WhyKnot Live · hello@whyknot.live · How we score: https://www.whyknot.live/legal/methodology
© ${new Date().getFullYear()} whyknot.live
    `.trim()
}
