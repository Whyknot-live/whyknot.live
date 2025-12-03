import type { Context } from 'hono'

function shouldTrustForwardedHeaders(): boolean {
 return process.env.TRUST_PROXY_FORWARDED === '1'
}

function extractForwardedIp(forwarded?: string | null): string | null {
 if (!forwarded) {
  return null
 }
 const parts = forwarded.split(',')
 if (!parts.length) {
  return null
 }
 const candidate = parts[0]?.trim()
 if (!candidate) {
  return null
 }
 return candidate
}

function extractBunRemoteAddress(request: Request): string | null {
 const raw = request as unknown as {
  remoteAddr?: { hostname?: string }
  clientAddress?: { hostname?: string }
 }
 const addr = raw.remoteAddr?.hostname ?? raw.clientAddress?.hostname
 if (!addr) {
  return null
 }
 return addr
}

export function getClientAddress(c: Context): string {
 const forwardedAllowed = shouldTrustForwardedHeaders()
 const forwardedCandidates: Array<string | null> = []
 if (forwardedAllowed) {
  forwardedCandidates.push(extractForwardedIp(c.req.header('cf-connecting-ip')))
  forwardedCandidates.push(extractForwardedIp(c.req.header('x-forwarded-for')))
    forwardedCandidates.push(c.req.header('x-real-ip') ?? null)
 }
 const forwarded = forwardedCandidates.find(ip => ip && ip !== 'unknown')
 if (forwarded) {
  return forwarded
 }
 const remote = extractBunRemoteAddress(c.req.raw)
 if (remote) {
  return remote
 }
 // Last resort: bind all callers together. This prevents spoofed header bypasses at the cost of tighter limits.
 return 'shared'
}

