/**
 * Professional Waitlist Welcome Email Template
 * Designed for Resend with whyknot.live branding
 * No emojis, clean and professional
 */

export interface WaitlistEmailProps {
  email: string
  position?: number
}

// Sanitize email for safe HTML display (prevent XSS)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function generateWaitlistWelcomeEmail(props: WaitlistEmailProps): string {
  const { email, position } = props
  const safeEmail = escapeHtml(email)
  
  // Brand colors from design tokens
  const colors = {
    primary: '#20c5b5',
    primaryDark: '#042726',
    surface: '#ffffff',
    onSurface: '#092a28',
    onSurfaceVariant: '#486664',
    outline: 'rgba(78,104,102,0.28)',
  }

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
  </style>
  <![endif]-->
  <title>Welcome to whyknot.live</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      word-break: break-word;
      -webkit-font-smoothing: antialiased;
      background-color: #f2fbfa;
      font-family: 'Bebas Neue', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    img {
      max-width: 100%;
      vertical-align: middle;
      line-height: 100%;
      border: 0;
    }
    @media (max-width: 600px) {
      .sm-w-full {
        width: 100% !important;
      }
      .sm-px-4 {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .sm-text-base {
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; word-break: break-word; -webkit-font-smoothing: antialiased; background-color: #f2fbfa;">
  <div role="article" aria-roledescription="email" aria-label="Welcome to whyknot.live" lang="en">
    <!-- Preheader Text (hidden but shows in inbox preview) -->
    <div style="display: none;">
      You're on the list! We'll keep you updated on our launch.
      &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
    </div>
    
    <!-- Email Container -->
    <table align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0; padding: 0; width: 100%; background-color: #f2fbfa;">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <!-- Content Wrapper -->
          <table class="sm-w-full" width="600" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto; width: 600px; background-color: ${colors.surface}; border-radius: 16px; box-shadow: 0 1px 2px -1px rgba(49,67,72,.15);">
            
            <!-- Header -->
            <tr>
              <td style="padding: 48px 48px 32px; text-align: center;" class="sm-px-4">
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 32px; font-weight: 400; color: ${colors.primary}; letter-spacing: 0.02em; text-transform: uppercase;">
                  whyknot.live
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding: 0 48px 24px;" class="sm-px-4">
                <h1 style="margin: 0 0 16px; font-family: 'Bebas Neue', sans-serif; font-size: 36px; font-weight: 400; color: ${colors.onSurface}; line-height: 1.2; letter-spacing: 0.01em; text-transform: uppercase;">
                  Welcome to the Waitlist
                </h1>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  Thank you for joining us at <strong style="color: ${colors.onSurface};">whyknot.live</strong>. We're excited to have you on board.
                </p>
                ${position ? `
                <div style="margin: 0 0 24px; padding: 20px; background-color: #e9fbfa; border-left: 4px solid ${colors.primary}; border-radius: 8px;">
                  <p style="margin: 0; font-size: 14px; color: ${colors.onSurfaceVariant};">
                    Your Position
                  </p>
                  <p style="margin: 8px 0 0; font-size: 32px; font-weight: 700; color: ${colors.primary};">
                    #${position}
                  </p>
                </div>
                ` : ''}
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  We're working hard to bring you something special. You'll be among the first to know when we launch.
                </p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  In the meantime, stay tuned for updates and exclusive previews.
                </p>
              </td>
            </tr>

            <!-- Call to Action -->
            <tr>
              <td style="padding: 0 48px 40px;" class="sm-px-4">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td align="center" style="padding-top: 8px;">
                      <a href="https://www.whyknot.live" style="display: inline-block; padding: 16px 40px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; font-weight: 400; letter-spacing: 0.02em; text-transform: uppercase; color: ${colors.primaryDark}; background-color: ${colors.primary}; text-decoration: none; border-radius: 8px;">
                        Visit Website
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 0 48px;" class="sm-px-4">
                <div style="height: 1px; background-color: ${colors.outline};"></div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 32px 48px;" class="sm-px-4">
                <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  This email was sent to <strong style="color: ${colors.onSurface};">${safeEmail}</strong>
                </p>
                <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  You received this because you signed up for our waitlist.
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${colors.onSurfaceVariant};">
                  <a href="https://www.whyknot.live/privacy-policy" style="color: ${colors.primary}; text-decoration: none;">Privacy Policy</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="https://www.whyknot.live/terms-of-service" style="color: ${colors.primary}; text-decoration: none;">Terms of Service</a>
                </p>
                <p style="margin: 16px 0 0; font-size: 12px; color: ${colors.onSurfaceVariant};">
                  © ${new Date().getFullYear()} whyknot.live. All rights reserved.
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

/**
 * Plain text version for email clients that don't support HTML
 */
export function generateWaitlistWelcomeText(props: WaitlistEmailProps): string {
  const { email, position } = props
  
  return `
Welcome to whyknot.live

Thank you for joining our waitlist!

${position ? `Your Position: #${position}\n` : ''}
We're excited to have you on board. You'll be among the first to know when we launch.

In the meantime, stay tuned for updates and exclusive previews.

Visit our website: https://www.whyknot.live

---

This email was sent to ${email}
You received this because you signed up for our waitlist.

Privacy Policy: https://www.whyknot.live/privacy-policy
Terms of Service: https://www.whyknot.live/terms-of-service

© ${new Date().getFullYear()} whyknot.live. All rights reserved.
  `.trim()
}
