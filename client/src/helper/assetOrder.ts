export interface SortableAsset {
  type: string
  sortOrder?: number
}

export const sortAssetsForHomepage = <T extends SortableAsset>(assets: T[]) => {
  return assets
    .map((asset, index) => ({
      asset,
      index,
    }))
    .sort((left, right) => {
      const leftHasSortOrder = typeof left.asset.sortOrder === 'number'
      const rightHasSortOrder = typeof right.asset.sortOrder === 'number'

      if (leftHasSortOrder && rightHasSortOrder) {
        return left.asset.sortOrder - right.asset.sortOrder
      }

      if (leftHasSortOrder) {
        return -1
      }

      if (rightHasSortOrder) {
        return 1
      }

      return left.index - right.index
    })
    .map(({ asset }) => asset)
}

export const moveAssetItem = <T extends SortableAsset>(
  assets: T[],
  draggedType: string,
  targetType: string,
) => {
  if (!draggedType || !targetType || draggedType === targetType) {
    return assets
  }

  const nextAssets = [...assets]
  const draggedIndex = nextAssets.findIndex((asset) => asset.type === draggedType)
  const targetIndex = nextAssets.findIndex((asset) => asset.type === targetType)

  if (draggedIndex === -1 || targetIndex === -1) {
    return assets
  }

  const [draggedAsset] = nextAssets.splice(draggedIndex, 1)
  const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
  nextAssets.splice(insertIndex, 0, draggedAsset)

  return nextAssets.map((asset, index) => ({
    ...asset,
    sortOrder: index,
  }))
}
