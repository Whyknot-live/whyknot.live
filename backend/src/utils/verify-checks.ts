/**
 * Maker-claim verification checkers (C2: DNS + file + meta only, no third-party).
 *
 * Pure helpers (normalizeDomain, matchFileBody, matchMetaHtml, SSRF guards)
 * are intentionally network-free so they can be unit-tested without I/O.
 * Effectful checkers (checkDnsTxt, checkFile, checkMeta, runCheck) perform
 * live verification with a 5s timeout, manual redirects, and an SSRF guard
 * that blocks localhost / private IPs before any outbound request.
 */
import { resolveTxt, lookup } from 'node:dns/promises'

export type ClaimMethod = 'dns' | 'file' | 'meta'

export const CLAIM_METHODS: readonly ClaimMethod[] = ['dns', 'file', 'meta'] as const

/** Token format: 32 lowercase hex chars (crypto.randomBytes(16)). */
export const VERIFY_TOKEN_RE = /^[0-9a-f]{32}$/

/** Hostname shape for a public domain (requires at least one dot). */
export const DOMAIN_RE = /^(?=.{1,253}\.?$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\.?$/i

const FETCH_TIMEOUT_MS = 5000
const MAX_BODY_BYTES = 1024 * 1024 // 1MB cap for homepage fetches
const VERIFY_USER_AGENT = 'whyknot-verify/1.0'

export type CheckResult = { ok: boolean; detail: string }

/**
 * Normalize user-supplied domain input: strip protocol, path, query, port,
 * lowercase, and trim trailing dots/whitespace.
 * e.g. "https://Example.COM/blog?x=1 " -> "example.com"
 */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase()
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const slash = value.indexOf('/')
  if (slash !== -1) value = value.slice(0, slash)
  const query = value.indexOf('?')
  if (query !== -1) value = value.slice(0, query)
  const hash = value.indexOf('#')
  if (hash !== -1) value = value.slice(0, hash)
  // Strip port (but leave IPv6 literals alone)
  if (!value.startsWith('[') && value.includes(':')) {
    const lastColon = value.lastIndexOf(':')
    const after = value.slice(lastColon + 1)
    if (/^\d+$/.test(after)) value = value.slice(0, lastColon)
  }
  // Strip userinfo if present
  const at = value.lastIndexOf('@')
  if (at !== -1) value = value.slice(at + 1)
  value = value.replace(/\.+$/, '').trim()
  return value
}

/** Exact TXT value we look for in DNS / file / meta. */
export function buildExpectedValue(token: string): string {
  return `whyknot-verify=${token}`
}

/** Path of the verification file served from the site root. */
export function verificationFilePath(token: string): string {
  return `/whyknot-verify-${token}.html`
}

/** File method passes when the served body contains the expected value. */
export function matchFileBody(body: string, token: string): boolean {
  return body.includes(buildExpectedValue(token))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Meta method passes when the homepage HTML contains
 * <meta name="whyknot-verify" content="TOKEN"> in either attribute order,
 * single or double quotes, extra attributes allowed, case-insensitive.
 */
export function matchMetaHtml(html: string, token: string): boolean {
  const t = escapeRegExp(token)
  const nameFirst = new RegExp(
    `<meta\\s+[^>]*name\\s*=\\s*["']whyknot-verify["'][^>]*content\\s*=\\s*["']${t}["'][^>]*>`,
    'i'
  )
  const contentFirst = new RegExp(
    `<meta\\s+[^>]*content\\s*=\\s*["']${t}["'][^>]*name\\s*=\\s*["']whyknot-verify["'][^>]*>`,
    'i'
  )
  return nameFirst.test(html) || contentFirst.test(html)
}

/** True for IPv4 addresses in private / loopback / link-local / reserved ranges. */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = nums as [number, number, number, number]
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a >= 224) return true // multicast + reserved
  return false
}

/** True for IPv6 loopback / private / link-local / unique-local / unspecified. */
export function isPrivateIpv6(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (v === '::1' || v === '::') return true
  if (v.startsWith('fe80:') || v.startsWith('fec0:') || v.startsWith('ff')) return true
  if (v.startsWith('fc') || v.startsWith('fd')) return true
  if (v === '::ffff:127.0.0.1') return true
  const embedded = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (embedded?.[1] && isPrivateIpv4(embedded[1])) return true
  return false
}

/** True for any private IP literal (v4 or v6). */
export function isPrivateIp(ip: string): boolean {
  return isPrivateIpv4(ip.trim()) || isPrivateIpv6(ip.trim())
}

