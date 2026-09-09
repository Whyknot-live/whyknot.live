import { getCollection } from 'astro:content';

export async function getStaticPaths() {
    const sites = await getCollection('sites');
    return sites.map((entry) => ({ params: { slug: entry.id } }));
}

function line(label: string, value: string | number): string {
    return `- **${label}:** ${value}`;
}

export async function GET({ params }: { params: { slug: string } }) {
    const sites = await getCollection('sites');
    const entry = sites.find((item) => item.id === params.slug);
    if (!entry) {
        return new Response('Not found', { status: 404 });
    }
    const site = { slug: entry.id, ...entry.data };
    const published = site.publishedAt instanceof Date ? site.publishedAt.toISOString().slice(0, 10) : String(site.publishedAt);
    const body = [
        `# ${site.name}`,
        '',
        `> ${site.tagline}`,
        '',
        line('URL', site.url),
        line('Type', site.type),
        line('Category', site.category),
        line('WhyKnot score', `${site.score}/100`),
        line('Performance', `${site.performance}/100`),
        line('Accessibility', site.accessibility ?? 'awaiting scan'),
        line('SEO', site.seo ?? 'awaiting scan'),
        line('Best practices', site.bestPractices ?? 'awaiting scan'),
        line('Verification', site.verified ? 'verified (domain ownership)' : 'unverified'),
        ...(site.audience ? [line('Audience', site.audience)] : []),
        ...(site.businessModel ? [line('Business model', site.businessModel)] : []),
        ...(site.stack.length > 0 ? [line('Technology (detected, heuristic)', site.stack.join(', '))] : []),
        line('Added', published),
        line('Profile', `https://www.whyknot.live/sites/${site.slug}`),
        '',
        '_Automated fields are heuristic detections with stated confidence. See the profile for provenance._',
        '',
    ].join('\n');

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
    });
}
