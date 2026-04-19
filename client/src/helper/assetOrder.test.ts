import test from 'node:test'
import assert from 'node:assert/strict'
import { moveAssetItem, sortAssetsForHomepage } from './assetOrder'

test('sortAssetsForHomepage prefers explicit sortOrder and keeps missing values last', () => {
  assert.deepEqual(
    sortAssetsForHomepage([
      { type: 'cash', sortOrder: 2 },
      { type: 'fund', sortOrder: undefined },
      { type: 'bond', sortOrder: 0 },
      { type: 'gold', sortOrder: undefined },
    ]),
    [
      { type: 'bond', sortOrder: 0 },
      { type: 'cash', sortOrder: 2 },
      { type: 'fund', sortOrder: undefined },
      { type: 'gold', sortOrder: undefined },
    ],
  )
})

test('moveAssetItem reorders the dragged item before the target and rewrites sortOrder', () => {
  assert.deepEqual(
    moveAssetItem(
      [
        { type: 'cash', sortOrder: 0 },
        { type: 'fund', sortOrder: 1 },
        { type: 'bond', sortOrder: 2 },
      ],
      'bond',
      'fund',
    ),
    [
      { type: 'cash', sortOrder: 0 },
      { type: 'bond', sortOrder: 1 },
      { type: 'fund', sortOrder: 2 },
    ],
  )
})

test('moveAssetItem returns the original list when drag targets are invalid', () => {
  const assets = [
    { type: 'cash', sortOrder: 0 },
    { type: 'fund', sortOrder: 1 },
  ]

  assert.deepEqual(moveAssetItem(assets, 'cash', 'cash'), assets)
  assert.deepEqual(moveAssetItem(assets, 'cash', 'bond'), assets)
})

test('moveAssetItem inserts before the target when dragging downward', () => {
  assert.deepEqual(
    moveAssetItem(
      [
        { type: 'cash', sortOrder: 0 },
        { type: 'fund', sortOrder: 1 },
        { type: 'bond', sortOrder: 2 },
      ],
      'cash',
      'bond',
    ),
    [
      { type: 'fund', sortOrder: 0 },
      { type: 'cash', sortOrder: 1 },
      { type: 'bond', sortOrder: 2 },
    ],
  )
})
