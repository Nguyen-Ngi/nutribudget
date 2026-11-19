import { isCalendarDate } from '../../algorithms/calendar.ts'
import { ingredients } from '../meals/ingredients.ts'
import { realRetailerIds } from '../../types/kitchen.ts'
import type { RealRetailerId } from '../../types/kitchen.ts'
import type { PriceObservation } from './retailerResearch.ts'

interface Snapshot {
  version: 1
  observations: (PriceObservation & { retailerId: RealRetailerId })[]
}

const officialDomains: Record<RealRetailerId, string[]> = {
  'bach-hoa-xanh': ['bachhoaxanh.com'],
  'san-ha': ['sanha.vn'],
  kingfoodmart: ['kingfoodmart.com'],
  'coop-food': ['saigonco-op.com.vn', 'cooponline.vn'],
  winmart: ['winmart.vn'],
}

export function normalizedPack(observation: { ingredientId: string; unit: string; packQuantity: number }) {
  const { unit, packQuantity, ingredientId } = observation
  const normalizedUnit = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit
  const quantity = packQuantity * (unit === 'kg' || unit === 'l' ? 1000 : 1)
  return Object.hasOwn(ingredients, ingredientId) && ingredients[ingredientId as keyof typeof ingredients].unit === normalizedUnit &&
    Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
}

function officialUrl(value: unknown, retailerId: RealRetailerId) {
  if (!text(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      officialDomains[retailerId].some((domain) => url.hostname === domain || url.hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

export function isReviewTimestamp(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    isCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}

export function parsePriceSnapshot(value: unknown): Snapshot {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.observations)) {
    throw new Error('Tệp giá cần có phiên bản 1 và danh sách quan sát.')
  }
  const keys = new Set<string>()
  for (const [index, row] of value.observations.entries()) {
    const store = object(row) && realRetailerIds.find((id) => id === row.retailerId)
    const invalid = () => new Error(`Quan sát giá dòng ${index + 1} không hợp lệ.`)
    if (!store || !text(row.ingredientId) || row.ingredientId === 'water' || !text(row.productKey) ||
        !text(row.product) || !text(row.pack) || !text(row.observedOn) || !isCalendarDate(row.observedOn) ||
        (row.verification !== 'product' && row.verification !== 'catalog') ||
        (row.availability !== undefined && row.availability !== 'unavailable') ||
        (row.archived !== undefined && typeof row.archived !== 'boolean') ||
        (row.reviewedAt !== undefined && !isReviewTimestamp(row.reviewedAt)) ||
        !officialUrl(row.url, store) || (row.priceUrl !== undefined && !officialUrl(row.priceUrl, store)) ||
        typeof row.priceVnd !== 'number' || !Number.isSafeInteger(row.priceVnd) || row.priceVnd <= 0 ||
        !text(row.unit) || !['g', 'kg', 'ml', 'l', 'each'].includes(row.unit) ||
        typeof row.packQuantity !== 'number') throw invalid()
    const quantity = normalizedPack({ ingredientId: row.ingredientId, unit: row.unit, packQuantity: row.packQuantity })
    if (!quantity) throw invalid()
    const key = JSON.stringify([store, row.ingredientId, row.productKey, quantity])
    if (keys.has(key)) throw invalid()
    keys.add(key)
  }
  return value as unknown as Snapshot
}
