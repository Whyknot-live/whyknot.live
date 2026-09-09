import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
    slugify,
    normalizeUrl,
    isTaglineValid,
    TAGLINE_MAX_LENGTH,
    SLOT_CAPACITY,
    toSlotDateString,
    buildAvailability,
    findNextFreeSlot,
    detectStackHints,
    isBlockedHostname,
    isPrivateIp,
    countWords,
    extractTitle,
    extractMetaDescription
} from '../utils/submit'

describe('slugify', () => {
    it('lowercases and hyphenates', () => {
        assert.strictEqual(slugify('Hello World!'), 'hello-world')
    })

    it('trims and collapses separators', () => {
        assert.strictEqual(slugify('  Astro   Rocks__Yeah '), 'astro-rocks-yeah')
    })

    it('matches the frontend content helper for a maker name', () => {
        assert.strictEqual(slugify('Acme 2.0 (Beta)'), 'acme-2-0-beta')
    })
})

describe('normalizeUrl', () => {
    it('prepends https when no scheme is present', () => {
        assert.strictEqual(normalizeUrl('example.com'), 'https://example.com')
    })

    it('lowercases the host and keeps the path', () => {
        assert.strictEqual(normalizeUrl('https://Example.COM/foo/'), 'https://example.com/foo/')
    })

    it('strips the trailing slash on bare origins', () => {
        assert.strictEqual(normalizeUrl('http://example.com/'), 'http://example.com')
    })

    it('strips fragments and default ports', () => {
        assert.strictEqual(normalizeUrl('https://example.com:443/a#section'), 'https://example.com/a')
    })

    it('rejects non-http schemes', () => {
        assert.throws(() => normalizeUrl('ftp://example.com'), /invalid_url/)
    })

    it('rejects blank and unparsable input', () => {
        assert.throws(() => normalizeUrl('   '), /invalid_url/)
        assert.throws(() => normalizeUrl('not a url'), /invalid_url/)
    })
})

describe('tagline length', () => {
    it('accepts exactly 60 chars', () => {
        assert.strictEqual(TAGLINE_MAX_LENGTH, 60)
        assert.strictEqual(isTaglineValid('a'.repeat(60)), true)
    })

    it('rejects 61 chars and empty input', () => {
        assert.strictEqual(isTaglineValid('a'.repeat(61)), false)
        assert.strictEqual(isTaglineValid('   '), false)
    })
})

describe('slot dates', () => {
    it('formats slot dates as YYYY-MM-DD', () => {
        assert.strictEqual(toSlotDateString(new Date('2026-09-10T12:00:00.000Z')), '2026-09-10')
    })

    it('builds availability with capacity 3', () => {
        assert.strictEqual(SLOT_CAPACITY, 3)
        const slots = buildAvailability({ '2026-09-10': 3 }, '2026-09-10', 2)
        assert.deepStrictEqual(slots[0], { date: '2026-09-10', capacity: 3, taken: 3, available: 0 })
        assert.deepStrictEqual(slots[1], { date: '2026-09-11', capacity: 3, taken: 0, available: 3 })
    })

    it('finds the next free day, skipping full ones', () => {
        const counts = { '2026-09-10': 3, '2026-09-11': 1 }
        assert.strictEqual(findNextFreeSlot(counts, '2026-09-10'), '2026-09-11')
    })

    it('returns null when the whole window is full', () => {
        const counts = { '2026-09-10': 3, '2026-09-11': 9 }
        assert.strictEqual(findNextFreeSlot(counts, '2026-09-10', 2), null)
    })
})

describe('scrape helpers', () => {
    it('detects stack hints from raw html', () => {
        const html = '<html><head><title>T</title></head><body><script src="/_next/static/x.js"></script></body></html>'
        assert.ok(detectStackHints(html).includes('nextjs'))
    })

    it('extracts title and meta description', () => {
        const html =
            '<html><head><title>  My Tool </title><meta name="description" content="Does things fast."></head></html>'
        assert.strictEqual(extractTitle(html), 'My Tool')
        assert.strictEqual(extractMetaDescription(html), 'Does things fast.')
    })

    it('counts story words for the 80–150w guidance', () => {
        assert.strictEqual(countWords('  hello   world '), 2)
    })
})

describe('SSRF guard', () => {
    it('blocks loopback and internal hostnames', () => {
        assert.strictEqual(isBlockedHostname('localhost'), true)
        assert.strictEqual(isBlockedHostname('app.internal'), true)
        assert.strictEqual(isBlockedHostname('169.254.169.254'), true)
        assert.strictEqual(isBlockedHostname('example.com'), false)
    })

    it('blocks private IPs, allows public ones', () => {
        assert.strictEqual(isPrivateIp('10.0.0.1'), true)
        assert.strictEqual(isPrivateIp('192.168.1.1'), true)
        assert.strictEqual(isPrivateIp('127.0.0.1'), true)
        assert.strictEqual(isPrivateIp('8.8.8.8'), false)
        assert.strictEqual(isPrivateIp('1.1.1.1'), false)
    })
})
