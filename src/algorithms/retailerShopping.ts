import { retailerReferences } from '../data/kitchen/retailerResearch.ts'
import type { PriceObservation, RetailerReference } from '../data/kitchen/retailerResearch.ts'
import { normalizedPack } from '../data/kitchen/priceSnapshot.ts'
import { locateBasket } from './shoppingLocation.ts'
import { realRetailerIds } from '../types/kitchen.ts'
import type { RealRetailerId, ShoppingBranch, ShoppingLine, ShoppingProposal, StockIngredient } from '../types/kitchen.ts'
import { dayDifference, isCalendarDate } from './calendar.ts'
import { linePrice } from './shopping.ts'
import type { ShoppingNeeds } from './shopping.ts'

export { normalizedPack } from '../data/kitchen/priceSnapshot.ts'

export const priceMaxAge = 30
export const isRealRetailer = (value: unknown): value is RealRetailerId => realRetailerIds.some((id) => id === value)

export function priceIssue(observation: PriceObservation, today: string) {
  if (observation.availability === 'unavailable') return 'Trang nguồn ghi hết hàng'
  if (observation.archived) return 'Nguồn lưu trữ đã cũ'
  if (!isCalendarDate(observation.observedOn)) return 'Thiếu ngày ghi nhận'
  const age = dayDifference(observation.observedOn, today)
  if (age < 0 || age > priceMaxAge) return 'Ngoài thời hạn dùng giá'
  if (!normalizedPack(observation) || !Number.isSafeInteger(observation.priceVnd) || observation.priceVnd <= 0) {
    return 'Thiếu giá hoặc quy cách hợp lệ'
  }
  return null
}

export interface ManualOffer {
  ingredientId: StockIngredient
  retailerId: RealRetailerId
  quantity: number
}

interface Quote {
  proposal: ShoppingProposal
  total: number
  retailerIds: RealRetailerId[]
}

function packSignature(line: ShoppingLine) {
  return JSON.stringify([line.ingredientId, line.priceSource?.kind === 'observed' ? line.priceSource.productKey : null,
    line.packQuantity, line.packs])
}

function basketSignature(quote: Quote) {
  return JSON.stringify(quote.proposal.lines.map(packSignature).sort())
}

export function shortlistRetailerPlans(quotes: readonly Quote[],
  area?: Pick<ShoppingBranch, 'latitude' | 'longitude'>, branches?: readonly ShoppingBranch[]) {
  const candidates = quotes.map((quote) => ({ ...quote, ...(area ? locateBasket(quote.retailerIds, area, branches) :
    { branches: [] as ShoppingBranch[], km: undefined }) }))
  type Candidate = typeof candidates[number]
  const byPrice = (a: Candidate, b: Candidate) => a.total - b.total || a.retailerIds.length - b.retailerIds.length
  const groups = new Map<string, Candidate[]>()
  for (const quote of candidates) {
    const key = basketSignature(quote)
    const group = groups.get(key) ?? []
    group.push(quote)
    groups.set(key, group)
  }
  const ordered = [...groups.values()].filter((group) => group.length > 1)
    .map((group) => group.sort(byPrice))
    .sort((a, b) => b.length - a.length || byPrice(a[0], b[0]))[0] ?? []
  const recommended = ordered.length > 0 && ordered[0].total < ordered[1].total ? ordered[0] : undefined

  const located = ordered.filter((quote): quote is Candidate & { km: number } => quote.km !== undefined)
  const byConvenience = (a: typeof located[number], b: typeof located[number]) =>
    a.retailerIds.length - b.retailerIds.length || Math.round(a.km * 10) - Math.round(b.km * 10)
  located.sort((a, b) => byConvenience(a, b) || byPrice(a, b))
  // Rank proximity only when every distinct basket in this comparison can be located.
  const convenient = located.length === ordered.length && located.length > 1 &&
    byConvenience(located[0], located[1]) < 0 && located[0] !== recommended ? located[0] : undefined
  const cheapestLocated = located.find((quote) => quote === recommended)
  const maxDistance = located.reduce((max, quote) => Math.max(max, Math.round(quote.km * 10)), 0)
  const inconvenience = (quote: typeof located[number]) =>
    quote.retailerIds.length + Math.round(quote.km * 10) / (maxDistance + 1)
  const balanced = cheapestLocated && convenient ?
    located.filter((quote) => quote.total > cheapestLocated.total && quote.total < convenient.total &&
      byConvenience(quote, cheapestLocated) < 0 && byConvenience(quote, convenient) > 0 &&
      !located.some((other) => other.total <= quote.total && byConvenience(other, quote) <= 0 &&
        (other.total < quote.total || byConvenience(other, quote) < 0)))
      .sort((a, b) => {
        const score = (quote: typeof located[number]) =>
          (quote.total - cheapestLocated.total) / (convenient.total - cheapestLocated.total) +
          (inconvenience(quote) - inconvenience(convenient)) / (inconvenience(cheapestLocated) - inconvenience(convenient))
        return score(a) - score(b) || byPrice(a, b)
      })[0] : undefined

  const ranked = [...new Set([recommended, convenient, balanced, ordered[0]])]
    .filter((quote): quote is Candidate => quote !== undefined)
  const distinctStores = new Map<string, Candidate>()
  if (!ranked.length) {
    for (const quote of [...candidates].sort(byPrice)) {
      const stores = [...quote.retailerIds].sort().join(',')
      if (!distinctStores.has(stores)) distinctStores.set(stores, quote)
      if (distinctStores.size === 3) break
    }
  }
  const options = ranked.length ? ranked : [...distinctStores.values()]
  return { options, recommended, convenient, balanced, comparable: ordered.length > 1,
    comparableLocations: located.length > 1 && located.length === ordered.length }
}

