import type { StockIngredient } from '../../types/kitchen.ts'
import { normalizedPack, parsePriceSnapshot } from './priceSnapshot.ts'
import { retailerReferences } from './retailerResearch.ts'

const lookupWindowMs = 15 * 60 * 1000

export async function lookupRetailerPrices(endpoint: string, ids: readonly StockIngredient[], signal: AbortSignal,
  request: typeof fetch = fetch, now = Date.now) {
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = endpoint + separator + new URLSearchParams({ ingredients: ids.join(',') })
  const response = await request(url, { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error('Chưa kết nối được nguồn giá.')
  const snapshot = parsePriceSnapshot(await response.json())
  const reviewed = now()
  const fresh = snapshot.observations.filter((row) => {
    const age = reviewed - Date.parse(row.reviewedAt ?? '')
    return ids.includes(row.ingredientId) && !row.archived && age >= 0 && age <= lookupWindowMs
  })
  const key = (row: Parameters<typeof normalizedPack>[0] & { productKey: string }) =>
    JSON.stringify([row.ingredientId, row.productKey, normalizedPack(row)])

  const catalog = retailerReferences.map((store) => {
    const updates = fresh.filter(({ retailerId }) => retailerId === store.id)
    const replaced = new Set(updates.map(key))
    return { ...store, observations: [...updates, ...store.observations.filter((row) => !replaced.has(key(row)))] }
  })
  return { catalog, found: new Set(fresh.filter(({ availability }) => !availability).map(({ ingredientId }) => ingredientId)).size }
}
