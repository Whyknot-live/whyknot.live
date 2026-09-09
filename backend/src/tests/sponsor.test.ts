import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
    ELIGIBILITY_NOTE,
    SLOT_AMOUNTS_PAISE,
    SLOT_CAPACITY_PER_DAY,
    SLOT_WINDOW_DAYS,
    formatSlotDate,
    getSlotDateRange,
    isEligibleForSponsorship,
    isValidSlotDate
} from '../routes/sponsor'

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
