import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import sponsorRouter, {
    ELIGIBILITY_NOTE,
    RANK_INPUT_FIELDS,
    SLOT_AMOUNTS_PAISE,
    SLOT_CAPACITY_PER_DAY,
    SLOT_PENDING_HOLD_MINUTES,
    SLOT_PENDING_HOLD_MS,
    SLOT_WINDOW_DAYS,
    buildSlotEvent,
    campaignTitleFromUrl,
    computeSponsorMetrics,
    formatSlotDate,
    getActiveBoostCampaign,
    getSlotDateRange,
    isEligibleForSponsorship,
    isPendingHoldActive,
    isValidSlotDate,
    markSponsorOrderPaid,
    parseSlotEvent,
    type SlotOrderDoc,
    type SlotOrderStore
} from '../routes/sponsor'
import { launchEventVelocity } from '../utils/launch-events'

describe('sponsor amounts (TrustMRR-ladder INR shape, paise)', () => {
    it('prices launch-boost at Rs 2,500', () => {
        assert.strictEqual(SLOT_AMOUNTS_PAISE['launch-boost'], 250000)
    })

    it('prices newsletter at Rs 15,000', () => {
        assert.strictEqual(SLOT_AMOUNTS_PAISE.newsletter, 1500000)
    })

    it('holds capacity at 1/day over a 30d window', () => {
        assert.strictEqual(SLOT_CAPACITY_PER_DAY, 1)
        assert.strictEqual(SLOT_WINDOW_DAYS, 30)
    })
})

describe('slot date validation', () => {
    const now = new Date('2026-09-09T12:00:00.000Z')

    it('accepts today', () => {
        assert.strictEqual(isValidSlotDate('2026-09-09', now), true)
    })

    it('accepts the last day of the 30d window', () => {
        const range = getSlotDateRange(now)
        assert.strictEqual(range.length, 30)
        assert.strictEqual(range[0], '2026-09-09')
        assert.strictEqual(isValidSlotDate(range[29], now), true)
    })

    it('rejects yesterday (past)', () => {
        assert.strictEqual(isValidSlotDate('2026-09-08', now), false)
    })

    it('rejects the day after the window', () => {
        assert.strictEqual(isValidSlotDate('2026-10-10', now), false)
    })

    it('rejects bad shapes and calendar overflow', () => {
        assert.strictEqual(isValidSlotDate('09-09-2026', now), false)
        assert.strictEqual(isValidSlotDate('2026-9-9', now), false)
        assert.strictEqual(isValidSlotDate('not-a-date', now), false)
        assert.strictEqual(isValidSlotDate('2026-02-30', now), false)
        assert.strictEqual(isValidSlotDate('', now), false)
    })

    it('formats dates as UTC YYYY-MM-DD', () => {
        assert.strictEqual(formatSlotDate(new Date('2026-09-09T23:59:59.000Z')), '2026-09-09')
    })
})

describe('sponsorship eligibility (listed + screened, PH rule)', () => {
    it('admits listed + screened launches', () => {
        assert.strictEqual(isEligibleForSponsorship({ listed: true, screened: true }), true)
    })

    it('rejects brand-new/unscreened in every combination', () => {
        assert.strictEqual(isEligibleForSponsorship({ listed: false, screened: false }), false)
        assert.strictEqual(isEligibleForSponsorship({ listed: true, screened: false }), false)
        assert.strictEqual(isEligibleForSponsorship({ listed: false, screened: true }), false)
    })

    it('states the listed+screened rule in the eligibility note', () => {
        assert.match(ELIGIBILITY_NOTE, /listed \+ screened/)
    })
})

