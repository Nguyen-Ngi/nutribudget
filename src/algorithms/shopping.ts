import { endDate } from './calendar.ts'
import { resolveDishes } from './mealRecipes.ts'
import { plannedRequirements } from './mealSchedule.ts'
import { retailers } from '../data/kitchen/retailers.ts'
import type { Retailer } from '../data/kitchen/retailers.ts'
import type { BudgetPeriod } from '../types/budget.ts'
import type { PlannedSlot, SlotKey } from '../types/meals.ts'
import type { KitchenData, ShoppingLine, ShoppingPreferences, ShoppingProposal, Stock, StockIngredient } from '../types/kitchen.ts'

export const defaultShopping: ShoppingPreferences = { mode: 'save', days: [], includeFees: true }
export const emptyKitchen: KitchenData = { version: 1, preferences: defaultShopping, approved: null, events: [] }

export function mealKey(periodId: string, meal: SlotKey) {
  return JSON.stringify([periodId, meal.date, meal.slot])
}

export function cookedKeys(kitchen: KitchenData) {
  return new Set(kitchen.events.flatMap((event) => event.kind === 'cooking' ? [event.id] : []))
}

export function pantryStock(kitchen: KitchenData): Stock {
  const stock: Stock = {}
  function change(id: StockIngredient, delta: number) {
    stock[id] = (stock[id] ?? 0) + delta
  }
  for (const event of kitchen.events) {
    if (event.kind === 'purchase') change(event.line.ingredientId, event.line.packs * event.line.packQuantity)
    else if (event.kind === 'cooking') {
      for (const { ingredientId, quantity } of event.ingredients) change(ingredientId, -quantity)
    } else change(event.ingredientId, event.quantity)
  }
  return stock
}

export function shoppingNeeds(period: BudgetPeriod, today: string, slots: readonly PlannedSlot[], kitchen: KitchenData) {
  const start = today > period.startDate ? today : period.startDate
  const end = endDate(period.startDate, period.duration)!
  const cooked = cookedKeys(kitchen)
  const future = slots.filter((slot) => slot.active && slot.recipeIds.length && slot.date >= start && slot.date <= end &&
    !cooked.has(mealKey(period.id, slot)))
  const pricedPlans = future.filter((slot) => {
    const dishes = resolveDishes(slot.recipeIds)
    return dishes !== null
  })
  const stock = pantryStock(kitchen)
  const requirements = plannedRequirements(pricedPlans, start, end).flatMap(({ ingredientId, quantity }) => {
    if (ingredientId === 'water') return []
    const onHand = stock[ingredientId] ?? 0
    return [{ ingredientId, required: quantity, onHand, shortage: Math.max(0, quantity - onHand) }]
  }).sort((a, b) => a.ingredientId.localeCompare(b.ingredientId, 'en'))
  const deadline = pricedPlans.reduce<string | null>((earliest, slot) => earliest === null || slot.date < earliest ? slot.date : earliest, null)
  const mealSignature = JSON.stringify(future.map(({ date, slot, servings, recipeIds, dishPortions }) =>
    JSON.stringify([date, slot, servings, recipeIds, dishPortions])).sort())
  return { requirements, deadline, mealSignature, mealCount: future.length, missingMeals: future.length - pricedPlans.length }
}

export type ShoppingNeeds = ReturnType<typeof shoppingNeeds>
export function isCurrentShoppingLine(line: ShoppingLine, needs: ShoppingNeeds, period: BudgetPeriod, today: string) {
  return needs.requirements.find((item) => item.ingredientId === line.ingredientId)?.shortage === line.shortage &&
    line.shoppingDate >= period.startDate && line.shoppingDate >= today && needs.deadline !== null && line.shoppingDate <= needs.deadline
}

export const linePrice = (line: ShoppingLine) => line.packs * line.packPrice
export const tripKey = (line: ShoppingLine, periodId: string) => JSON.stringify([periodId, line.retailerId, line.shoppingDate])
export const purchaseKey = (planId: string, ingredientId: StockIngredient) => planId + ':' + ingredientId

export function paidTrips(kitchen: KitchenData) {
  return new Set(kitchen.events.flatMap((event) =>
    event.kind === 'purchase' && event.fee > 0 ? [tripKey(event.line, event.periodId)] : []))
}

