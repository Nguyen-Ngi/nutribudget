import { retailerReferences } from './retailerResearch.ts'
import type { LegacyRetailerId, RetailerId, StockIngredient } from '../../types/kitchen.ts'
import { ingredients } from '../meals/ingredients.ts'
import { illustrativePrices } from '../meals/prices.ts'

interface Offer {
  quantity: number
  price: number
  minimumPacks: number
  availablePacks?: number
}

export interface Retailer {
  id: LegacyRetailerId
  name: string
  fee: number
  days: readonly number[]
  offers: Partial<Record<StockIngredient, Offer>>
}

export const stockIngredientIds = (Object.keys(ingredients) as (keyof typeof ingredients)[])
  .filter((id): id is StockIngredient => id !== 'water')

const produce: readonly StockIngredient[] = [
  'water-spinach', 'cabbage', 'carrot', 'cucumber', 'tomato', 'pumpkin', 'oyster-mushroom',
  'bean-sprouts', 'spring-onion', 'garlic', 'lemongrass', 'lime', 'tofu', 'egg',
]
const staples: readonly StockIngredient[] = [
  'white-rice', 'brown-rice', 'sticky-rice', 'rice-noodles', 'mung-beans', 'peanuts',
  'oil', 'fish-sauce', 'soy-sauce', 'sugar', 'salt',
]

function offers(ids: readonly StockIngredient[], multiplier: number) {
  return Object.fromEntries(ids.flatMap((id) => {
    const price = illustrativePrices[id]
    return price ? [[id, {
      quantity: price.packQuantity,
      price: Math.round(price.packPriceVnd * multiplier / 100) * 100,
      minimumPacks: 1,
    }]] : []
  })) as Retailer['offers']
}

export const legacyRetailerNames: Record<LegacyRetailerId, string> = {
  neighborhood: 'Siêu thị tổng hợp',
  produce: 'Quầy rau củ',
  staples: 'Cửa hàng đồ khô',
}

// Retired catalog, retained for historical workflow regression tests.
export const retailers: readonly Retailer[] = /* @__PURE__ */ (() => [
  { id: 'neighborhood', name: legacyRetailerNames.neighborhood, fee: 12000, days: [0, 1, 2, 3, 4, 5, 6],
    offers: offers(stockIngredientIds, 1) },
  { id: 'produce', name: legacyRetailerNames.produce, fee: 5000, days: [1, 2, 3, 4, 5, 6],
    offers: { ...offers(produce, .73), 'water-spinach': { quantity: 125, price: 5200, minimumPacks: 2 } } },
  { id: 'staples', name: legacyRetailerNames.staples, fee: 7500, days: [0, 1, 2, 3, 4, 5],
    offers: { ...offers(staples, .72), 'white-rice': { quantity: 500, price: 10500, minimumPacks: 1 } } },
])()

export function retailerName(id: RetailerId) {
  return retailerReferences.find((store) => store.id === id)?.name ??
    legacyRetailerNames[id as LegacyRetailerId] ?? 'Cửa hàng không xác định'
}
