// XML sitemap: static pages plus every content-driven public URL.
// /search is intentionally excluded (noindex). Filter/sort states create no URLs.
import { getFlatSites, getFlatCollections, getFlatTopics, getFlatLaunches, getFlatMakers, facetTerms, stackTerms } from '../lib/content';
import { weeklyWinners } from '../lib/launch-events';
import newsletterSeed from '../content/newsletter.json';

const today = new Date().toISOString().slice(0, 10);

interface SitemapEntry {
    url: string;
    lastmod: string;
    changefreq: string;
    priority: string;
}

const STATIC_PAGES: SitemapEntry[] = [
    { url: '/', lastmod: today, changefreq: 'weekly', priority: '1.0' },
    { url: '/discover', lastmod: today, changefreq: 'daily', priority: '0.9' },
    { url: '/trending', lastmod: today, changefreq: 'daily', priority: '0.8' },
    { url: '/rising', lastmod: today, changefreq: 'daily', priority: '0.8' },
    { url: '/new', lastmod: today, changefreq: 'daily', priority: '0.8' },
    { url: '/editors-picks', lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { url: '/collections', lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { url: '/topics', lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { url: '/launches', lastmod: today, changefreq: 'daily', priority: '0.8' },
    { url: '/launches/week', lastmod: today, changefreq: 'daily', priority: '0.6' },
    { url: '/launches/rising', lastmod: today, changefreq: 'daily', priority: '0.6' },
    { url: '/launches/month', lastmod: today, changefreq: 'daily', priority: '0.6' },
    { url: '/launches/upcoming', lastmod: today, changefreq: 'daily', priority: '0.6' },
    { url: '/launches/winners', lastmod: today, changefreq: 'weekly', priority: '0.6' },
    { url: '/sponsor', lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { url: '/newsletter', lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { url: '/badges', lastmod: today, changefreq: 'monthly', priority: '0.5' },
    { url: '/maker/claim', lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { url: '/submit', lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { url: '/verify', lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { url: '/verified', lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { url: '/pricing', lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { url: '/about', lastmod: today, changefreq: 'monthly', priority: '0.8' },
    { url: '/contact', lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { url: '/blog', lastmod: today, changefreq: 'weekly', priority: '0.9' },
    { url: '/design-system', lastmod: today, changefreq: 'monthly', priority: '0.4' },
    { url: '/legal/methodology', lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { url: '/privacy-policy', lastmod: today, changefreq: 'yearly', priority: '0.3' },
    { url: '/terms-of-service', lastmod: today, changefreq: 'yearly', priority: '0.3' },
];

export async function GET({ site }: { site?: URL }) {
    const origin = site?.origin || (import.meta.env.SITE as string) || 'https://www.whyknot.live';
    const [sites, collections, topics, launches, makers] = await Promise.all([
        getFlatSites(),
        getFlatCollections(),
        getFlatTopics(),
        getFlatLaunches(),
        getFlatMakers(),
    ]);

    const pages: SitemapEntry[] = [...STATIC_PAGES];
    for (const entry of sites) {
        pages.push({ url: `/sites/${entry.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.9' });
    }
    for (const term of facetTerms(sites, 'category')) {
        pages.push({ url: `/categories/${term.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
    }
    for (const term of stackTerms(sites)) {
        pages.push({ url: `/stack/${term.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.6' });
    }
    for (const topic of topics) {
        pages.push({ url: `/topics/${topic.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.6' });
    }
    for (const collection of collections) {
        pages.push({ url: `/collections/${collection.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
    }
    for (const launch of launches) {
        pages.push({ url: `/launches/${launch.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.8' });
    }
    for (const maker of makers) {
        pages.push({ url: `/maker/${maker.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.6' });
    }
    for (const week of weeklyWinners(launches).keys()) {
        pages.push({ url: `/launches/winners/${week}`, lastmod: today, changefreq: 'weekly', priority: '0.5' });
    }
    for (const issue of ((newsletterSeed as { issues?: { slug: string }[] }).issues ?? [])) {
        pages.push({ url: `/newsletter/${issue.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.6' });
    }

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages
    .map(
        (page) => ` <url>
  <loc>${origin}${page.url}</loc>
  <lastmod>${page.lastmod}</lastmod>
  <changefreq>${page.changefreq}</changefreq>
  <priority>${page.priority}</priority>
  </url>`,
    )
    .join('\n')}
</urlset>`;

    return new Response(sitemapXml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
    });
}
