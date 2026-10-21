import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
    buildEditorsPickBadgeHtml,
    buildRankBadgeHtml,
    buildScoreBadgeHtml,
    buildVerifiedBadgeHtml,
    embedProfileUrl,
} from './embed-badges'

describe('embedProfileUrl', () => {
    it('bakes UTM params into the profile link', () => {
        assert.strictEqual(
            embedProfileUrl('sites', 'arcade-atlas'),
            'https://www.whyknot.live/sites/arcade-atlas?utm_source=embed&utm_medium=badge&utm_campaign=whyknot-badges',
        )
    })
})

describe('score badge snippet', () => {
    const input = { slug: 'arcade-atlas', name: 'Arcade Atlas', score: 96 }

    it('contains the score, the site link and UTM', () => {
        const html = buildScoreBadgeHtml(input)
        assert.ok(html.includes('>96</span>'))
        assert.ok(html.includes(embedProfileUrl('sites', 'arcade-atlas').replace(/&/g, '&amp;')))
        assert.ok(html.includes('target="_blank"'))
        assert.ok(html.includes('rel="noopener noreferrer"'))
    })

    it('auto theme ships a prefers-color-scheme override; light theme does not', () => {
        const auto = buildScoreBadgeHtml(input, { theme: 'auto' })
        assert.ok(auto.includes('@media (prefers-color-scheme:dark)'))
        const light = buildScoreBadgeHtml(input, { theme: 'light' })
        assert.ok(!light.includes('prefers-color-scheme'))
        const dark = buildScoreBadgeHtml(input, { theme: 'dark' })
        assert.ok(!dark.includes('prefers-color-scheme'))
        assert.ok(dark.includes('#163330'))
    })

    it('sizes change the box metrics', () => {
        const sm = buildScoreBadgeHtml(input, { size: 'sm' })
        const lg = buildScoreBadgeHtml(input, { size: 'lg' })
        assert.ok(sm.includes('font-size:10px'))
        assert.ok(lg.includes('font-size:14px'))
        assert.notStrictEqual(sm, lg)
    })

    it('never contains a script — zero-JS by contract', () => {
        assert.ok(!buildScoreBadgeHtml(input).includes('<script'))
        assert.ok(!buildVerifiedBadgeHtml({ slug: 'arcade-atlas', name: 'Arcade Atlas' }).includes('<script'))
    })
})

describe('verified badge snippet', () => {
    it('renders a checkmark and the verified label', () => {
        const html = buildVerifiedBadgeHtml({ slug: 'arcade-atlas', name: 'Arcade Atlas' })
        assert.ok(html.includes('polyline'))
        assert.ok(html.includes('Verified on WhyKnot'))
    })
})

describe('editor\'s pick badge snippet', () => {
    const base = { slug: 'nova-pad', name: 'Nova Pad', rank: 4 }

    it('renders only for launches that carry the badge', () => {
        assert.ok(buildEditorsPickBadgeHtml({ ...base, badge: "Editor's Pick" }).includes("Editor's Pick"))
        assert.strictEqual(buildEditorsPickBadgeHtml({ ...base, badge: 'Screened' }), '')
        assert.strictEqual(buildEditorsPickBadgeHtml(base), '')
    })
})

describe('rank badge snippet', () => {
    it('renders the rank and the launch link', () => {
        const html = buildRankBadgeHtml({ slug: 'nova-pad', name: 'Nova Pad', rank: 4 })
        assert.ok(html.includes('#4'))
        assert.ok(html.includes(embedProfileUrl('launches', 'nova-pad').replace(/&/g, '&amp;')))
    })
})
