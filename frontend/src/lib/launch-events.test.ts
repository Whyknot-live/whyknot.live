import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    countdownParts,
    isIn30dWindow,
    isUpcoming,
    unansweredCount,
    weekKey,
    weeklyWinners,
} from './launch-events';

describe('weekKey', () => {
    it('maps a Monday to week 01 of its year', () => {
        assert.strictEqual(weekKey('2021-01-04T12:00:00Z'), '2021-W01');
    });

    it('maps Jan 1 (Friday) to the prior year W53', () => {
        assert.strictEqual(weekKey('2021-01-01T12:00:00Z'), '2020-W53');
        assert.strictEqual(weekKey('2020-12-31T12:00:00Z'), '2020-W53');
    });

    it('keeps the seed week together and accepts Date input', () => {
        assert.strictEqual(weekKey('2026-09-07T00:00:00Z'), weekKey('2026-09-09T00:00:00Z'));
        assert.strictEqual(weekKey(new Date('2021-01-04T12:00:00Z')), '2021-W01');
    });
});

describe('countdownParts', () => {
    it('splits 1d 2h 3m 4s exactly', () => {
        const now = Date.UTC(2026, 8, 9, 12, 0, 0);
        const scheduled = now + 86400000 + 2 * 3600000 + 3 * 60000 + 4 * 1000;
        assert.deepStrictEqual(countdownParts(scheduled, now), { days: 1, hours: 2, mins: 3, secs: 4 });
    });

    it('clamps past dates to zeros', () => {
        const now = Date.UTC(2026, 8, 9, 12, 0, 0);
        assert.deepStrictEqual(countdownParts(now - 1000, now), { days: 0, hours: 0, mins: 0, secs: 0 });
        assert.deepStrictEqual(countdownParts(now, now), { days: 0, hours: 0, mins: 0, secs: 0 });
    });
});

describe('weeklyWinners', () => {
    const a = { slug: 'alpha', publishedAt: '2021-01-04T12:00:00Z', votes: 10, comments: 0 };
    const b = { slug: 'beta', publishedAt: '2021-01-04T12:00:00Z', votes: 100, comments: 0 };
    const c = { slug: 'gamma', publishedAt: '2021-01-11T12:00:00Z', votes: 5, comments: 0 };

    it('picks top velocity per ISO week', () => {
        const winners = weeklyWinners([a, b, c], '2021-01-20T00:00:00Z');
        assert.strictEqual(winners.size, 2);
        assert.strictEqual(winners.get('2021-W01')?.slug, 'beta');
        assert.strictEqual(winners.get('2021-W02')?.slug, 'gamma');
    });

    it('works without an explicit now (anchors to newest launch)', () => {
        const winners = weeklyWinners([a, b]);
        assert.strictEqual(winners.size, 1);
        assert.strictEqual(winners.get('2021-W01')?.slug, 'beta');
    });
});

describe('unansweredCount', () => {
    it('counts comments without makerReplyAt', () => {
        assert.strictEqual(
            unansweredCount([
                { makerReplyAt: '2026-09-09T10:00:00Z' },
                {},
                { makerReplyAt: null },
            ]),
            2,
        );
        assert.strictEqual(unansweredCount([]), 0);
    });
});

describe('isUpcoming / isIn30dWindow', () => {
    it('flags future schedules as upcoming', () => {
        const now = '2026-09-09T00:00:00Z';
        assert.strictEqual(isUpcoming({ publishedAt: '2026-09-10T00:00:00Z' }, now), true);
        assert.strictEqual(isUpcoming({ publishedAt: '2026-09-08T00:00:00Z' }, now), false);
        assert.strictEqual(
            isUpcoming(
                { publishedAt: '2026-09-08T00:00:00Z', scheduledAt: '2026-09-12T00:00:00Z' },
                now,
            ),
            true,
        );
    });

    it('keeps the trailing 30 days, past only', () => {
        const now = '2026-09-09T00:00:00Z';
        assert.strictEqual(isIn30dWindow('2026-09-08T00:00:00Z', now), true);
        assert.strictEqual(isIn30dWindow('2026-08-10T00:00:00Z', now), true);
        assert.strictEqual(isIn30dWindow('2026-08-09T00:00:00Z', now), false);
        assert.strictEqual(isIn30dWindow('2026-09-10T00:00:00Z', now), false);
    });
});
