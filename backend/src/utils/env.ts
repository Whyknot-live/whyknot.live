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
  ADMIN_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters')
})

export function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format())
    throw new Error('Invalid environment variables')
  }
  return result.data
}
