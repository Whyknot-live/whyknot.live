import { z } from 'zod'

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  PORT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS_RATE_LIMIT: z.string().optional(),
  ENABLE_EMAIL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  TRUST_PROXY_FORWARDED: z.enum(['0', '1']).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  // Store a bcrypt hash instead of plain password for security
  // Generate with: bun run src/scripts/hash-password.ts "your-password"
  ADMIN_PASSWORD_HASH: z.string()
    .min(60, 'ADMIN_PASSWORD_HASH must be a valid bcrypt hash (60 characters)')
    .regex(
      /^\$2[aby]\$\d{1,2}\$[./A-Za-z0-9]{53}$/,
      'ADMIN_PASSWORD_HASH must be a valid bcrypt hash (e.g., $2b$12$...)'
    ),
  // Optional pepper for environment-specific password hashing
  // Use different peppers for dev, staging, and production
  ADMIN_PASSWORD_PEPPER: z.string().optional(),
  ADMIN_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  // Maker sessions (the credential that lets a maker edit their own listing)
  // are signed with their own key when one is set. Optional so existing
  // deploys keep booting: without it the admin key signs maker sessions,
  // separated by a distinct audience claim.
  MAKER_SESSION_SECRET: z.string().min(32).optional(),
  // Razorpay payments (P1 revenue loops, C1 Razorpay-first, INR-only at launch)
  // Optional so existing deploys without payments still boot; payments routes 503 when missing.
  // RAZORPAY_WEBHOOK_SECRET stays optional for the same reason, but the webhook
  // fails CLOSED without it outside development (see routes/payments.ts).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_CURRENCY: z.string().optional(),
  RAZORPAY_PLAN_PRO_ID: z.string().optional(),
  RAZORPAY_PLAN_TEAM_ID: z.string().optional()
})

export function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format())
    throw new Error('Invalid environment variables')
  }
  return result.data
}
