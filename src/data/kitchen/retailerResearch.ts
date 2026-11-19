import snapshot from './retailer-snapshot.json' with { type: 'json' }
import type { RealRetailerId, StockIngredient } from '../../types/kitchen.ts'

export interface PriceObservation {
  ingredientId: StockIngredient
  productKey: string
  packQuantity: number
  unit: 'g' | 'kg' | 'ml' | 'l' | 'each'
  observedOn: string
  reviewedAt?: string
  verification: 'product' | 'catalog'
  availability?: 'unavailable'
  archived?: boolean
  priceUrl?: string
  product: string
  pack: string
  priceVnd: number
  url: string
}

export interface RetailerReference {
  id: RealRetailerId
  name: string
  url: string
  observations: readonly PriceObservation[]
}

// Date the public evidence was reviewed. Archived evidence is reference-only.
export const retailerReviewDate = snapshot.observations.map(({ observedOn }) => observedOn).sort().at(-1) ?? ''

export const retailerIdentities = [
  { id: 'bach-hoa-xanh', name: 'Bách Hóa Xanh', url: 'https://www.bachhoaxanh.com/he-thong-sieu-thi/sieu-thi-so-815-817-duong-pham-the-hien-tai-ho-chi-minh-4844' },
  { id: 'san-ha', name: 'San Hà Foodstore', url: 'https://sanha.vn/en/brand/san-ha-food-store/' },
  { id: 'kingfoodmart', name: 'Kingfoodmart', url: 'https://kingfoodmart.com/kingfoodmart/deli-policy' },
  { id: 'coop-food', name: 'Co.op Food', url: 'https://saigonco-op.com.vn/tin-tuc/tin-he-thong/co-op-food' },
  { id: 'winmart', name: 'WinMart', url: 'https://winmart.vn/info/delivery-policy' },
] satisfies Omit<RetailerReference, 'observations'>[]

export const retailerReferences: readonly RetailerReference[] = retailerIdentities.map((store) => ({
  ...store,
  observations: (snapshot.observations as (PriceObservation & { retailerId: RealRetailerId })[])
    .filter(({ retailerId }) => retailerId === store.id)
    .map(({ retailerId: _retailerId, ...observation }) => observation),
}))
