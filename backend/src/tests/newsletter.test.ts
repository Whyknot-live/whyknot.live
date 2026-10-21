import { describe, it } from 'node:test'
import assert from 'node:assert'
import { isValidNewsletterEmail, createUnsubscribeToken, verifyUnsubscribeToken } from '../routes/newsletter'
import { buildNewsletterHtml, buildNewsletterText } from '../templates/newsletter-531'
import type { NewsletterEntry } from '../templates/newsletter-531'
import { buildIssueFromContent, sendIssueToSubscribers } from '../jobs/send-newsletter'
import { sendNewsletterEmail } from '../utils/email'

function entry(name: string, sponsored = false): NewsletterEntry {
    return { name, tagline: `${name} tagline`, url: `https://example.com/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, sponsored }
}

describe('Newsletter email validation', () => {
    it('accepts valid emails', () => {
        assert.strictEqual(isValidNewsletterEmail('reader@example.com'), true)
        assert.strictEqual(isValidNewsletterEmail('a.b+tag@whyknot.live'), true)
    })

    it('rejects invalid emails', () => {
        assert.strictEqual(isValidNewsletterEmail('not-an-email'), false)
        assert.strictEqual(isValidNewsletterEmail(''), false)
        assert.strictEqual(isValidNewsletterEmail(null), false)
        assert.strictEqual(isValidNewsletterEmail(undefined), false)
        assert.strictEqual(isValidNewsletterEmail('a'.repeat(250) + '@x.com'), false)
    })
})

describe('Newsletter 5-3-1 assembler', () => {
    it('assembles 5 rising, 3 deals, 1 underdog', async () => {
        const rising = [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')]
        const deals = [entry('D1'), entry('D2'), entry('D3')]
        const underdog = entry('U1')
        const issue = await buildIssueFromContent(rising, deals, underdog, undefined, {
            number: 4,
            slug: 'issue-4-test',
            subject: 'Test issue',
            date: '2026-09-06',
        })
        assert.strictEqual(issue.rising.length, 5)
        assert.strictEqual(issue.deals.length, 3)
        assert.strictEqual(issue.underdog.name, 'U1')
        assert.strictEqual(issue.number, 4)
        assert.strictEqual(issue.slug, 'issue-4-test')
    })

    it('rejects wrong counts', async () => {
        await assert.rejects(() => buildIssueFromContent([entry('R1')], [entry('D1'), entry('D2'), entry('D3')], entry('U1')))
        await assert.rejects(() => buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')],
            [entry('D1')],
            entry('U1'),
        ))
    })
})

describe('Newsletter Sponsored label', () => {
    it('always renders a Sponsored label even with house (unsold) slot', async () => {
        const issue = await buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')],
            [entry('D1'), entry('D2'), entry('D3')],
            entry('U1'),
            undefined,
            { number: 1, slug: 'issue-1', subject: 'S', date: '2026-08-16' },
        )
        const html = buildNewsletterHtml(issue)
        const text = buildNewsletterText(issue)
        assert.ok(html.includes('Sponsored'), 'HTML must contain Sponsored label (house slot)')
        assert.ok(text.includes('Sponsored'), 'text must contain Sponsored label (house slot)')
    })

    it('labels sponsored deals inline', async () => {
        const issue = await buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')],
            [entry('D1', true), entry('D2'), entry('D3')],
            entry('U1'),
            { name: 'Acme', tagline: 'Paid slot', url: 'https://example.com/acme', sponsored: true },
            { number: 2, slug: 'issue-2', subject: 'S', date: '2026-08-23' },
        )
        const html = buildNewsletterHtml(issue)
        assert.ok(html.includes('Sponsored'), 'HTML must label sponsored deal')
        assert.ok(html.includes('Acme'), 'HTML must include paid sponsor name')
    })

    it('escapes untrusted content', async () => {
        const evil = await buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), { ...entry('R5'), name: '<script>alert(1)</script>' }],
            [entry('D1'), entry('D2'), entry('D3')],
            entry('U1'),
            undefined,
            { number: 3, slug: 'issue-3', subject: 'S', date: '2026-08-30' },
        )
        const html = buildNewsletterHtml(evil)
        assert.ok(!html.includes('<script>alert(1)</script>'), 'must escape entry names')
        assert.ok(html.includes('&lt;script&gt;'), 'must HTML-escape angle brackets')
    })
})

describe('Newsletter unsubscribe token round-trip', () => {
    const secret = 'fixture-newsletter-secret-123'

    it('verifies a token it created', () => {
        const token = createUnsubscribeToken('Reader@Example.com', secret)
        assert.strictEqual(verifyUnsubscribeToken('reader@example.com', token, secret), true)
        assert.strictEqual(verifyUnsubscribeToken('Reader@Example.com', token, secret), true)
    })

    it('rejects tampered tokens and wrong secrets', () => {
        const token = createUnsubscribeToken('reader@example.com', secret)
        assert.strictEqual(verifyUnsubscribeToken('reader@example.com', 'deadbeef'.repeat(8), secret), false)
        assert.strictEqual(verifyUnsubscribeToken('other@example.com', token, secret), false)
        assert.strictEqual(verifyUnsubscribeToken('reader@example.com', token, 'wrong-secret'), false)
    })
})

describe('Newsletter confirm email', () => {
    it('renders the confirm link and escapes the address', async () => {
        const { buildConfirmEmailHtml, buildConfirmEmailText } = await import('../templates/newsletter-confirm')
        const html = buildConfirmEmailHtml({ email: 'reader@example.com', confirmUrl: 'https://www.whyknot.live/newsletter/confirm?token=abc123' })
        assert.ok(html.includes('https://www.whyknot.live/newsletter/confirm?token=abc123'))
        assert.ok(html.includes('reader@example.com'))
        const text = buildConfirmEmailText({ email: 'reader@example.com', confirmUrl: 'https://www.whyknot.live/newsletter/confirm?token=abc123' })
        assert.ok(text.includes('https://www.whyknot.live/newsletter/confirm?token=abc123'))
    })

    it('escapes HTML in the address so a crafted email cannot inject markup', async () => {
        const { buildConfirmEmailHtml } = await import('../templates/newsletter-confirm')
        const html = buildConfirmEmailHtml({ email: '"><script>alert(1)</script>@x.com', confirmUrl: 'https://www.whyknot.live/newsletter/confirm?token=abc123' })
        assert.ok(!html.includes('<script>alert(1)</script>'))
        assert.ok(html.includes('&lt;script&gt;'))
    })
})

describe('sendIssueToSubscribers', () => {
    async function fixtureIssue() {
        return buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')],
            [entry('D1'), entry('D2'), entry('D3')],
            entry('U1'),
            undefined,
            { number: 5, slug: 'issue-5-test', subject: 'Test issue', date: '2026-10-08' },
        )
    }

    it('sends to every recipient with a per-recipient unsubscribe link', async () => {
        const issue = await fixtureIssue()
        const sent: Array<{ to: string; html: string }> = []
        const run = await sendIssueToSubscribers({
            issue,
            recipients: [
                { email: 'a@example.com', unsubscribeToken: 'tok-a' },
                { email: 'b@example.com', unsubscribeToken: 'tok-b' },
            ],
            send: async (to, _subject, html) => {
                sent.push({ to, html })
                return true
            },
            siteBase: 'https://www.whyknot.live',
        })
        assert.strictEqual(run.sent, 2)
        assert.strictEqual(run.failed, 0)
        assert.strictEqual(run.sponsor, false)
        assert.strictEqual(sent.length, 2)
        assert.ok(sent[0].html.includes('/newsletter/unsubscribe?token=tok-a'))
        assert.ok(sent[1].html.includes('/newsletter/unsubscribe?token=tok-b'))
        assert.ok(!sent[0].html.includes('tok-b'))
    })

    it('records a failing recipient without throwing and flags a paid sponsor', async () => {
        const issue = await buildIssueFromContent(
            [entry('R1'), entry('R2'), entry('R3'), entry('R4'), entry('R5')],
            [entry('D1'), entry('D2'), entry('D3')],
            entry('U1'),
            { name: 'Paid Sponsor', tagline: 'A paid slot', url: 'https://sponsor.example', sponsored: true },
            { number: 5, slug: 'issue-5-test', subject: 'Test issue', date: '2026-10-08' },
        )
        const run = await sendIssueToSubscribers({
            issue,
            recipients: [
                { email: 'a@example.com', unsubscribeToken: 'tok-a' },
                { email: 'b@example.com', unsubscribeToken: 'tok-b' },
            ],
            send: async (to) => {
                if (to === 'b@example.com') throw new Error('provider down')
                return true
            },
        })
        assert.strictEqual(run.sent, 1)
        assert.strictEqual(run.failed, 1)
        assert.strictEqual(run.sponsor, true)
        assert.strictEqual(run.attempts[1].ok, false)
        assert.strictEqual(run.attempts[1].error, 'provider down')
    })
})

describe('sendNewsletterEmail gating', () => {
    it('no-ops without RESEND_API_KEY and never throws', async () => {
        const savedEnable = process.env.ENABLE_EMAIL
        const savedKey = process.env.RESEND_API_KEY
        process.env.ENABLE_EMAIL = '1'
        delete process.env.RESEND_API_KEY
        try {
            const result = await sendNewsletterEmail({
                to: 'reader@example.com',
                subject: 'x',
                html: '<p>x</p>',
                text: 'x',
                tags: [{ name: 'category', value: 'newsletter' }],
            })
            assert.strictEqual(result.ok, false)
            assert.strictEqual(result.reason, 'no_key')
        } finally {
            if (savedEnable === undefined) delete process.env.ENABLE_EMAIL
            else process.env.ENABLE_EMAIL = savedEnable
            if (savedKey === undefined) delete process.env.RESEND_API_KEY
            else process.env.RESEND_API_KEY = savedKey
        }
    })
})
