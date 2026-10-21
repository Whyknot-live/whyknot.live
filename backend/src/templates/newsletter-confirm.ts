/**
 * Double-opt-in confirm email for the 5-3-1 newsletter.
 * Matches the issue template's voice: short, declarative, no puns, no emojis.
 * The confirm link is the only action — one click, no login.
 */
import { escapeHtml } from './newsletter-531'

export interface ConfirmEmailInput {
    email: string
    confirmUrl: string
}

export function buildConfirmEmailHtml({ email, confirmUrl }: ConfirmEmailInput): string {
    const safeEmail = escapeHtml(email)
    const safeUrl = escapeHtml(confirmUrl)
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="x-apple-disable-reformatting">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Confirm your subscription</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-font-smoothing: antialiased; background-color: #f2fbfa;">
    <div role="article" aria-roledescription="email" aria-label="Confirm your WhyKnot 5-3-1 subscription" lang="en">
        <table align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0; padding: 0; width: 100%; background-color: #f2fbfa;">
            <tr>
                <td align="center" style="padding: 32px 16px;">
                    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 16px;">
                        <tr>
                            <td style="padding: 40px 48px 32px; text-align: center;">
                                <div style="font-size: 28px; color: #20c5b5; letter-spacing: 0.02em; text-transform: uppercase;">whyknot.live</div>
                                <h1 style="margin: 16px 0 0; font-size: 26px; line-height: 1.25; color: #092a28;">One click confirms your Sunday roundup.</h1>
                                <p style="margin: 12px 0 0; font-size: 15px; line-height: 1.6; color: #486664;">
                                    You're receiving the WhyKnot 5-3-1 at ${safeEmail}. Confirm and five rising sites, three editor deals and one underdog land in your inbox every week.
                                </p>
                                <p style="margin: 24px 0 0;"><a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: 700; color: #042726; background-color: #20c5b5; text-decoration: none; border-radius: 8px;">Confirm subscription</a></p>
                                <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: #486664;">
                                    Or paste this link:<br><a href="${safeUrl}" style="color: #0aa895; word-break: break-all;">${safeUrl}</a>
                                </p>
                                <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid rgba(78,104,102,0.28); font-size: 12px; line-height: 1.6; color: #486664;">
                                    Didn't request this? Ignore this email — nothing was subscribed.
                                </p>
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

export function buildConfirmEmailText({ email, confirmUrl }: ConfirmEmailInput): string {
    return `
WhyKnot 5-3-1 — confirm your subscription

One click confirms the Sunday roundup for ${email}.
Five rising sites, three editor deals, one underdog, every week.

Confirm: ${confirmUrl}

Didn't request this? Ignore this email — nothing was subscribed.
WhyKnot Live · hello@whyknot.live
    `.trim()
}
