export interface SortableAsset {
  type: string
  sortOrder?: number | null
}

export const getNextSortOrder = (assets: Array<Pick<SortableAsset, 'sortOrder'>>) => {
  const sortOrders = assets
    .map((asset) => asset.sortOrder)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return sortOrders.length ? Math.max(...sortOrders) + 1 : 0
}

export const normalizeSortOrders = <T extends SortableAsset>(assets: T[]) => {
  return assets.map((asset, index) => ({
    ...asset,
    sortOrder: index,
  }))
}

export const buildReorderUpdates = (types: string[]) => {
  return types.map((type, index) => ({
    type,
    sortOrder: index,
  }))
}
