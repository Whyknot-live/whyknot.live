import { Resend } from 'resend'
import { generateWaitlistWelcomeEmail, generateWaitlistWelcomeText } from '../templates/waitlist-welcome'
import { emailLogger } from './logger'

/**
 * Send welcome email to new waitlist subscriber using Resend
 * Optimized for free tier: 100 emails/day, 3,000 emails/month
 * 
 * @param email - Subscriber email address
 * @param position - Optional position in waitlist
 */
export async function sendWaitlistWelcomeEmail(email: string, position?: number): Promise<void> {
  // Only send if email is enabled
  if (process.env.ENABLE_EMAIL !== '1') {
    emailLogger.debug('Email disabled, skipping send', { email })
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    emailLogger.warn('RESEND_API_KEY not configured, skipping email send')
    return
  }

  try {
    emailLogger.debug('Preparing welcome email', { email, position })

    const resend = new Resend(apiKey)

    // Generate email content
    const htmlContent = generateWaitlistWelcomeEmail({ email, position })
    const textContent = generateWaitlistWelcomeText({ email, position })

    // Send email with Resend
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'whyknot.live <noreply@whyknot.live>',
      to: [email],
      subject: 'Welcome to whyknot.live',
      html: htmlContent,
      text: textContent,
      replyTo: process.env.EMAIL_REPLY_TO,
      tags: [
        { name: 'category', value: 'waitlist' },
        { name: 'type', value: 'welcome' }
      ],
      headers: {
        'X-Entity-Ref-ID': `waitlist-${Date.now()}`, // For tracking
      }
    })

    if (error) {
      emailLogger.error('Failed to send email via Resend', {
        email,
        error: error.message
      })
      return
    }

    emailLogger.info('Email sent successfully', {
      email,
      emailId: data?.id,
      position
    })
  } catch (err) {
    emailLogger.error('Email send error', {
      email,
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    // Don't throw - email failures shouldn't break the API
  }
}

/**
 * Fire-and-forget wrapper for sending welcome emails
 * Used in API endpoints to avoid blocking the response
 */
export function sendWelcomeEmailIfEnabled(email: string, position?: number): void {
  void sendWaitlistWelcomeEmail(email, position)
}

/**
 * Public site base for links inside emails. Overridable for staging;
 * production is the canonical www host (commit c0f50b6).
 */
export function getSiteBase(): string {
  return process.env.PUBLIC_SITE_URL ?? 'https://www.whyknot.live'
}

export interface NewsletterEmailResult {
    ok: boolean
    reason?: 'disabled' | 'no_key' | 'rejected' | 'error'
    error?: string
}

/**
 * Send one transactional newsletter email (confirm or issue) via Resend.
 * Never throws — email failures must never break an API response.
 * Returns a structured result so callers can record honest send status.
 */
export async function sendNewsletterEmail(args: {
    to: string
    subject: string
    html: string
    text: string
    tags: Array<{ name: string; value: string }>
}): Promise<NewsletterEmailResult> {
    if (process.env.ENABLE_EMAIL !== '1') {
        emailLogger.debug('Email disabled, skipping newsletter send', { to: args.to })
        return { ok: false, reason: 'disabled' }
    }
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        emailLogger.warn('RESEND_API_KEY not configured, skipping newsletter send', { to: args.to })
        return { ok: false, reason: 'no_key' }
    }
    try {
        const resend = new Resend(apiKey)
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'whyknot.live <noreply@whyknot.live>',
            to: [args.to],
            subject: args.subject,
            html: args.html,
            text: args.text,
            replyTo: process.env.EMAIL_REPLY_TO,
            tags: args.tags,
        })
        if (error) {
            emailLogger.error('Newsletter email rejected by Resend', { to: args.to, error: error.message })
            return { ok: false, reason: 'rejected', error: error.message }
        }
        emailLogger.info('Newsletter email sent', { to: args.to, emailId: data?.id })
        return { ok: true }
    } catch (err) {
        emailLogger.error('Newsletter email send error', {
            to: args.to,
            error: err instanceof Error ? err.message : 'Unknown error',
        })
        return { ok: false, reason: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
    }
}

/**
 * Send the double-opt-in confirm email. Fire-and-forget: the subscribe
 * response never waits on the mail provider.
 */
export function sendConfirmEmailIfEnabled(email: string, confirmUrl: string): void {
    void (async () => {
        const { buildConfirmEmailHtml, buildConfirmEmailText } = await import('../templates/newsletter-confirm')
        const result = await sendNewsletterEmail({
            to: email,
            subject: 'Confirm your WhyKnot 5-3-1 subscription',
            html: buildConfirmEmailHtml({ email, confirmUrl }),
            text: buildConfirmEmailText({ email, confirmUrl }),
            tags: [
                { name: 'category', value: 'newsletter' },
                { name: 'type', value: 'confirm' },
            ],
        })
        if (!result.ok) {
            emailLogger.warn('Confirm email not delivered', { email, reason: result.reason })
        }
    })()
}
