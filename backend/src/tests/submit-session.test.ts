import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { decode, sign } from 'hono/jwt'
import submitRouter, {
    authorizeSubmissionPatch,
    extractBearerToken,
    makerSessionSecret
} from '../routes/submit'
import {
    MAKER_SESSION_AUDIENCE,
    MAKER_SESSION_TTL_SECONDS,
    signMakerSession,
    verifyMakerSession
} from '../utils/maker-session'

const SECRET = 'maker_session_test_secret_at_least_32_chars'
const OTHER_SECRET = 'a_different_maker_session_secret_32'

describe('maker session tokens', () => {
    it('round-trips a session', async () => {
        const token = await signMakerSession({ slug: 'acme', makerHandle: 'jay' }, SECRET)
        const session = await verifyMakerSession(token, SECRET)
        assert.deepStrictEqual(session, { slug: 'acme', makerHandle: 'jay' })
    })

    it('rejects a tampered token', async () => {
        const token = await signMakerSession({ slug: 'acme', makerHandle: 'jay' }, SECRET)
        const tampered = token.slice(0, -3) + 'abc'
        assert.strictEqual(await verifyMakerSession(tampered, SECRET), null)
    })

    it('rejects an expired token', async () => {
        const token = await sign(
            {
                aud: MAKER_SESSION_AUDIENCE,
                slug: 'acme',
                makerHandle: 'jay',
                exp: Math.floor(Date.now() / 1000) - 10
            },
            SECRET
        )
        assert.strictEqual(await verifyMakerSession(token, SECRET), null)
    })

    it('rejects a token signed with another secret', async () => {
        const token = await signMakerSession({ slug: 'acme', makerHandle: 'jay' }, OTHER_SECRET)
        assert.strictEqual(await verifyMakerSession(token, SECRET), null)
    })

    // Negative control: the admin key can sign maker sessions when no dedicated
    // key is set, so audience separation is the only thing keeping an admin
    // cookie out of the maker routes.
    it('rejects an admin token (audience separation)', async () => {
        const adminToken = await sign(
            { sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 },
            SECRET
        )
        assert.strictEqual(await verifyMakerSession(adminToken, SECRET), null)
    })

    it('rejects a token with the wrong audience', async () => {
        const token = await sign(
            {
                aud: 'someone-else',
                slug: 'acme',
                makerHandle: 'jay',
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            SECRET
        )
        assert.strictEqual(await verifyMakerSession(token, SECRET), null)
    })

    it('carries the declared expiry', async () => {
        const token = await signMakerSession({ slug: 'acme', makerHandle: 'jay' }, SECRET)
        const decoded = decode(token)
        const exp = decoded.payload.exp
        assert.ok(typeof exp === 'number')
        assert.ok(Math.abs(exp - (Math.floor(Date.now() / 1000) + MAKER_SESSION_TTL_SECONDS)) <= 2)
    })
})

describe('bearer token extraction', () => {
    it('reads a bearer token', () => {
        assert.strictEqual(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
    })

    it('is case insensitive on the scheme', () => {
        assert.strictEqual(extractBearerToken('bearer abc'), 'abc')
    })

    it('returns null for a missing or non-bearer header', () => {
        assert.strictEqual(extractBearerToken(undefined), null)
        assert.strictEqual(extractBearerToken(''), null)
        assert.strictEqual(extractBearerToken('Basic abc'), null)
        assert.strictEqual(extractBearerToken('Bearer'), null)
    })
})

describe('owner-scoped patch authorization', () => {
    const doc = { slug: 'acme', makerHandle: 'jay' }
    const session = { slug: 'acme', makerHandle: 'jay' }

    it('rejects a missing token with 401', () => {
        const result = authorizeSubmissionPatch({ token: null, session: null, doc })
        assert.strictEqual(result.ok, false)
        assert.strictEqual(result.ok === false && result.status, 401)
    })

    it('rejects a session without a verified payload with 401', () => {
        const result = authorizeSubmissionPatch({ token: 'Bearer x', session: null, doc })
        assert.strictEqual(result.ok === false && result.status, 401)
    })

    it('rejects a session for another listing with 403', () => {
        const result = authorizeSubmissionPatch({
            token: 'Bearer x',
            session: { slug: 'someone-else', makerHandle: 'jay' },
            doc
        })
        assert.strictEqual(result.ok === false && result.status, 403)
    })

    it('rejects a session with another maker handle with 403', () => {
        const result = authorizeSubmissionPatch({
            token: 'Bearer x',
            session: { slug: 'acme', makerHandle: 'someone-else' },
            doc
        })
        assert.strictEqual(result.ok === false && result.status, 403)
    })

    it('allows the maker who submitted the listing', () => {
        const result = authorizeSubmissionPatch({ token: 'Bearer x', session, doc })
        assert.strictEqual(result.ok, true)
    })
})

describe('the maker session secret', () => {
    it('prefers a dedicated secret', () => {
        assert.strictEqual(
            makerSessionSecret({ MAKER_SESSION_SECRET: 'dedicated', ADMIN_JWT_SECRET: 'admin' }),
            'dedicated'
        )
    })

    it('falls back to the admin secret so existing deploys keep working', () => {
        assert.strictEqual(makerSessionSecret({ ADMIN_JWT_SECRET: 'admin' }), 'admin')
    })
})

describe('PATCH /api/submissions/:slug requires the owning maker', () => {
    const saved = {
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB: process.env.MONGODB_DB,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
        MAKER_SESSION_SECRET: process.env.MAKER_SESSION_SECRET
    }

    async function withEnv(fn: () => Response | Promise<Response>): Promise<Response> {
        process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017'
        process.env.MONGODB_DB = 'whyknot_test'
        process.env.ADMIN_JWT_SECRET = SECRET
        process.env.ADMIN_PASSWORD_HASH = `$2b$12$${'a'.repeat(53)}`
        delete process.env.MAKER_SESSION_SECRET
        try {
            return await fn()
        } finally {
            for (const [key, value] of Object.entries(saved)) {
                if (value === undefined) delete process.env[key]
                else process.env[key] = value
            }
        }
    }

    it('401s a patch with no maker session (negative control)', async () => {
        const res = await withEnv(() =>
            submitRouter.request('/submissions/acme', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagline: 'new tagline' })
            })
        )
        assert.strictEqual(res.status, 401)
        assert.deepStrictEqual(await res.json(), { error: 'unauthorized' })
    })

    it('401s a patch with a garbage bearer token (negative control)', async () => {
        const res = await withEnv(() =>
            submitRouter.request('/submissions/acme', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
                body: JSON.stringify({ tagline: 'new tagline' })
            })
        )
        assert.strictEqual(res.status, 401)
    })

    it('checks the maker session before any DB read (source guard)', () => {
        const src = readFileSync(new URL('../routes/submit.ts', import.meta.url), 'utf8')
        const start = src.indexOf("router.patch('/submissions/:slug'")
        assert.ok(start > -1, 'the PATCH route must exist')
        const body = src.slice(start)
        const authAt = body.indexOf('extractBearerToken(')
        const denyAt = body.indexOf("error: 'unauthorized'")
        const dbAt = body.indexOf('connectMongo(')
        assert.ok(authAt > -1 && denyAt > -1 && dbAt > -1, 'auth, the 401 and DB calls must all be present')
        assert.ok(authAt < denyAt, 'the maker session must be read before the 401 is returned')
        assert.ok(denyAt < dbAt, 'the 401 must be returned before connectMongo()')
    })

    it('keeps the ownership check before the update (source guard)', () => {
        const src = readFileSync(new URL('../routes/submit.ts', import.meta.url), 'utf8')
        const start = src.indexOf("router.patch('/submissions/:slug'")
        const body = src.slice(start)
        const authzAt = body.indexOf('authorizeSubmissionPatch(')
        const updateAt = body.indexOf('updateOne(')
        assert.ok(authzAt > -1 && updateAt > -1, 'both the ownership check and the update must exist')
        assert.ok(authzAt < updateAt, 'the ownership check must precede the update')
    })

    it('no longer carries the open free-edit TODO (source guard)', () => {
        const src = readFileSync(new URL('../routes/submit.ts', import.meta.url), 'utf8')
        assert.ok(
            !src.includes('require a maker-auth session here'),
            'the free-edit TODO must be gone now that the session exists'
        )
    })
})
