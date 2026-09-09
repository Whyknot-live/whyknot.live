import { getFlatSites, formatDate } from '../lib/content';

export async function GET() {
    const sites = await getFlatSites();
    const sections = sites.map((site) => {
        const facts = [
            `# ${site.name} (https://www.whyknot.live/sites/${site.slug})`,
            '',
            `> ${site.tagline}`,
            '',
            `- URL: ${site.url}`,
            `- Type: ${site.type} / Category: ${site.category}`,
            `- WhyKnot score: ${site.score}/100 (editorial + automated screening)`,
            `- Performance: ${site.performance}/100`,
            `- Accessibility: ${site.accessibility ?? 'awaiting scan'}`,
            `- SEO: ${site.seo ?? 'awaiting scan'}`,
            `- Best practices: ${site.bestPractices ?? 'awaiting scan'}`,
            `- Verification: ${site.verified ? 'verified domain ownership' : 'unverified'}`,
            ...(site.audience ? [`- Audience: ${site.audience}`] : []),
            ...(site.businessModel ? [`- Business model: ${site.businessModel}`] : []),
            ...(site.stack.length > 0 ? [`- Technology (detected, heuristic): ${site.stack.join(', ')}`] : []),
            `- Added: ${formatDate(site.publishedAt)}`,
            ...(site.editorNote ? ['', `Editor's note: ${site.editorNote}`] : []),
        ];
        return facts.join('\n');
    });

    const body = ['# WhyKnot: full library', '', ...sections.flatMap((section) => [section, '', '---', ''])].join('\n');

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
    });
}