export function storeTotals(lines: readonly ShoppingLine[], paid: ReadonlySet<string>, periodId: string) {
  const trips = new Map<string, { retailerId: ShoppingLine['retailerId']; date: string; items: number; goods: number; fee: number }>()
  for (const line of lines) {
    const key = tripKey(line, periodId)
    const trip = trips.get(key) ?? { retailerId: line.retailerId, date: line.shoppingDate, items: 0, goods: 0,
      fee: paid.has(key) ? 0 : line.tripFee }
    trip.items += 1
    trip.goods += linePrice(line)
    trips.set(key, trip)
  }
  return [...trips.values()]
}

export function basketTotal(lines: readonly ShoppingLine[], paid: ReadonlySet<string>, periodId: string) {
  return storeTotals(lines, paid, periodId).reduce((sum, trip) => sum + trip.goods + trip.fee, 0)
}

function shopDate(store: Retailer, today: string, deadline: string, preferences: ShoppingPreferences) {
  let fallback: string | undefined
  // Seven days cover a full weekly schedule even for a very long budget.
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(Date.parse(deadline + 'T00:00:00Z') - offset * 86_400_000)
    const day = date.getUTCDay()
    const value = date.toISOString().slice(0, 10)
    if (date.getUTCFullYear() < 1 || value < today) break
    if (!store.days.includes(day)) continue
    fallback ??= value
    if (preferences.mode === 'save' || !preferences.days.length || preferences.days.includes(day)) return value
  }
  return fallback
}

export function compareBaskets(needs: ShoppingNeeds, periodId: string, today: string, preferences: ShoppingPreferences,
  paid: ReadonlySet<string>, catalog: readonly Retailer[] = retailers) {
  if (!needs.deadline || !needs.requirements.some(({ shortage }) => shortage > 0)) return []
  const deadline = needs.deadline
  const dates = new Map(catalog.map((store) => [store.id, shopDate(store, today, deadline, preferences)]))
  const alternatives = new Map<string, ShoppingProposal>()

  for (let mask = 1; mask < (1 << catalog.length); mask += 1) {
    const group = catalog.filter((_, index) => mask & (1 << index))
    const proposal: ShoppingProposal = { lines: [], uncovered: [] }
    for (const { ingredientId, shortage } of needs.requirements) {
      if (!shortage) continue
      const offers = group.flatMap((store): ShoppingLine[] => {
        const offer = store.offers[ingredientId]
        const shoppingDate = dates.get(store.id)
        if (!offer || !shoppingDate || !Number.isSafeInteger(offer.quantity) || offer.quantity < 1 ||
            !Number.isSafeInteger(offer.price) || offer.price < 1 ||
            !Number.isSafeInteger(offer.minimumPacks) || offer.minimumPacks < 1) return []
        const packs = Math.max(offer.minimumPacks, Math.ceil(shortage / offer.quantity))
        const fee = preferences.includeFees ? store.fee : 0
        if ((offer.availablePacks !== undefined &&
            (!Number.isSafeInteger(offer.availablePacks) || offer.availablePacks < packs)) ||
            !Number.isSafeInteger(packs * offer.quantity) || !Number.isSafeInteger(fee) || fee < 0 ||
            !Number.isSafeInteger(packs * offer.price + fee)) return []
        return [{ ingredientId, shortage, retailerId: store.id, shoppingDate, packs,
          packQuantity: offer.quantity, packPrice: offer.price, tripFee: fee }]
      }).sort((a, b) => linePrice(a) - linePrice(b) || a.retailerId.localeCompare(b.retailerId, 'en'))
      if (offers.length) proposal.lines.push(offers[0])
      else proposal.uncovered.push(ingredientId)
    }
    if (proposal.lines.length) alternatives.set(JSON.stringify(proposal), proposal)
  }

  return [...alternatives].map(([key, proposal]) => {
    const stores = storeTotals(proposal.lines, paid, periodId)
    const inconvenient = preferences.days.length ? stores.filter(({ date }) =>
      !preferences.days.includes(new Date(date + 'T00:00:00Z').getUTCDay())).length : 0
    return { key, proposal, stores, inconvenient, total: basketTotal(proposal.lines, paid, periodId) }
  }).sort((a, b) => a.proposal.uncovered.length - b.proposal.uncovered.length ||
    (preferences.mode === 'convenient' ? a.stores.length - b.stores.length || a.inconvenient - b.inconvenient : 0) ||
    a.total - b.total || a.stores.length - b.stores.length || a.key.localeCompare(b.key, 'en'))
}

export function pendingLines(kitchen: KitchenData, periodId: string) {
  const plan = kitchen.approved
  if (plan?.periodId !== periodId) return []
  const confirmed = new Set(kitchen.events.map(({ id }) => id))
  return plan.lines.filter((line) => !confirmed.has(purchaseKey(plan.id, line.ingredientId)))
}
