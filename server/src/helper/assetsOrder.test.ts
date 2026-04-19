import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReorderUpdates, getNextSortOrder, normalizeSortOrders } from './assetsOrder'

test('getNextSortOrder returns zero for empty assets', () => {
  assert.equal(getNextSortOrder([]), 0)
})

test('getNextSortOrder skips nullish values and returns max plus one', () => {
  assert.equal(getNextSortOrder([{ sortOrder: 2 }, { sortOrder: null }, { sortOrder: 7 }]), 8)
})

test('normalizeSortOrders rewrites positions into a dense sequence', () => {
  assert.deepEqual(
    normalizeSortOrders([
      { type: 'bond', sortOrder: 5 },
      { type: 'cash', sortOrder: null },
      { type: 'fund', sortOrder: 9 },
    ]),
    [
      { type: 'bond', sortOrder: 0 },
      { type: 'cash', sortOrder: 1 },
      { type: 'fund', sortOrder: 2 },
    ],
  )
})

test('buildReorderUpdates maps ordered types to sequential sort orders', () => {
  assert.deepEqual(buildReorderUpdates(['cash', 'fund', 'bond']), [
    { type: 'cash', sortOrder: 0 },
    { type: 'fund', sortOrder: 1 },
    { type: 'bond', sortOrder: 2 },
  ])
})
