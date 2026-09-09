/**
 * launch-events — backend duplicate of `frontend/src/lib/launch-events.ts`.
 *
 * NOTE (duplication): frontend has no test runner, so this small pure file is
 * duplicated here for `bun test` coverage via `src/tests/launch-events.test.ts`.
 * Keep both files in sync. No Astro, no DOM, no I/O.
 */

export type DateLike = Date | string | number;

export interface UpcomingInput {
    publishedAt: DateLike;
    scheduledAt?: DateLike | null;
}

export interface ScoredLaunchInput {
    slug: string;
    publishedAt: DateLike;
    votes: number;
    comments: number;
}

export interface ReplyableComment {
    makerReplyAt?: DateLike | null;
}

export interface CountdownParts {
    days: number;
    hours: number;
    mins: number;
    secs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const SEC_MS = 1000;
const WINDOW_30D_MS = 30 * DAY_MS;

/** Coerce Date|string|number to epoch ms. */
export function toTime(value: DateLike): number {
    if (value instanceof Date) return value.valueOf();
    if (typeof value === 'number') return value;
    return new Date(value).valueOf();
}

/** A launch is upcoming when its scheduled moment is after `now`. Falls back
 *  to publishedAt until the scheduledAt field ships in the schema. */
export function isUpcoming(launch: UpcomingInput, now: DateLike): boolean {
    const scheduled = launch.scheduledAt ?? launch.publishedAt;
    return toTime(scheduled) > toTime(now);
}

/** True when publishedAt is within the trailing 30-day rolling window
 *  (inclusive, past only — future/scheduled launches are excluded). */
export function isIn30dWindow(publishedAt: DateLike, now: DateLike): boolean {
    const diff = toTime(now) - toTime(publishedAt);
    return diff >= 0 && diff <= WINDOW_30D_MS;
}

/** Split the time remaining until scheduledAt into day/hour/min/sec parts.
 *  Past dates clamp to zeros — never negative. */
export function countdownParts(scheduledAt: DateLike, now: DateLike): CountdownParts {
    const diff = toTime(scheduledAt) - toTime(now);
    if (!Number.isFinite(diff) || diff <= 0) {
        return { days: 0, hours: 0, mins: 0, secs: 0 };
    }
    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
    const mins = Math.floor((diff % HOUR_MS) / MIN_MS);
    const secs = Math.floor((diff % MIN_MS) / SEC_MS);
    return { days, hours, mins, secs };
}

/** ISO week key `YYYY-Www` (Monday-first, Thursday rule, UTC). */
export function weekKey(date: DateLike): string {
    const time = toTime(date);
    const src = new Date(time);
    // Work date in UTC day precision.
    const d = new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), src.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    d.setUTCDate(d.getUTCDate() - dayNum + 3); // shift to Thursday
    const isoYear = d.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    const weekNo = 1 + Math.round((d.valueOf() - firstThursday.valueOf()) / (7 * DAY_MS));
    return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
}

/** Backing velocity: votes plus triple-weighted discussion, per day live.
 *  Mirrors `launchVelocity` in frontend lib/content.ts without Astro. */
export function launchEventVelocity(
    launch: Pick<ScoredLaunchInput, 'publishedAt' | 'votes' | 'comments'>,
    now: DateLike,
): number {
    const days = Math.max(1, (toTime(now) - toTime(launch.publishedAt)) / DAY_MS);
    return (launch.votes + launch.comments * 3) / days;
}

/** Top-1 launch per ISO week by backing velocity. When `now` is omitted the
 *  newest publishedAt anchors the clock so results are deterministic in SSG
 *  and tests regardless of wall-clock time. Ties break by votes, then slug. */
export function weeklyWinners<T extends ScoredLaunchInput>(launches: T[], now?: DateLike): Map<string, T> {
    const anchor: number =
        now !== undefined
            ? toTime(now)
            : launches.reduce((max, launch) => Math.max(max, toTime(launch.publishedAt)), 0);
    const groups = new Map<string, T[]>();
    for (const launch of launches) {
        const key = weekKey(launch.publishedAt);
        const group = groups.get(key);
        if (group) group.push(launch);
        else groups.set(key, [launch]);
    }
    const winners = new Map<string, T>();
    const keys = [...groups.keys()].sort();
    for (const key of keys) {
        const group = groups.get(key) ?? [];
        let best: T | undefined;
        let bestScore = -Infinity;
        for (const launch of group) {
            const score = launchEventVelocity(launch, anchor);
            if (
                best === undefined ||
                score > bestScore ||
                (score === bestScore &&
                    (launch.votes > best.votes ||
                        (launch.votes === best.votes && launch.slug < best.slug)))
            ) {
                best = launch;
                bestScore = score;
            }
        }
        if (best) winners.set(key, best);
    }
    return winners;
}

/** Reply-norm nudge: how many comments still wait for a maker reply. */
export function unansweredCount(comments: ReplyableComment[]): number {
    let count = 0;
    for (const comment of comments) {
        if (!comment.makerReplyAt) count += 1;
    }
    return count;
}
