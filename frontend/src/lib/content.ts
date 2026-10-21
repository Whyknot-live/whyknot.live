import { getCollection, type CollectionEntry } from 'astro:content';

export type SiteEntry = CollectionEntry<'sites'>;
export type LaunchEntry = CollectionEntry<'launches'>;
export type TopicEntry = CollectionEntry<'topics'>;
export type CollectionEntryData = CollectionEntry<'collections'>;

export type FlatSite = SiteEntry['data'] & {
    slug: string;
};

export type FlatLaunch = LaunchEntry['data'] & {
    slug: string;
};

export type FlatCollection = CollectionEntryData['data'] & {
    slug: string;
};

export type MakerEntry = CollectionEntry<'makers'>;

export type FlatTopic = TopicEntry['data'] & {
    slug: string;
};

export type FlatMaker = MakerEntry['data'] & {
    slug: string;
};

export async function getFlatSites(): Promise<FlatSite[]> {
    const entries = await getCollection('sites');
    return entries
        .map((entry) => ({ slug: entry.id, ...entry.data }))
        .sort((a, b) => b.score - a.score);
}

export async function getFlatLaunches(): Promise<FlatLaunch[]> {
    const entries = await getCollection('launches');
    return entries
        .map((entry) => ({ slug: entry.id, ...entry.data }))
        .sort((a, b) => a.rank - b.rank);
}

export async function getFlatCollections(): Promise<FlatCollection[]> {
    const entries = await getCollection('collections');
    return entries
        .map((entry) => ({ slug: entry.id, ...entry.data }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFlatTopics(): Promise<FlatTopic[]> {
    const entries = await getCollection('topics');
    return entries
        .map((entry) => ({ slug: entry.id, ...entry.data }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFlatMakers(): Promise<FlatMaker[]> {
    const entries = await getCollection('makers');
    return entries
        .map((entry) => ({ slug: entry.id, ...entry.data }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function launchesForMaker(launches: FlatLaunch[], handle: string): FlatLaunch[] {
    return launches.filter((launch) => launch.makerHandle === handle);
}

/** Backing velocity: votes plus triple-weighted discussion, per day live. */
export function launchVelocity(launch: FlatLaunch, now: number): number {
    const days = Math.max(1, (now - launch.publishedAt.valueOf()) / (24 * 60 * 60 * 1000));
    return (launch.votes + launch.comments * 3) / days;
}

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Single-value taxonomy facets present on a site. */
export type SiteFacetKey = 'category' | 'intent' | 'industry' | 'style';

export interface TaxonomyTerm {
    value: string;
    slug: string;
    count: number;
}

export function facetTerms(sites: FlatSite[], key: SiteFacetKey): TaxonomyTerm[] {
    const counts = new Map<string, { value: string; count: number }>();
    for (const site of sites) {
        const raw = site[key];
        if (!raw) continue;
        const slug = slugify(raw);
        const current = counts.get(slug) ?? { value: raw, count: 0 };
        current.count += 1;
        counts.set(slug, current);
    }
    return [...counts.entries()]
        .map(([slug, term]) => ({ ...term, slug }))
        .sort((a, b) => a.value.localeCompare(b.value));
}

export function sitesForFacet(sites: FlatSite[], key: SiteFacetKey, slug: string): FlatSite[] {
    return sites.filter((site) => site[key] && slugify(site[key] as string) === slug);
}

export function stackTerms(sites: FlatSite[]): TaxonomyTerm[] {
    const counts = new Map<string, { value: string; count: number }>();
    for (const site of sites) {
        for (const tech of site.stack) {
            const slug = slugify(tech);
            const current = counts.get(slug) ?? { value: tech, count: 0 };
            current.count += 1;
            counts.set(slug, current);
        }
    }
    return [...counts.entries()]
        .map(([slug, term]) => ({ ...term, slug }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function sitesForStack(sites: FlatSite[], slug: string): FlatSite[] {
    return sites.filter((site) => site.stack.some((tech) => slugify(tech) === slug));
}

/** Same-category first, then top-scored remainder. */
export function similarSites(sites: FlatSite[], current: FlatSite, count = 3): FlatSite[] {
    const others = sites.filter((site) => site.slug !== current.slug);
    const sameCategory = others.filter((site) => site.category === current.category);
    const rest = others.filter((site) => site.category !== current.category);
    return [...sameCategory, ...rest].slice(0, count);
}

export function collectionsForSite(collections: FlatCollection[], slug: string): FlatCollection[] {
    return collections.filter((collection) => collection.siteSlugs.includes(slug));
}

export function formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
}

// P1 launch-events thin wrappers (pure logic lives in ./launch-events, Astro-free).
// launchDayBounds lives there too so it is testable: it anchors on the newest
// NON-scheduled publishedAt (see launch-events.ts) and never on a future slot.
export { isIn30dWindow, isUpcoming, isScheduled, liveOnly, launchDayBounds, weeklyWinners, countdownParts, weekKey, rankedRecent } from './launch-events';
export function launchScheduledAt(l: FlatLaunch): Date {
    return (l as unknown as { scheduledAt?: Date }).scheduledAt ?? l.publishedAt;
}
export function monthBoard(ls: FlatLaunch[], now: number): FlatLaunch[] {
    return ls.filter((l) => l.publishedAt.valueOf() <= now && now - l.publishedAt.valueOf() <= 30 * 24 * 60 * 60 * 1000)
        .sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf());
}
