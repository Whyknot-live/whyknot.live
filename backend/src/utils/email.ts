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
