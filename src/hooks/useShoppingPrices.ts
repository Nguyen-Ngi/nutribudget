import { useEffect, useState } from 'react'
import { lookupRetailerPrices } from '../data/kitchen/priceLookup'
import { retailerReferences } from '../data/kitchen/retailerResearch'
import type { StockIngredient } from '../types/kitchen'

const endpoint = import.meta.env.VITE_RETAILER_PRICE_ENDPOINT?.trim()

export function useShoppingPrices(ids: readonly StockIngredient[], enabled: boolean) {
  const key = enabled ? ids.join(',') : ''
  const [result, setResult] = useState<{
    key: string
    catalog: typeof retailerReferences
    state: 'ready' | 'failed'
    found: number
  }>()

  useEffect(() => {
    if (!endpoint || !key) {
      setResult(undefined)
      return
    }
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(8000)
    void lookupRetailerPrices(endpoint, key.split(',') as StockIngredient[], AbortSignal.any([controller.signal, timeout]))
      .then(({ catalog, found }) => {
        if (!controller.signal.aborted) setResult({ key, catalog, found, state: 'ready' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, catalog: retailerReferences, found: 0, state: 'failed' })
      })
    return () => controller.abort()
  }, [key])

  if (!endpoint || !key) return { catalog: retailerReferences, state: 'offline', found: 0 } as const
  return result?.key === key ? result : { catalog: retailerReferences, state: 'loading', found: 0 } as const
}
