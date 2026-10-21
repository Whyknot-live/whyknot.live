import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
    MAKER_SESSION_KEY_PREFIX,
    makerSessionKey,
    readMakerSession,
    saveMakerSession,
    type SessionStorage,
} from './maker-session'

function fakeStorage(): SessionStorage & { map: Map<string, string> } {
    const map = new Map<string, string>()
    return {
        map,
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
            map.set(key, value)
        },
    }
}

describe('maker session key', () => {
    it('namespaces the key by slug', () => {
        assert.strictEqual(makerSessionKey('acme'), `${MAKER_SESSION_KEY_PREFIX}acme`)
    })

    it('keeps one listing apart from another', () => {
        assert.notStrictEqual(makerSessionKey('acme'), makerSessionKey('other'))
    })
})

describe('maker session storage', () => {
    it('round-trips a token', () => {
        const storage = fakeStorage()
        saveMakerSession('acme', 'token-1', storage)
        assert.strictEqual(readMakerSession('acme', storage), 'token-1')
    })

    it('returns null for a listing with no key', () => {
        const storage = fakeStorage()
        assert.strictEqual(readMakerSession('acme', storage), null)
    })

    it('keeps the key of one listing out of another', () => {
        const storage = fakeStorage()
        saveMakerSession('acme', 'token-1', storage)
        assert.strictEqual(readMakerSession('other', storage), null)
    })

    it('survives a storage that refuses to write', () => {
        const broken: SessionStorage = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota exceeded')
            },
        }
        assert.doesNotThrow(() => saveMakerSession('acme', 'token-1', broken))
        assert.strictEqual(readMakerSession('acme', broken), null)
    })

    it('survives a storage that refuses to read', () => {
        const broken: SessionStorage = {
            getItem: () => {
                throw new Error('blocked')
            },
            setItem: () => undefined,
        }
        assert.strictEqual(readMakerSession('acme', broken), null)
    })

    it('does nothing when there is no storage at all', () => {
        assert.doesNotThrow(() => saveMakerSession('acme', 'token-1', null))
        assert.strictEqual(readMakerSession('acme', null), null)
    })
})
