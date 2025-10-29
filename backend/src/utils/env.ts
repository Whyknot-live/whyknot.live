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
 ADMIN_PASSWORD: z.string().min(8),
 ADMIN_JWT_SECRET: z.string().min(32)
})

export function validateEnv() {
 const result = envSchema.safeParse(process.env)
 if (!result.success) {
 console.error('Invalid environment variables:', result.error.format())
 throw new Error('Invalid environment variables')
 }
 return result.data
}
