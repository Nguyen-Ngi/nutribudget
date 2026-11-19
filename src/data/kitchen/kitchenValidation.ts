import { isPositiveInteger } from '../../algorithms/budget.ts'
import { isCalendarDate } from '../../algorithms/calendar.ts'
import { maxServings, validDishSelection } from '../../algorithms/dishSelection.ts'
import { linePrice, mealKey, tripKey } from '../../algorithms/shopping.ts'
import { isRealRetailer } from '../../algorithms/retailerShopping.ts'
import { mealSlots } from '../../types/meals.ts'
import type { BudgetData } from '../../types/budget.ts'
import type { KitchenData, ShoppingLine, ShoppingPreferences, Stock, StockIngredient } from '../../types/kitchen.ts'
import { isReviewTimestamp } from './priceSnapshot.ts'
import { legacyRetailerNames, stockIngredientIds } from './retailers.ts'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
}
function date(value: unknown): value is string {
  return typeof value === 'string' && isCalendarDate(value)
}
function ingredient(value: unknown): value is StockIngredient {
  return stockIngredientIds.some((id) => id === value)
}
function nonnegative(value: unknown): value is number {
  return value === 0 || isPositiveInteger(value)
}

export function isShoppingPreferences(value: unknown): value is ShoppingPreferences {
  return object(value) && (value.mode === 'save' || value.mode === 'convenient') &&
    typeof value.includeFees === 'boolean' && Array.isArray(value.days) &&
    value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(value.days).size === value.days.length
}

function line(value: unknown): value is ShoppingLine {
  if (!object(value) || !ingredient(value.ingredientId) || !date(value.shoppingDate) ||
      !isPositiveInteger(value.packs) || !isPositiveInteger(value.packQuantity) ||
      !isPositiveInteger(value.shortage) || !nonnegative(value.tripFee) || !nonnegative(value.packPrice) ||
      !Number.isSafeInteger(value.packs * value.packQuantity) || value.packs * value.packQuantity < value.shortage ||
      !Number.isSafeInteger(value.packs * value.packPrice + value.tripFee)) return false
  if (!isRealRetailer(value.retailerId)) {
    return typeof value.retailerId === 'string' && Object.hasOwn(legacyRetailerNames, value.retailerId) && value.priceSource === undefined && value.packPrice > 0
  }
  const source = value.priceSource
  if (!object(source) || (source.product !== undefined && !text(source.product))) return false
  if (source.kind === 'unpriced') return value.packPrice === 0 && value.packs === 1
  if (source.kind === 'manual') return value.packPrice > 0
  return source.kind === 'observed' && value.packPrice > 0 && text(source.product) && text(source.productKey) &&
    (source.packDescription === undefined || text(source.packDescription)) &&
    text(source.url) && source.url.startsWith('https://') &&
    (source.priceUrl === undefined || (text(source.priceUrl) && source.priceUrl.startsWith('https://'))) &&
    (source.verification === 'product' || source.verification === 'catalog') && date(source.observedOn) &&
    (source.reviewedAt === undefined || isReviewTimestamp(source.reviewedAt))
}

function branch(value: unknown) {
  return object(value) && text(value.id) && isRealRetailer(value.retailerId) && text(value.name) &&
    text(value.address) && text(value.source) && value.source.startsWith('https://') && date(value.reviewedOn) &&
    (value.coordinateSource === undefined || (text(value.coordinateSource) && value.coordinateSource.startsWith('https://'))) &&
    typeof value.latitude === 'number' && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === 'number' && Math.abs(value.longitude) <= 180
}

