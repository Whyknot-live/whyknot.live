/* Facet registry — one config drives every taxonomy route
   (/categories, /intent, /industries, /styles, /stack, /topics).
   Route files stay thin wrappers so URLs never churn; all copy and matching
   rules live here. See docs/roadmap P0 (facet collapse). */
import {
    getFlatSites,
    getFlatTopics,
    facetTerms,
    sitesForFacet,
    stackTerms,
    sitesForStack,
    slugify,
    type FlatSite,
    type SiteFacetKey,
    type TaxonomyTerm,
} from './content';

export interface FacetPageProps {
    value: string;
    sites: FlatSite[];
    description?: string;
}

export interface FacetDef {
    base: string;
    eyebrow: string;
    parentLabel: string;
    parentHref: string;
    heading: (value: string) => string;
    pageTitle: (value: string) => string;
    description: (value: string) => string;
    crumb: (value: string) => string;
    emptyTitle: (value: string) => string;
    paths: () => Promise<{ params: { slug: string }; props: FacetPageProps }[]>;
}

async function facetPaths(
    key: SiteFacetKey,
): Promise<{ params: { slug: string }; props: FacetPageProps }[]> {
    const sites = await getFlatSites();
    return facetTerms(sites, key).map((term: TaxonomyTerm) => ({
        params: { slug: term.slug },
        props: { value: term.value, sites: sitesForFacet(sites, key, term.slug) },
    }));
}

export const FACETS: Record<'categories' | 'intent' | 'industries' | 'styles' | 'stack' | 'topics', FacetDef> = {
    categories: {
        base: 'categories',
        eyebrow: 'Category',
        parentLabel: 'Discover',
        parentHref: '/discover',
        heading: (v) => `${v} websites`,
        pageTitle: (v) => `${v} websites worth exploring | WhyKnot`,
        description: (v) => `Exceptional ${v.toLowerCase()} websites, tools, and digital experiences: curated, scored, and verified by WhyKnot.`,
        crumb: (v) => v,
        emptyTitle: (v) => `No ${v.toLowerCase()} sites yet`,
        paths: () => facetPaths('category'),
    },
    intent: {
        base: 'intent',
        eyebrow: 'Intent',
        parentLabel: 'Discover',
        parentHref: '/discover',
        heading: (v) => `Websites for ${v}`,
        pageTitle: (v) => `Websites for ${v} | WhyKnot`,
        description: (v) => `Exceptional websites picked for one intent: ${v}. Curated, scored, and verified by WhyKnot.`,
        crumb: (v) => `Intent: ${v}`,
        emptyTitle: () => 'Nothing here yet',
        paths: () => facetPaths('intent'),
    },
    industries: {
        base: 'industries',
        eyebrow: 'Industry',
        parentLabel: 'Discover',
        parentHref: '/discover',
        heading: (v) => `${v} websites`,
        pageTitle: (v) => `${v} industry websites | WhyKnot`,
        description: (v) => `Exceptional websites in ${v}: curated, scored, and verified by WhyKnot.`,
        crumb: (v) => `Industry: ${v}`,
        emptyTitle: () => 'Nothing here yet',
        paths: () => facetPaths('industry'),
    },
    styles: {
        base: 'styles',
        eyebrow: 'Visual style',
        parentLabel: 'Discover',
        parentHref: '/discover',
        heading: (v) => `${v} design`,
        pageTitle: (v) => `${v} style websites | WhyKnot`,
        description: (v) => `Websites with exceptional ${v.toLowerCase()} design: curated, scored, and verified by WhyKnot.`,
        crumb: (v) => `Style: ${v}`,
        emptyTitle: () => 'Nothing here yet',
        paths: () => facetPaths('style'),
    },
    stack: {
        base: 'stack',
        eyebrow: 'Technology',
        parentLabel: 'Discover',
        parentHref: '/discover',
        heading: (v) => `Built with ${v}`,
        pageTitle: (v) => `Websites built with ${v} | WhyKnot`,
        description: (v) => `Exceptional websites detected running ${v}: curated, scored, and verified by WhyKnot. Stack detection is heuristic; confidence is shown per profile.`,
        crumb: (v) => `Stack: ${v}`,
        emptyTitle: () => 'Nothing here yet',
        paths: async () => {
            const sites = await getFlatSites();
            return stackTerms(sites).map((term: TaxonomyTerm) => ({
                params: { slug: term.slug },
                props: { value: term.value, sites: sitesForStack(sites, term.slug) },
            }));
        },
    },
    topics: {
        base: 'topics',
        eyebrow: 'Topic',
        parentLabel: 'Topics',
        parentHref: '/topics',
        heading: (v) => v,
        pageTitle: (v) => `${v} | WhyKnot`,
        description: () => '',
        crumb: (v) => v,
        emptyTitle: () => 'Nothing here yet',
        paths: async () => {
            const topics = await getFlatTopics();
            const sites = await getFlatSites();
            return topics.map((topic) => ({
                params: { slug: topic.slug },
                props: {
                    value: topic.name,
                    sites: sites.filter((site) => slugify(site.category) === topic.slug),
                    description: topic.description,
                },
            }));
        },
    },
};
