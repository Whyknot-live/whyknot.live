import { getFlatSites, getFlatCollections, getFlatTopics } from '../lib/content';

export async function GET() {
    const [sites, collections, topics] = await Promise.all([getFlatSites(), getFlatCollections(), getFlatTopics()]);
    const lines = [
        '# WhyKnot',
        '',
        '> Discover exceptional websites: scored for quality and performance, labeled by verification state.',
        '',
        '## Browse',
        '',
        '- Discover: https://www.whyknot.live/discover',
        '- Trending: https://www.whyknot.live/trending',
        '- Rising: https://www.whyknot.live/rising',
        '- New: https://www.whyknot.live/new',
        "- Editor's picks: https://www.whyknot.live/editors-picks",
        '- Collections: https://www.whyknot.live/collections',
        '- Topics: https://www.whyknot.live/topics',
        '',
        '## Sites',
        '',
        ...sites.map((site) => `- [${site.name}](https://www.whyknot.live/sites/${site.slug}): ${site.tagline} (score ${site.score})`),
        '',
        '## Collections',
        '',
        ...collections.map(
            (collection) => `- [${collection.name}](https://www.whyknot.live/collections/${collection.slug}): ${collection.description}`,
        ),
        '',
        '## Topics',
        '',
        ...topics.map((topic) => `- [${topic.name}](https://www.whyknot.live/topics/${topic.slug}): ${topic.description}`),
        '',
        '## Machine-readable profiles',
        '',
        ...sites.map((site) => `- [${site.name} report](https://www.whyknot.live/sites/${site.slug}/report.md)`),
        '',
        'Full profiles with provenance: https://www.whyknot.live/llms-full.txt',
        '',
    ];

    return new Response(lines.join('\n'), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
    });
}