/**
 * SSRF guard on a hostname: blocks localhost variants and IP literals that
 * resolve to private ranges. Returns true when the target must NOT be fetched.
 */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, '').replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '::') return true
  // Bare IP literal in the hostname position
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host)
  if (host.includes(':')) return isPrivateIpv6(host)
  return false
}

/**
 * Resolve a hostname and reject it when ANY address is private.
 * Throws an Error('blocked_target') when the target must not be fetched.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error('blocked_target')
  }
  try {
    const records = await lookup(hostname, { all: true })
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new Error('blocked_target')
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'blocked_target') throw err
    // DNS lookup failure here is not fatal: the subsequent fetch / resolveTxt
    // will surface it as a normal check failure. Only the explicit block throws.
  }
}

function originForTarget(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return new URL(trimmed).origin
  }
  return `https://${normalizeDomain(trimmed)}`
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** DNS TXT method: look for an exact `whyknot-verify=TOKEN` TXT record. */
export async function checkDnsTxt(domain: string, token: string): Promise<CheckResult> {
  const host = normalizeDomain(domain)
  if (!host || !DOMAIN_RE.test(host)) {
    return { ok: false, detail: 'invalid_domain' }
  }
  if (isBlockedHostname(host)) {
    return { ok: false, detail: 'blocked_target' }
  }
  const expected = buildExpectedValue(token)
  try {
    const records = await withTimeout(resolveTxt(host), FETCH_TIMEOUT_MS, 'dns')
    const flat = records.map((parts) => parts.join('').trim())
    const found = flat.some((value) => value === expected)
    return found ? { ok: true, detail: 'dns_txt_match' } : { ok: false, detail: 'dns_txt_not_found' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'dns_error'
    if (message === 'dns_timeout') return { ok: false, detail: 'dns_timeout' }
    return { ok: false, detail: `dns_lookup_failed` }
  }
}

/** File method: fetch /whyknot-verify-TOKEN.html, no redirects, body must contain token. */
export async function checkFile(domainOrUrl: string, token: string): Promise<CheckResult> {
  let origin: string
  try {
    origin = originForTarget(domainOrUrl)
  } catch {
    return { ok: false, detail: 'invalid_url' }
  }
  const hostname = new URL(origin).hostname
  try {
    await assertPublicHostname(hostname)
  } catch {
    return { ok: false, detail: 'blocked_target' }
  }
  const url = `${origin}${verificationFilePath(token)}`
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': VERIFY_USER_AGENT, Accept: 'text/html,text/plain,*/*' },
    })
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, detail: 'redirect_not_followed' }
    }
    if (!response.ok) {
      return { ok: false, detail: `file_http_${response.status}` }
    }
    const body = await response.text()
    return matchFileBody(body, token)
      ? { ok: true, detail: 'file_match' }
      : { ok: false, detail: 'file_token_not_found' }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, detail: 'file_timeout' }
    }
    return { ok: false, detail: 'file_fetch_failed' }
  }
}

/** Meta method: fetch homepage, 1MB cap, regex for the meta tag. */
export async function checkMeta(domainOrUrl: string, token: string): Promise<CheckResult> {
  let origin: string
  try {
    origin = originForTarget(domainOrUrl)
  } catch {
    return { ok: false, detail: 'invalid_url' }
  }
  const hostname = new URL(origin).hostname
  try {
    await assertPublicHostname(hostname)
  } catch {
    return { ok: false, detail: 'blocked_target' }
  }
  try {
    const response = await fetch(`${origin}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': VERIFY_USER_AGENT, Accept: 'text/html,*/*' },
    })
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, detail: 'redirect_not_followed' }
    }
    if (!response.ok) {
      return { ok: false, detail: `meta_http_${response.status}` }
    }
    const raw = await response.text()
    const html = raw.length > MAX_BODY_BYTES ? raw.slice(0, MAX_BODY_BYTES) : raw
    return matchMetaHtml(html, token)
      ? { ok: true, detail: 'meta_match' }
      : { ok: false, detail: 'meta_token_not_found' }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, detail: 'meta_timeout' }
    }
    return { ok: false, detail: 'meta_fetch_failed' }
  }
}

/** Dispatch to the checker for the claim's method. Never throws for check failures. */
export async function runCheck(
  method: ClaimMethod,
  domainOrUrl: string,
  token: string
): Promise<CheckResult> {
  switch (method) {
    case 'dns':
      return checkDnsTxt(domainOrUrl, token)
    case 'file':
      return checkFile(domainOrUrl, token)
    case 'meta':
      return checkMeta(domainOrUrl, token)
    default:
      return { ok: false, detail: 'unknown_method' }
  }
}