export function isKitchen(value: unknown, budget: BudgetData): value is KitchenData {
  if (!object(value) || value.version !== 1 || !isShoppingPreferences(value.preferences) || !Array.isArray(value.events)) return false
  const periods = new Set(budget.periods.map(({ id }) => id))
  if (value.approved !== null) {
    const plan = value.approved
    if (!object(plan) || !text(plan.id) || !text(plan.periodId) || !periods.has(plan.periodId) ||
        !Array.isArray(plan.lines) || !plan.lines.every(line) ||
        new Set(plan.lines.map(({ ingredientId }) => ingredientId)).size !== plan.lines.length ||
        !Array.isArray(plan.uncovered) || !plan.uncovered.every(ingredient) ||
        (plan.mealSignature !== undefined && !text(plan.mealSignature)) ||
        (plan.branches !== undefined && (!Array.isArray(plan.branches) || !plan.branches.every(branch) ||
          new Set(plan.branches.map(({ retailerId }) => retailerId)).size !== plan.branches.length))) return false
    const stores = new Set(plan.lines.map(({ retailerId }) => retailerId))
    if (Array.isArray(plan.branches) && !plan.branches.every(({ retailerId }) => stores.has(retailerId))) return false
  }
  const expenses = new Map(budget.transactions.flatMap((expense) =>
    expense.source.type === 'shopping-purchase' ? [[expense.source.reference, expense] as const] : []))
  const ids = new Set<string>()
  const feeTrips = new Set<string>()
  const purchases = new Set<string>()
  const stock: Stock = {}
  function apply(id: StockIngredient, quantity: number) {
    const total = (stock[id] ?? 0) + quantity
    if (!nonnegative(total)) return false
    stock[id] = total
    return true
  }

  for (const event of value.events) {
    if (!object(event) || !text(event.id) || !date(event.date) || ids.has(event.id)) return false
    ids.add(event.id)
    if (event.kind === 'addition' || event.kind === 'correction') {
      if (!ingredient(event.ingredientId) || !text(event.reason) || typeof event.quantity !== 'number' ||
          !Number.isSafeInteger(event.quantity) || event.quantity === 0 || (event.kind === 'addition' && event.quantity < 0) ||
          !apply(event.ingredientId, event.quantity)) return false
      continue
    }
    if (!text(event.periodId) || !periods.has(event.periodId)) return false
    if (event.kind === 'purchase') {
      if (!line(event.line) || event.line.packPrice <= 0 || !nonnegative(event.fee) || (event.fee !== 0 && event.fee !== event.line.tripFee)) return false
      const expense = expenses.get(event.id)
      const trip = tripKey(event.line, event.periodId)
      if (!expense || expense.id !== 'shopping:' + event.id || expense.amount !== linePrice(event.line) + event.fee || expense.date !== event.date ||
          expense.budgetPeriodId !== event.periodId || expense.priceStatus !== 'estimated' ||
          (event.fee > 0 && feeTrips.has(trip)) ||
          !apply(event.line.ingredientId, event.line.packs * event.line.packQuantity)) return false
      purchases.add(event.id)
      if (event.fee > 0) feeTrips.add(trip)
    } else if (event.kind === 'cooking') {
      const meal = event.meal
      if (!object(meal) || !date(meal.date) || typeof meal.slot !== 'string' || !mealSlots.some((slot) => slot === meal.slot) ||
          event.id !== mealKey(event.periodId, { date: meal.date, slot: meal.slot as typeof mealSlots[number] }) ||
          meal.active !== true || !isPositiveInteger(meal.servings) || meal.servings > maxServings ||
          !Array.isArray(meal.recipeIds) || !meal.recipeIds.length || !validDishSelection(meal.recipeIds, meal.dishPortions) ||
          !Array.isArray(event.ingredients) || !event.ingredients.length) return false
      const consumed = new Set<StockIngredient>()
      for (const item of event.ingredients) {
        if (!object(item) || !ingredient(item.ingredientId) || !isPositiveInteger(item.quantity) ||
            consumed.has(item.ingredientId) || !apply(item.ingredientId, -item.quantity)) return false
        consumed.add(item.ingredientId)
      }
    } else return false
  }
  return [...expenses].every(([reference, expense]) =>
    expense.id !== 'shopping:' + reference || purchases.has(reference))
}