export function retailerPlans(needs: ShoppingNeeds, today: string, manual: readonly ManualOffer[] = [],
  catalog: readonly RetailerReference[] = retailerReferences) {
  const shortages = needs.requirements.filter(({ shortage }) => shortage > 0)
  const quotes: Quote[] = []
  if (!needs.deadline || needs.deadline < today || !shortages.length) return { quotes, provisional: null }

  const date = needs.deadline

  const observed = shortages.map(({ ingredientId, shortage }) => catalog.flatMap((store) =>
    store.observations.flatMap((observation): ShoppingLine[] => {
      if (observation.ingredientId !== ingredientId || priceIssue(observation, today)) return []
      const packQuantity = normalizedPack(observation)!
      const packs = Math.ceil(shortage / packQuantity)
      if (!Number.isSafeInteger(packs * packQuantity) || !Number.isSafeInteger(packs * observation.priceVnd)) return []
      return [{ ingredientId, shortage, retailerId: store.id, shoppingDate: date, packs, packQuantity,
        packPrice: observation.priceVnd, tripFee: 0, priceSource: {
          kind: 'observed', product: observation.product, productKey: observation.productKey, packDescription: observation.pack,
          url: observation.url, priceUrl: observation.priceUrl, observedOn: observation.observedOn, verification: observation.verification,
          ...(observation.reviewedAt ? { reviewedAt: observation.reviewedAt } : {}),
        } }]
    })).sort((a, b) => linePrice(a) - linePrice(b) || a.packs * a.packQuantity - b.packs * b.packQuantity))

  function proposalFor(ids: readonly RealRetailerId[], signature?: readonly string[]): ShoppingProposal {
    const lines: ShoppingLine[] = []
    const uncovered: StockIngredient[] = []
    observed.forEach((offers, index) => {
      const best = offers.find((line) => ids.includes(line.retailerId as RealRetailerId) &&
        (!signature || signature[index] === packSignature(line)))
      if (best) lines.push(best)
      else uncovered.push(shortages[index].ingredientId)
    })
    return { lines, uncovered }
  }

  const subsets = Array.from({ length: (1 << catalog.length) - 1 }, (_, index) =>
    catalog.filter((_, bit) => (index + 1) & (1 << bit)).map(({ id }) => id))
  const unique = new Set<string>()
  function addQuote(proposal: ShoppingProposal) {
    if (proposal.uncovered.length || needs.missingMeals) return
    const key = JSON.stringify(proposal)
    if (unique.has(key)) return
    const total = proposal.lines.reduce((sum, line) => sum + linePrice(line), 0)
    if (!Number.isSafeInteger(total)) return
    unique.add(key)
    quotes.push({ proposal, total, retailerIds: [...new Set(proposal.lines.map(({ retailerId }) => retailerId as RealRetailerId))] })
  }

  for (const ids of subsets) addQuote(proposalFor(ids))
  // Reprice like-for-like packs even when a store's default pack choice differs.
  const signatures = new Map(quotes.map(({ proposal }) => {
    const signature = proposal.lines.map(packSignature)
    return [JSON.stringify(signature), signature]
  }))
  for (const signature of signatures.values()) {
    for (const ids of subsets) addQuote(proposalFor(ids, signature))
  }

  const baseline = proposalFor(catalog.map(({ id }) => id))
  const provisional: ShoppingProposal = { lines: [], uncovered: [] }
  for (const { ingredientId, shortage } of shortages) {
    const entry = manual.find((item) => item.ingredientId === ingredientId)
    const existing = baseline.lines.find((line) => line.ingredientId === ingredientId)
    if (!entry) {
      if (existing) provisional.lines.push(existing)
      else provisional.uncovered.push(ingredientId)
      continue
    }
    if (!isRealRetailer(entry.retailerId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < shortage) {
      provisional.uncovered.push(ingredientId)
      continue
    }
    provisional.lines.push({ ingredientId, shortage, retailerId: entry.retailerId, shoppingDate: date,
      packs: 1, packQuantity: entry.quantity, packPrice: 0, tripFee: 0, priceSource: { kind: 'unpriced' } })
  }
  return { quotes, provisional: provisional.lines.length ? provisional : null }
}

