import { describe, it } from 'node:test'
import assert from 'node:assert'
import { z } from 'zod'
import {
  CLAIM_METHODS,
  DOMAIN_RE,
  VERIFY_TOKEN_RE,
  buildExpectedValue,
  isBlockedHostname,
  isPrivateIp,
  isPrivateIpv4,
  matchFileBody,
  matchMetaHtml,
  normalizeDomain,
  verificationFilePath,
} from '../utils/verify-checks'

const TOKEN = '9f3c1a2b4d5e6f708192a3b4c5d6e7f8'

describe('Claim token format', () => {
  it('accepts a 32-char lowercase hex token', () => {
    assert.strictEqual(VERIFY_TOKEN_RE.test(TOKEN), true)
  })

  it('rejects short, long, uppercase, and non-hex tokens', () => {
    assert.strictEqual(VERIFY_TOKEN_RE.test('abc123'), false)
    assert.strictEqual(VERIFY_TOKEN_RE.test(`${TOKEN}00`), false)
    assert.strictEqual(VERIFY_TOKEN_RE.test(TOKEN.toUpperCase()), false)
    assert.strictEqual(VERIFY_TOKEN_RE.test('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'), false)
    assert.strictEqual(VERIFY_TOKEN_RE.test(''), false)
  })
})

describe('Claim domain normalize', () => {
  it('lowercases and strips protocol, path, query, and port', () => {
    assert.strictEqual(normalizeDomain('https://Example.COM/blog?x=1'), 'example.com')
    assert.strictEqual(normalizeDomain('http://EXAMPLE.com:8080/'), 'example.com')
    assert.strictEqual(normalizeDomain('  Acme.IO. '), 'acme.io')
  })

  it('keeps subdomains intact', () => {
    assert.strictEqual(normalizeDomain('https://app.example.com/'), 'app.example.com')
  })

  it('validates public hostnames with DOMAIN_RE', () => {
    assert.strictEqual(DOMAIN_RE.test('example.com'), true)
    assert.strictEqual(DOMAIN_RE.test('app.example.co.uk'), true)
    assert.strictEqual(DOMAIN_RE.test('not a domain'), false)
    assert.strictEqual(DOMAIN_RE.test('localhost'), false)
    assert.strictEqual(DOMAIN_RE.test(''), false)
  })
})

describe('Claim method validation', () => {
  const schema = z.object({ method: z.enum(CLAIM_METHODS as unknown as ['dns', 'file', 'meta']) })

  it('accepts dns, file, and meta', () => {
    for (const method of CLAIM_METHODS) {
      assert.strictEqual(schema.safeParse({ method }).success, true)
    }
  })

  it('rejects unknown methods', () => {
    assert.strictEqual(schema.safeParse({ method: 'api-key' }).success, false)
    assert.strictEqual(schema.safeParse({ method: '' }).success, false)
    assert.strictEqual(schema.safeParse({}).success, false)
  })
})

describe('Claim SSRF guard', () => {
  it('blocks localhost variants', () => {
    assert.strictEqual(isBlockedHostname('localhost'), true)
    assert.strictEqual(isBlockedHostname('LOCALHOST'), true)
    assert.strictEqual(isBlockedHostname('app.localhost'), true)
  })

  it('blocks private IPv4 literals', () => {
    assert.strictEqual(isBlockedHostname('127.0.0.1'), true)
    assert.strictEqual(isBlockedHostname('10.0.0.5'), true)
    assert.strictEqual(isBlockedHostname('192.168.1.1'), true)
    assert.strictEqual(isBlockedHostname('172.16.4.2'), true)
    assert.strictEqual(isPrivateIpv4('172.31.255.255'), true)
    assert.strictEqual(isPrivateIpv4('172.32.0.1'), false)
  })

  it('blocks loopback IPv6', () => {
    assert.strictEqual(isPrivateIp('::1'), true)
    assert.strictEqual(isBlockedHostname('::1'), true)
  })

  it('allows public domains', () => {
    assert.strictEqual(isBlockedHostname('example.com'), false)
    assert.strictEqual(isBlockedHostname('app.example.co.uk'), false)
    assert.strictEqual(isPrivateIp('93.184.216.34'), false)
  })
})

describe('Claim file matcher', () => {
  it('matches the exact expected value in the body', () => {
    const body = `<html><body>${buildExpectedValue(TOKEN)}</body></html>`
    assert.strictEqual(matchFileBody(body, TOKEN), true)
  })

  it('rejects bodies with a different token or bare token', () => {
    assert.strictEqual(matchFileBody('whyknot-verify=wrongtoken', TOKEN), false)
    assert.strictEqual(matchFileBody(TOKEN, TOKEN), false)
    assert.strictEqual(matchFileBody('', TOKEN), false)
  })

  it('builds the canonical file path', () => {
    assert.strictEqual(verificationFilePath(TOKEN), `/whyknot-verify-${TOKEN}.html`)
  })
})

describe('Claim meta matcher', () => {
  const tag = `<meta name="whyknot-verify" content="${TOKEN}">`

  it('matches name-first tag on a fixture homepage', () => {
    const html = `<!doctype html><html><head>${tag}<title>x</title></head><body>hi</body></html>`
    assert.strictEqual(matchMetaHtml(html, TOKEN), true)
  })

  it('matches content-first attribute order', () => {
    const html = `<head><meta content="${TOKEN}" name="whyknot-verify" /></head>`
    assert.strictEqual(matchMetaHtml(html, TOKEN), true)
  })

  it('matches single quotes, extra attributes, and case differences', () => {
    const html = `<HEAD><META NAME='whyknot-verify' DATA-x="1" CONTENT='${TOKEN}'></HEAD>`
    assert.strictEqual(matchMetaHtml(html, TOKEN), true)
  })

  it('rejects wrong tokens and unrelated meta tags', () => {
    assert.strictEqual(matchMetaHtml(tag.replace(TOKEN, 'wrongtoken'), TOKEN), false)
    assert.strictEqual(matchMetaHtml('<meta name="description" content="hi">', TOKEN), false)
    assert.strictEqual(matchMetaHtml('', TOKEN), false)
  })
})
