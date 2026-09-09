import { Hono } from 'hono'
import { z } from 'zod'
import { connectMongo, getDb } from '../utils/mongo'
import { validateEnv } from '../utils/env'
import { apiLogger } from '../utils/logger'
import { buildAvailability, toSlotDateString } from '../utils/submit'

const router = new Hono()

const MAX_DAYS = 60

const querySchema = z.object({
    days: z.coerce.number().int().min(1).max(MAX_DAYS).default(14)
})

router.get('/slots/availability', async (c) => {
    const parsed = querySchema.safeParse({ days: c.req.query('days') ?? undefined })
    if (!parsed.success) {
        return c.json({ error: 'invalid_request' }, 400)
    }

    const env = validateEnv()
    await connectMongo(env.MONGODB_URI, env.MONGODB_DB)
    const db = getDb()

    try {
        const today = toSlotDateString(new Date())
        const end = toSlotDateString(new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000))
        const rows = await db
            .collection('submissions')
            .aggregate<{ _id: string; count: number }>([
                { $match: { slotDate: { $gte: today, $lt: end } } },
                { $group: { _id: '$slotDate', count: { $sum: 1 } } }
            ])
            .toArray()
        const counts: Record<string, number> = {}
        for (const row of rows) {
            counts[row._id] = row.count
        }
        // Capacity is the in-memory SLOT_CAPACITY constant; only the
        // per-day counts are read from the submissions collection.
        return c.json(buildAvailability(counts, today, parsed.data.days))
    } catch (err) {
        apiLogger.error('Slots availability failed', {
            error: err instanceof Error ? err.message : 'Unknown error'
        })
        return c.json({ error: 'server_error' }, 500)
    }
})

export default router