describe('slot event ingest (impression/click beacon)', () => {
    it('accepts a valid impression and click payload', () => {
        assert.deepStrictEqual(parseSlotEvent({ slot: 'launch-boost', kind: 'impression' }), {
            slot: 'launch-boost',
            kind: 'impression'
        })
        assert.deepStrictEqual(parseSlotEvent({ slot: 'newsletter', kind: 'click' }), {
            slot: 'newsletter',
            kind: 'click'
        })
    })

    it('rejects bad payloads (negative control)', () => {
        assert.strictEqual(parseSlotEvent(null), null)
        assert.strictEqual(parseSlotEvent('launch-boost'), null)
        assert.strictEqual(parseSlotEvent({}), null)
        assert.strictEqual(parseSlotEvent({ slot: 'launch-boost' }), null)
        assert.strictEqual(parseSlotEvent({ kind: 'click' }), null)
        assert.strictEqual(parseSlotEvent({ slot: 'pinned-week', kind: 'click' }), null)
        assert.strictEqual(parseSlotEvent({ slot: 'launch-boost', kind: 'hover' }), null)
        assert.strictEqual(parseSlotEvent({ slot: 1, kind: 'click' }), null)
    })

    it('strips client-supplied fields — no client time reaches slot_events', () => {
        const parsed = parseSlotEvent({
            slot: 'launch-boost',
            kind: 'impression',
            createdAt: '2000-01-01T00:00:00.000Z',
            email: 'someone@example.com'
        })
        assert.deepStrictEqual(parsed, { slot: 'launch-boost', kind: 'impression' })
    })

    it('rejects a bad payload at the route with a generic 400 (negative control)', async () => {
        // The parse gate runs before env/rate-limit/DB, so this is deterministic.
        const res = await sponsorRouter.request('/sponsor/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot: 'launch-boost', kind: 'hover' })
        })
        assert.strictEqual(res.status, 400)
        assert.deepStrictEqual(await res.json(), { error: 'invalid_request' })
    })

    it('stamps server time as the timestamp', () => {
        const parsed = parseSlotEvent({ slot: 'launch-boost', kind: 'click' })
        assert.ok(parsed)
        const now = new Date('2026-10-08T10:00:00.000Z')
        const doc = buildSlotEvent(parsed, now)
        assert.strictEqual(doc.createdAt, now)
        assert.strictEqual(doc.slot, 'launch-boost')
        assert.strictEqual(doc.kind, 'click')
    })
})

describe('markSponsorOrderPaid (captured payment flips fill/revenue)', () => {
    function makeOrder(overrides: Partial<SlotOrderDoc> = {}): SlotOrderDoc {
        return {
            orderId: 'spon_ORDER1',
            email: 'sponsor@example.com',
            slot: 'launch-boost',
            date: '2026-10-08',
            url: 'https://example.com',
            amount: 250000,
            currency: 'INR',
            status: 'created',
            createdAt: new Date('2026-10-08T09:00:00.000Z'),
            ...overrides
        }
    }

    function fakeStore(doc: SlotOrderDoc | null): { store: SlotOrderStore; updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> } {
        const updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> = []
        const store: SlotOrderStore = {
            findOne: async (filter) => (doc && doc.orderId === filter.orderId ? doc : null),
            updateOne: async (filter, update) => {
                updates.push({ filter, update })
                const matches = doc !== null && doc.status === 'created' && filter.status === 'created'
                if (matches && doc) doc.status = 'paid'
                return { matchedCount: matches ? 1 : 0 }
            }
        }
        return { store, updates }
    }

    it('flips created -> paid exactly once on a matching payment', async () => {
        const order = makeOrder()
        const { store, updates } = fakeStore(order)
        const first = await markSponsorOrderPaid(store, { orderId: 'spon_ORDER1', amount: 250000, currency: 'INR' })
        assert.strictEqual(first, true)
        assert.strictEqual(order.status, 'paid')
        assert.strictEqual(updates.length, 1)
        assert.strictEqual(updates[0].filter.status, 'created')
        // Redelivery: already paid, no second flip.
        const second = await markSponsorOrderPaid(store, { orderId: 'spon_ORDER1', amount: 250000, currency: 'INR' })
        assert.strictEqual(second, false)
        assert.strictEqual(updates.length, 1)
    })

    it('fails closed on an amount mismatch (negative control)', async () => {
        const order = makeOrder()
        const { store, updates } = fakeStore(order)
        const flipped = await markSponsorOrderPaid(store, { orderId: 'spon_ORDER1', amount: 100, currency: 'INR' })
        assert.strictEqual(flipped, false)
        assert.strictEqual(order.status, 'created')
        assert.strictEqual(updates.length, 0)
    })

    it('fails closed on a currency mismatch (negative control)', async () => {
        const order = makeOrder()
        const { store, updates } = fakeStore(order)
        // Amount matches; only the currency differs — still no update issued.
        const flipped = await markSponsorOrderPaid(store, { orderId: 'spon_ORDER1', amount: 250000, currency: 'USD' })
        assert.strictEqual(flipped, false)
        assert.strictEqual(order.status, 'created')
        assert.strictEqual(updates.length, 0)
    })

    it('does not touch orders that do not exist (entitlement payments are not sponsor orders)', async () => {
        const { store, updates } = fakeStore(null)
        const flipped = await markSponsorOrderPaid(store, { orderId: 'order_ENT1', amount: 250000 })
        assert.strictEqual(flipped, false)
        assert.strictEqual(updates.length, 0)
    })
})

