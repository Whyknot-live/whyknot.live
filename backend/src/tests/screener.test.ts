import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateScanId } from '../utils/screener'

describe('screener utilities', () => {
    it('generates unique scan IDs with prefix scan_', () => {
        const id1 = generateScanId()
        const id2 = generateScanId()
        assert.ok(id1.startsWith('scan_'))
        assert.ok(id2.startsWith('scan_'))
        assert.notStrictEqual(id1, id2)
        assert.strictEqual(id1.length, 17)
    })
})
