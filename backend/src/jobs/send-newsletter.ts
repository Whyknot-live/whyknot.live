/**
 * Sunday-roundup send job (stub for P1).
 *
 * ESP decision: stay on Resend for P1 (see watchlists-alerts.md ESP note —
 * Indian ESP evaluation deferred until scale). Real Resend batch send is
 * marked TODO below and must not run until the ESP scale decision lands.
 *
 * No cron wiring in this slice (see integrator patch note for admin.ts
 * preview/send endpoints + scheduler).
 */
import type { NewsletterEntry, NewsletterIssue, NewsletterSponsorSlot } from '../templates/newsletter-531'
import { validateEnv } from '../utils/env'
import { connectMongo, getDb } from '../utils/mongo'
import { logger } from '../utils/logger'

export interface BuildIssueMeta {
    number?: number
    slug?: string
    subject?: string
    date?: string
    intro?: string
}

/**
 * Pure assembler: 5 rising + 3 deals + 1 underdog (+ optional sponsor slot).
 * Throws on wrong counts so miscounts fail loudly in tests, not in inboxes.
 */
export async function buildIssueFromContent(
    rising: NewsletterEntry[],
    deals: NewsletterEntry[],
    underdog: NewsletterEntry,
    sponsor?: NewsletterSponsorSlot,
    meta: BuildIssueMeta = {},
): Promise<NewsletterIssue> {
    if (!Array.isArray(rising) || rising.length !== 5) {
        throw new Error(`buildIssueFromContent: expected 5 rising entries, got ${Array.isArray(rising) ? rising.length : 'non-array'}`)
    }
    if (!Array.isArray(deals) || deals.length !== 3) {
        throw new Error(`buildIssueFromContent: expected 3 deal entries, got ${Array.isArray(deals) ? deals.length : 'non-array'}`)
    }
    if (!underdog || typeof underdog.name !== 'string' || typeof underdog.url !== 'string') {
        throw new Error('buildIssueFromContent: underdog entry is required (name + url)')
    }

    const date = meta.date ?? new Date().toISOString().slice(0, 10)
    const number = meta.number ?? 0
    const slug = meta.slug ?? `issue-${number || date}`
    const subject = meta.subject ?? `5 rising · 3 deals · 1 underdog · ${date}`

    return {
        number,
        slug,
        subject,
        date,
        ...(meta.intro ? { intro: meta.intro } : {}),
        rising,
        deals,
        underdog,
        ...(sponsor ? { sponsor } : {}),
    }
}

/**
 * Dry-run entrypoint. Counts confirmed subs and logs — never sends in P1.
 */
export async function main(): Promise<{ dryRun: true; subs: number }> {
    try {
        const env = validateEnv()
        await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
        const db = getDb()
        const subs = await db.collection('newsletter_subscribers').countDocuments({ status: 'confirmed' })
        logger.info(`dry-run: ${subs} subs`, { job: 'send-newsletter' })

        // TODO(after ESP scale decision): real Resend batch send here.
        // - Fetch latest assembled issue from `newsletter_issues`
        // - Render via buildNewsletterHtml/buildNewsletterText
        // - Batch via Resend with per-recipient unsubscribe token + UTM params
        // - Record rows in `newsletter_sends` for open/CTR + sponsor-slot CTR split

        return { dryRun: true, subs }
    } catch (err) {
        logger.warn('send-newsletter dry-run without db (reporting 0)', {
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        logger.info('dry-run: 0 subs', { job: 'send-newsletter' })
        return { dryRun: true, subs: 0 }
    }
}