describe('sponsor metrics reflect ingested events and paid flips (A + B)', () => {
    const now = new Date('2026-10-08T12:00:00.000Z')
    const dates = getSlotDateRange(now)

    it('reports occupancy, revenue, and per-slot CTR from real data', () => {
        const events = [
            buildSlotEvent({ slot: 'launch-boost', kind: 'impression' }, now),
            buildSlotEvent({ slot: 'launch-boost', kind: 'impression' }, now),
            buildSlotEvent({ slot: 'launch-boost', kind: 'click' }, now),
            buildSlotEvent({ slot: 'newsletter', kind: 'impression' }, now)
        ]
        const paidOrders = [{ slot: 'launch-boost', date: dates[0], amount: 250000 }]
        const metrics = computeSponsorMetrics({ paidOrders, events, dates })

        assert.strictEqual(metrics.revenuePaise, 250000)
        assert.strictEqual(metrics.occupancy, 1 / (SLOT_WINDOW_DAYS * 2))
        assert.strictEqual(metrics.ctrPerSlot['launch-boost'].impressions, 2)
        assert.strictEqual(metrics.ctrPerSlot['launch-boost'].clicks, 1)
        assert.strictEqual(metrics.ctrPerSlot['launch-boost'].ctr, 0.5)
        assert.strictEqual(metrics.ctrPerSlot.newsletter.impressions, 1)
        assert.strictEqual(metrics.ctrPerSlot.newsletter.clicks, 0)
        assert.strictEqual(metrics.ctrPerSlot.newsletter.ctr, 0)
        // labelCoverage / rankInputFieldsContainingSponsored are NOT asserted
        // here: both were constants hardcoded in computeSponsorMetrics, so
        // asserting them passed no matter what. Their regression guards live in
        // the C3 describe below, where a leak or a lost label actually fails.
    })

    it('counts zero occupancy and zero CTR when nothing was paid or ingested', () => {
        const metrics = computeSponsorMetrics({ paidOrders: [], events: [], dates })
        assert.strictEqual(metrics.occupancy, 0)
        assert.strictEqual(metrics.revenuePaise, 0)
        assert.strictEqual(metrics.ctrPerSlot['launch-boost'].ctr, 0)
        assert.strictEqual(metrics.ctrPerSlot.newsletter.ctr, 0)
    })

    it('excludes paid orders outside the window from occupancy', () => {
        const paidOrders = [{ slot: 'launch-boost', date: '2020-01-01', amount: 250000 }]
        const metrics = computeSponsorMetrics({ paidOrders, events: [], dates })
        assert.strictEqual(metrics.occupancy, 0)
        // Lifetime revenue still counts what was actually paid.
        assert.strictEqual(metrics.revenuePaise, 250000)
    })
})

// ---------- Boost-slot campaign read: the client-side beacon gate ----------
// BoostSlot fetches /sponsor/boost on the static board and arms its
// impression/click beacons ONLY when a paid campaign comes back. These tests
// pin both sides: a paid order yields exactly { title, url }, anything else
// yields null (zero beacons — a first sponsor's CTR can never be diluted).

