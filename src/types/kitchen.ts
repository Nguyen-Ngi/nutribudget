import type { IngredientId } from '../data/meals/ingredients.ts'
import type { PlannedSlot, Requirement } from './meals.ts'

export type StockIngredient = Exclude<IngredientId, 'water'>
export type Stock = Partial<Record<StockIngredient, number>>
export type ShoppingMode = 'save' | 'convenient'
export type LegacyRetailerId = 'neighborhood' | 'produce' | 'staples'
export const realRetailerIds = ['bach-hoa-xanh', 'san-ha', 'kingfoodmart', 'coop-food', 'winmart'] as const
export type RealRetailerId = typeof realRetailerIds[number]
export type RetailerId = LegacyRetailerId | RealRetailerId

export type PriceSource =
  | { kind: 'observed'; product: string; productKey: string; packDescription?: string; url: string; priceUrl?: string; observedOn: string; reviewedAt?: string; verification: 'product' | 'catalog' }
  | { kind: 'manual'; product?: string }  | { kind: 'unpriced'; product?: string }

export interface ShoppingPreferences {
  mode: ShoppingMode
  days: number[]
  includeFees: boolean
}

export interface ShoppingLine {
  ingredientId: StockIngredient
  shortage: number
  retailerId: RetailerId
  shoppingDate: string
  packs: number
  packQuantity: number
  packPrice: number
  tripFee: number
  priceSource?: PriceSource
}

export interface ShoppingProposal {
  lines: ShoppingLine[]
  uncovered: StockIngredient[]
}

export interface ShoppingBranch {
  id: string
  retailerId: RealRetailerId
  name: string
  address: string
  latitude: number
  longitude: number
  source: string
  coordinateSource?: string
  reviewedOn: string
}

export interface ApprovedShop extends ShoppingProposal {
  id: string
  periodId: string
  branches?: ShoppingBranch[]
  mealSignature?: string
}

export interface PurchaseEvent {
  kind: 'purchase'
  id: string
  date: string
  periodId: string
  line: ShoppingLine
  fee: number
}

export interface CookingEvent {
  kind: 'cooking'
  id: string
  date: string
  periodId: string
  meal: PlannedSlot
  ingredients: Requirement<StockIngredient>[]
}

export interface ManualStockEvent {
  id: string
  date: string
  ingredientId: StockIngredient
  quantity: number
  kind: 'addition' | 'correction'
  reason: string
}

export type KitchenEvent = PurchaseEvent | CookingEvent | ManualStockEvent

export interface KitchenData {
  version: 1
  preferences: ShoppingPreferences
  approved: ApprovedShop | null
  events: KitchenEvent[]
}
