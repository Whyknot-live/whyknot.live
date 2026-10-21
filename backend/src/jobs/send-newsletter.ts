/**
 * Sunday-roundup send job.
 *
 * ESP decision: stay on Resend (see watchlists-alerts.md ESP note —
 * Indian ESP evaluation deferred until scale). The admin send endpoint
 * (routes/admin.ts -> sendIssueToSubscribers) is the weekly trigger; this
 * module holds the pure assembler + the send orchestration so both are
 * testable without a live provider.
 *
 * No cron wiring in this slice — the admin endpoint is the scheduler.
 */
import type { NewsletterEntry, NewsletterIssue, NewsletterSponsorSlot } from '../templates/newsletter-531'
import { buildNewsletterHtml, buildNewsletterText } from '../templates/newsletter-531'
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
 * Send one assembled issue to confirmed subscribers.
 *
 * Pure orchestration: rendering + per-recipient send, no DB. The sender is
 * injected so tests prove rendering and failure handling without Resend.
 * Sends are sequential on purpose — the Resend free tier is 100/day and a
 * weekly roundup must never race a burst limit.
 */
export interface NewsletterSendRecipient {
    email: string
    unsubscribeToken: string
}

export interface NewsletterSendAttempt {
    email: string
    ok: boolean
    error?: string
}

export interface NewsletterSendRun {
    attempts: NewsletterSendAttempt[]
    sent: number
    failed: number
    /** True when the rendered issue carried a paid sponsor slot. */
    sponsor: boolean
}

export async function sendIssueToSubscribers(args: {
    issue: NewsletterIssue
    recipients: NewsletterSendRecipient[]
    send: (email: string, subject: string, html: string, text: string) => Promise<boolean>
    siteBase?: string
}): Promise<NewsletterSendRun> {
    const base = args.siteBase ?? 'https://www.whyknot.live'
    const sponsor = Boolean(args.issue.sponsor?.sponsored)
    const attempts: NewsletterSendAttempt[] = []

    for (const recipient of args.recipients) {
        const unsubscribeUrl = `${base}/newsletter/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}`
        const html = buildNewsletterHtml(args.issue, { unsubscribeUrl })
        const text = buildNewsletterText(args.issue, { unsubscribeUrl })
        try {
            const ok = await args.send(recipient.email, args.issue.subject, html, text)
            attempts.push({ email: recipient.email, ok })
        } catch (err) {
            attempts.push({
                email: recipient.email,
                ok: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            })
        }
    }

    return {
        attempts,
        sent: attempts.filter((a) => a.ok).length,
        failed: attempts.filter((a) => !a.ok).length,
        sponsor,
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

        return { dryRun: true, subs }
    } catch (err) {
        logger.warn('send-newsletter dry-run without db (reporting 0)', {
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        logger.info('dry-run: 0 subs', { job: 'send-newsletter' })
        return { dryRun: true, subs: 0 }
    }
}