describe('boost slot campaign read (arms beacons only for a paid campaign)', () => {
    function makeOrder(overrides: Partial<SlotOrderDoc> = {}): SlotOrderDoc {
        return {
            orderId: 'spon_ORDER1',
            email: 'sponsor@example.com',
            slot: 'launch-boost',
            date: '2026-10-08',
            url: 'https://www.example.com/launch',
            amount: 250000,
            currency: 'INR',
            status: 'paid',
            createdAt: new Date('2026-10-08T09:00:00.000Z'),
            ...overrides
        }
    }

    // findOne honours the full filter (slot + date + status), like Mongo does,
    // so an unpaid or wrong-date order can never leak into the response.
    function fakeStore(doc: SlotOrderDoc | null): SlotOrderStore {
        return {
            findOne: async (filter) =>
                doc &&
                filter.slot === doc.slot &&
                filter.date === doc.date &&
                filter.status === doc.status
                    ? doc
                    : null,
            updateOne: async () => ({ matchedCount: 0 })
        }
    }

    it('returns the paid campaign for the date (happy path)', async () => {
        const read = await getActiveBoostCampaign(fakeStore(makeOrder()), '2026-10-08')
        assert.deepStrictEqual(read, {
            slot: 'launch-boost',
            // Title is the destination host — honest, no invented copy.
            campaign: { title: 'example.com', url: 'https://www.example.com/launch' }
        })
    })

    it('returns campaign null when nothing was paid (empty response)', async () => {
        const read = await getActiveBoostCampaign(fakeStore(null), '2026-10-08')
        assert.deepStrictEqual(read, { slot: 'launch-boost', campaign: null })
    })

    it('returns campaign null for an unpaid (created) order — abandoned checkouts arm nothing', async () => {
        const read = await getActiveBoostCampaign(fakeStore(makeOrder({ status: 'created' })), '2026-10-08')
        assert.deepStrictEqual(read, { slot: 'launch-boost', campaign: null })
    })

    it('returns campaign null for another date — yesterday cannot arm today\'s board', async () => {
        const read = await getActiveBoostCampaign(fakeStore(makeOrder()), '2026-10-09')
        assert.deepStrictEqual(read, { slot: 'launch-boost', campaign: null })
    })

    it('derives the campaign title from the URL host', () => {
        assert.strictEqual(campaignTitleFromUrl('https://www.example.com/launch'), 'example.com')
        assert.strictEqual(campaignTitleFromUrl('https://whyknot.live/x'), 'whyknot.live')
        // Unparseable input falls back to the raw URL rather than inventing a name.
        assert.strictEqual(campaignTitleFromUrl('not a url'), 'not a url')
    })

    it('rejects a malformed date query with a generic 400 before touching env or DB (negative control)', async () => {
        const res = await sponsorRouter.request('/sponsor/boost?date=nope')
        assert.strictEqual(res.status, 400)
        assert.deepStrictEqual(await res.json(), { error: 'invalid_request' })
    })

    it('rejects a date outside the 30d window with a generic 400 (negative control)', async () => {
        const res = await sponsorRouter.request('/sponsor/boost?date=2020-01-01')
        assert.strictEqual(res.status, 400)
        assert.deepStrictEqual(await res.json(), { error: 'invalid_date' })
    })
})

// ---------- C3 regression guards: rank is velocity-only, label always renders ----------
// Replaces the old asserts of computeSponsorMetrics' hardcoded constants against
// themselves (they passed no matter what). Every check here FAILS if a sponsored
// field leaks into ranking or the Sponsored label disappears.

