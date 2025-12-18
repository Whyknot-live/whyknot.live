// This file generates an XML sitemap for search engines
// It includes a small set of public pages with their last modification dates and priorities

const today = new Date().toISOString().slice(0, 10);

const pages = [
 {
 url: '/',
 lastmod: today,
 changefreq: 'weekly',
 priority: '1.0'
 },
 {
 url: '/about',
 lastmod: today,
 changefreq: 'monthly',
 priority: '0.8'
 },
 {
 url: '/contact',
 lastmod: today,
 changefreq: 'monthly',
 priority: '0.7'
 },
 {
 url: '/blog',
 lastmod: today,
 changefreq: 'weekly',
 priority: '0.9'
 },
 {
 url: '/privacy-policy',
 lastmod: today,
 changefreq: 'yearly',
 priority: '0.3'
 },
 {
 url: '/terms-of-service',
 lastmod: today,
 changefreq: 'yearly',
 priority: '0.3'
 }
];

// Astro.site is set in astro.config; use that at runtime via the `site` param

// Set proper headers for XML response
export async function GET({ site }: { site?: URL }) {
 const origin = site?.origin || (import.meta.env.SITE as string) || 'https://www.whyknot.live';
 // Generate XML sitemap
 const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages
.map(
 (page) => ` <url>
 <loc>${origin}${page.url}</loc>
 <lastmod>${page.lastmod}</lastmod>
 <changefreq>${page.changefreq}</changefreq>
 <priority>${page.priority}</priority>
 </url>`
 )
.join('\n')}
</urlset>`;

 return new Response(sitemapXml, {
 status: 200,
 headers: {
 'Content-Type': 'application/xml; charset=utf-8',
 // Cache for 1 day, allow stale-while-revalidate for 1 week
 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
 }
 });
}