import type { PriceObservation, RetailerReference } from '../data/kitchen/retailerResearch.ts'
import { normalizedPack } from './retailerShopping.ts'
import type { ShoppingNeeds } from './shopping.ts'

type Needs = Pick<ShoppingNeeds, 'requirements' | 'missingMeals'>

export function retailerCoverage(retailer: RetailerReference, needs: Needs) {
  const lines: { observation: PriceObservation; packs: number; cost: number }[] = []
  const missing: ShoppingNeeds['requirements'] = []
  for (const item of needs.requirements) {
    if (item.shortage <= 0) continue
    // Retain catalog order for equally priced listings.
    const offers = retailer.observations.flatMap((observation) => {
      const packQuantity = normalizedPack(observation)
      if (observation.ingredientId !== item.ingredientId || !packQuantity || !Number.isSafeInteger(observation.priceVnd) ||
          observation.priceVnd <= 0) return []
      const packs = Math.ceil(item.shortage / packQuantity)
      const cost = packs * observation.priceVnd
      return Number.isSafeInteger(cost) ? [{ observation, packs, cost }] : []
    })
    const best = offers.reduce<(typeof offers)[number] | undefined>((best, offer) => !best || offer.cost < best.cost ? offer : best, undefined)
    if (best) lines.push(best)
    else missing.push(item)
  }
  const sum = lines.reduce((total, line) => total + line.cost, 0)
  const total = !needs.missingMeals && !missing.length && lines.length && Number.isSafeInteger(sum) ? sum : null
  return { lines, missing, total }
}

type Coverage = ReturnType<typeof retailerCoverage>

export function comparableRetailerBaskets(left: Coverage, right: Coverage) {
  if (left.total === null || right.total === null || left.lines.length !== right.lines.length) return false
  return left.lines.every(({ observation, packs }) => right.lines.some((line) =>
    line.observation.ingredientId === observation.ingredientId &&
    line.observation.productKey === observation.productKey &&
    line.observation.packQuantity === observation.packQuantity && line.packs === packs))
}