describe('C3: sponsorship can never move rank or lose its label', () => {
    it('derives zero sponsored rank-input fields from the real inputs, and counts a leak', () => {
        const dates = getSlotDateRange(new Date('2026-10-08T12:00:00.000Z'))
        // Realistic inputs: exactly the fields the boost board's ordering reads.
        const metrics = computeSponsorMetrics({ paidOrders: [], events: [], dates, rankInputs: RANK_INPUT_FIELDS })
        assert.strictEqual(metrics.rankInputFieldsContainingSponsored, 0)
        // Negative control: the derivation must COUNT a leaked field — proof the
        // zero above is computed, not a constant passing by construction. If a
        // sponsored rank input is ever added to RANK_INPUT_FIELDS, the assertion
        // above flips to 1 and fails.
        const leaked = computeSponsorMetrics({
            paidOrders: [],
            events: [],
            dates,
            rankInputs: [...RANK_INPUT_FIELDS, 'sponsoredBoost']
        })
        assert.strictEqual(leaked.rankInputFieldsContainingSponsored, 1)
    })

    it('board order follows backing velocity only — a sponsored flag cannot move an entry (negative control)', () => {
        const now = new Date('2026-10-08T12:00:00.000Z')
        const publishedAt = '2026-10-01T00:00:00.000Z'
        const paidSlow = { slug: 'paid-slow', publishedAt, votes: 4, comments: 0, sponsored: true }
        const organicFast = { slug: 'organic-fast', publishedAt, votes: 90, comments: 10, sponsored: false }
        // The comparator the launch board states (velocity desc; the frontend
        // keeps an Astro-free copy of this formula, no test runner there):
        // the paid entry stays behind no matter its flag.
        const board = [paidSlow, organicFast].sort(
            (a, b) => launchEventVelocity(b, now) - launchEventVelocity(a, now)
        )
        assert.deepStrictEqual(board.map((l) => l.slug), ['organic-fast', 'paid-slow'])
        // Same backing, flag flipped -> identical velocity. If a sponsored field
        // ever leaks into the ranking input, these pairs differ and this fails.
        const paidSlowFlagOff = { ...paidSlow, sponsored: false }
        assert.strictEqual(launchEventVelocity(paidSlowFlagOff, now), launchEventVelocity(paidSlow, now))
        const organicFastFlagOn = { ...organicFast, sponsored: true }
        assert.strictEqual(launchEventVelocity(organicFastFlagOn, now), launchEventVelocity(organicFast, now))
    })

    it('keeps the Sponsored label on the boost surface (label coverage guard)', () => {
        // No frontend test runner exists, so this reads the two components'
        // sources: BoostSlot must render SponsoredTag, and SponsoredTag must
        // render the neutral label itself. Delete either and this fails —
        // unlike the old assert of labelCoverage: 1 against itself.
        const slotSrc = readFileSync(new URL('../../../frontend/src/components/BoostSlot.astro', import.meta.url), 'utf8')
        const tagSrc = readFileSync(new URL('../../../frontend/src/components/SponsoredTag.astro', import.meta.url), 'utf8')
        assert.match(slotSrc, /<SponsoredTag\b/)
        assert.match(tagSrc, /sponsored-tag">Sponsored</)
    })
})

// ---------- /sponsor/metrics is admin-only: no public revenue leak ----------
// The metrics endpoint returns lifetime revenue and CTR. It must 401 for an
// anonymous caller BEFORE validateEnv() or connectMongo() runs — a source
// guard pins that the auth check precedes every env and DB read, so the
// numbers can never reach an unauthenticated client.

describe('sponsor metrics requires admin auth (no public revenue leak)', () => {
    it('rejects an anonymous metrics request with 401 (negative control)', async () => {
        const res = await sponsorRouter.request('/sponsor/metrics')
        assert.strictEqual(res.status, 401)
        assert.deepStrictEqual(await res.json(), { error: 'unauthorized' })
    })

    it('checks the admin token before any env or DB read (source guard)', () => {
        const src = readFileSync(new URL('../routes/sponsor.ts', import.meta.url), 'utf8')
        const metricsStart = src.indexOf("router.get('/sponsor/metrics'")
        assert.ok(metricsStart > -1, 'the /sponsor/metrics route must exist')
        const body = src.slice(metricsStart)
        const authAt = body.indexOf("getCookie(c, 'adminToken')")
        const envAt = body.indexOf('validateEnv()')
        const dbAt = body.indexOf('connectMongo(')
        assert.ok(authAt > -1 && envAt > -1 && dbAt > -1, 'auth, env and DB calls must all be present')
        // Auth must come first: no cookie -> 401 returned before touching env or Mongo.
        assert.ok(authAt < envAt, 'the admin token check must precede validateEnv()')
        assert.ok(authAt < dbAt, 'the admin token check must precede connectMongo()')
    })
})

// ---------- an in-flight checkout holds its date, an abandoned one does not ----------
// The old all-statuses unique index let an abandoned checkout block a date
// forever while /sponsor/availability still reported it free. Uniqueness now
// applies to PAID orders only, and a checkout in flight holds its date for a
// short window so two sponsors cannot pay for the same date.

describe('slot hold window (in-flight checkout holds, abandoned does not)', () => {
    const now = new Date('2026-10-08T12:00:00.000Z')

    it('holds the date while the checkout is still fresh', () => {
        assert.strictEqual(
            isPendingHoldActive(
                { status: 'created', createdAt: new Date('2026-10-08T11:50:00.000Z') },
                now
            ),
            true
        )
    })

    it('releases the date once the hold window passes', () => {
        assert.strictEqual(
            isPendingHoldActive(
                { status: 'created', createdAt: new Date('2026-10-08T11:00:00.000Z') },
                now
            ),
            false
        )
    })

    it('never holds a paid order', () => {
        assert.strictEqual(
            isPendingHoldActive(
                { status: 'paid', createdAt: new Date('2026-10-08T11:50:00.000Z') },
                now
            ),
            false
        )
    })

    it('never holds an order with no creation time (an unknown age must not block forever)', () => {
        assert.strictEqual(isPendingHoldActive({ status: 'created' }, now), false)
        assert.strictEqual(
            isPendingHoldActive({ status: 'created', createdAt: 'not-a-date' }, now),
            false
        )
    })

    it('keeps the hold short (an abandoned checkout must not block long)', () => {
        assert.ok(SLOT_PENDING_HOLD_MINUTES <= 60)
        assert.strictEqual(SLOT_PENDING_HOLD_MS, SLOT_PENDING_HOLD_MINUTES * 60 * 1000)
    })

    it('applies the same hold to availability and to the order insert (source guard)', () => {
        const src = readFileSync(new URL('../routes/sponsor.ts', import.meta.url), 'utf8')
        const availabilityStart = src.indexOf("router.get('/sponsor/availability'")
        const orderStart = src.indexOf("router.post('/sponsor/order'")
        assert.ok(availabilityStart > -1 && orderStart > -1, 'both routes must exist')
        assert.ok(
            src.slice(availabilityStart, orderStart).includes('SLOT_PENDING_HOLD_MS'),
            'availability must apply the hold window'
        )
        assert.ok(
            src.slice(orderStart).includes('SLOT_PENDING_HOLD_MS'),
            'the order insert must apply the hold window'
        )
    })
})

// ---------- a paid order that lost its date is marked, never hidden ----------
// The paid-only index rejects a second paid order for a slot+date. The sponsor
// has paid, but the date is gone: the order is marked as a conflict so it is
// counted in the admin metrics and a human can decide on a refund. It must
// never be silently dropped, and the slot must never be granted.

describe('sponsor slot conflict (paid, but the date was taken first)', () => {
    function makeOrder(): SlotOrderDoc {
        return {
            orderId: 'spon_ORDER1',
            email: 'sponsor@example.com',
            slot: 'launch-boost',
            date: '2026-10-08',
            url: 'https://example.com',
            amount: 250000,
            currency: 'INR',
            status: 'created',
            createdAt: new Date('2026-10-08T09:00:00.000Z')
        }
    }

    it('refuses to grant the slot and marks the order as a conflict', async () => {
        const order = makeOrder()
        const updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> = []
        const store: SlotOrderStore = {
            findOne: async () => order,
            updateOne: async (filter, update) => {
                if (filter.status === 'created') {
                    // MongoDB rejects the second paid order for this slot+date.
                    throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
                }
                updates.push({ filter, update })
                return { matchedCount: 1 }
            }
        }

        const flipped = await markSponsorOrderPaid(store, {
            orderId: 'spon_ORDER1',
            amount: 250000,
            currency: 'INR'
        })

        assert.strictEqual(flipped, false, 'the slot must not be granted')
        assert.strictEqual(order.status, 'created', 'the order must not be marked paid')
        assert.strictEqual(updates.length, 1)
        assert.strictEqual(
            (updates[0].update.$set as Record<string, unknown>).status,
            'conflict',
            'the order must be marked as a conflict'
        )
    })

    it('counts conflicts in the admin metrics', () => {
        const metrics = computeSponsorMetrics({
            paidOrders: [],
            events: [],
            dates: [],
            conflictOrders: [{ date: '2026-10-08' }]
        })
        assert.strictEqual(metrics.conflicts, 1)
    })

    it('reports zero conflicts when there are none', () => {
        const metrics = computeSponsorMetrics({ paidOrders: [], events: [], dates: [] })
        assert.strictEqual(metrics.conflicts, 0)
    })
})

// ---------- the slot_orders index only locks PAID dates ----------
// The partial unique index is created FIRST and the legacy all-statuses index
// is dropped only after it exists. If the partial index cannot be created the
// old stricter index stays in place rather than leaving no uniqueness at all.

describe('slot_orders uniqueness applies to paid orders only', () => {
    const src = readFileSync(new URL('../utils/mongo.ts', import.meta.url), 'utf8')

    it('creates a partial unique index on paid orders', () => {
        assert.ok(src.includes('partialFilterExpression'), 'a partial index must be created')
        assert.ok(
            src.includes("partialFilterExpression: { status: 'paid' }"),
            'the partial filter must cover paid orders only'
        )
    })

    it('creates the partial index before dropping the legacy one', () => {
        const createAt = src.indexOf('slot_orders_slot_date_paid')
        const dropAt = src.indexOf('dropIndex(')
        assert.ok(createAt > -1, 'the paid-only index must be created')
        assert.ok(dropAt > -1, 'the legacy index must be dropped')
        assert.ok(createAt < dropAt, 'the paid-only index must exist before the legacy one goes')
    })

    it('keeps the legacy index when the paid-only index cannot be created', () => {
        const guardAt = src.indexOf('if (paidOnlyIndexReady)')
        const dropAt = src.indexOf('dropIndex(')
        assert.ok(guardAt > -1, 'the legacy drop must be guarded')
        assert.ok(guardAt < dropAt, 'the legacy drop must be inside the guard')
    })
})
