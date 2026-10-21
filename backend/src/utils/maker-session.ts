import { sign, verify } from 'hono/jwt'

// A maker session is the credential that lets the person who submitted a
// listing edit it. It is scoped to exactly one submission (slug + maker
// handle) and carries its own audience claim, so an admin token can never be
// replayed as a maker token and a maker token can never reach an admin route.
export const MAKER_SESSION_AUDIENCE = 'whyknot-maker'

// 30 days: long enough to fix a listing after its launch, short enough that a
// leaked token stops being useful quickly.
export const MAKER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export type MakerSession = {
    slug: string
    makerHandle: string
}

export async function signMakerSession(session: MakerSession, secret: string): Promise<string> {
    return sign(
        {
            aud: MAKER_SESSION_AUDIENCE,
            slug: session.slug,
            makerHandle: session.makerHandle,
            exp: Math.floor(Date.now() / 1000) + MAKER_SESSION_TTL_SECONDS,
        },
        secret
    )
}

export async function verifyMakerSession(
    token: string,
    secret: string
): Promise<MakerSession | null> {
    try {
        // The audience is checked by the verifier itself: a token minted for
        // another audience (the admin cookie, for one) is rejected here.
        const payload = await verify(token, secret, { aud: MAKER_SESSION_AUDIENCE })
        const slug = typeof payload.slug === 'string' ? payload.slug : ''
        const makerHandle = typeof payload.makerHandle === 'string' ? payload.makerHandle : ''
        if (!slug || !makerHandle) return null
        return { slug, makerHandle }
    } catch {
        return null
    }
}
