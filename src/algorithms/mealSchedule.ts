import { periodProgress } from './budget.ts'
import { dayDifference, endDate, isCalendarDate } from './calendar.ts'
import { resolveDishes } from './mealRecipes.ts'
import type { MealRequirements, RecipeCosts } from './mealRecipes.ts'
import { mealSlots } from '../types/meals.ts'
import type { MealPlanData, MealSlot, PlannedSlot, SlotKey } from '../types/meals.ts'
import type { BudgetPeriod } from '../types/budget.ts'

import { maxServings, sameDishes, selectedRequirements, selectedValue, validDishSelection } from './dishSelection.ts'
export { maxServings } from './dishSelection.ts'

export function sameSlot(a: SlotKey, b: SlotKey) {
  return a.date === b.date && a.slot === b.slot
}

export function slotDateInPeriod(period: BudgetPeriod, date: string) {
  return isCalendarDate(date) && date >= period.startDate && date <= endDate(period.startDate, period.duration)!
}

export function getSlot(slots: readonly PlannedSlot[], key: SlotKey): PlannedSlot {
  return slots.find((entry) => sameSlot(entry, key)) ?? { ...key, active: key.slot !== 'breakfast', servings: 1, recipeIds: [] }
}

export function periodSlots(data: MealPlanData, budgetPeriodId: string) {
  return data.periods.find((plan) => plan.budgetPeriodId === budgetPeriodId)?.slots ?? []
}

export function updateSlot(data: MealPlanData, period: BudgetPeriod, today: string, slot: PlannedSlot, expected: PlannedSlot): MealPlanData {
  if (periodProgress(period, today).status === 'completed' || !slotDateInPeriod(period, slot.date)) {
    throw new Error('Ngày của bữa ăn nằm ngoài kỳ có thể chỉnh sửa.')
  }
  if (!mealSlots.includes(slot.slot) || !Number.isInteger(slot.servings) || slot.servings < 1 || slot.servings > maxServings) {
    throw new Error('Chọn bữa và số khẩu phần hợp lệ.')
  }

  const old = periodSlots(data, period.id)
  const current = getSlot(old, slot)
  if (current.active !== expected.active || current.servings !== expected.servings ||
      !sameDishes(current, expected) || !sameSlot(expected, slot)) {
    throw new Error('Bữa này đã đổi ở thẻ khác. Xem lại bản đã lưu rồi thử lại.')
  }
  // Scheduling or pausing an older selection preserves its IDs even if the catalog changes.
  if (!validDishSelection(slot.recipeIds, slot.dishPortions)) throw new Error('Kiểm tra món ăn và khẩu phần.')
  const recipesUnchanged = sameDishes(current, slot)
  if (!recipesUnchanged && slot.recipeIds.length) {
    const dishes = resolveDishes(slot.recipeIds)
    if (!slot.active || !dishes) throw new Error('Chọn món còn trong danh mục cho bữa này.')
  }
  const slots = old.filter((entry) => !sameSlot(entry, slot))
  if (slot.active !== (slot.slot !== 'breakfast') || slot.servings !== 1 || slot.recipeIds.length) slots.push(slot)
  return {
    ...data,
    periods: [
      ...data.periods.filter(({ budgetPeriodId }) => budgetPeriodId !== period.id),
      { budgetPeriodId: period.id, slots },
    ],
  }
}

/** Aggregated as-planned requirements for a date range, ready for a future shopping list. */
export function plannedRequirements(
  slots: readonly PlannedSlot[],
  start: string, end: string,
  excluding?: SlotKey,
): MealRequirements {
  const totals = new Map<MealRequirements[number]['ingredientId'], number>()
  for (const slot of slots) {
    if (!slot.active || slot.date < start || slot.date > end || (excluding && sameSlot(slot, excluding))) continue
    const requirements = selectedRequirements(slot)
    if (!requirements) continue
    for (const { ingredientId, quantity } of requirements) {
      totals.set(ingredientId, (totals.get(ingredientId) ?? 0) + quantity)
    }
  }
  return Array.from(totals, ([ingredientId, quantity]) => ({ ingredientId, quantity }))
}

export function remainingMealForecast(
  period: BudgetPeriod, today: string, slots: readonly PlannedSlot[], available: number,
  target: SlotKey, targetServings: number, typicalCost: Record<MealSlot, number>,
) {
  const { end } = periodProgress(period, today)
  const start = today > period.startDate ? today : period.startDate
  const targetInForecast = target.date >= start && target.date <= end
  const days = Math.max(0, dayDifference(start, end) + 1)
  let weight = days * (typicalCost.lunch + typicalCost.dinner)
  let confirmedCost = 0
  let otherConfirmedCost = 0
  let missingRecipes = false
  let missingPrices = false

  // Start from implicit defaults and adjust only persisted overrides.
  for (const entry of slots) {
    if (entry.date < start || entry.date > end) continue
    const typical = typicalCost[entry.slot]
    if (entry.slot !== 'breakfast') weight -= typical
    if (!entry.active) continue

    const isTarget = sameSlot(entry, target)
    const dishes = resolveDishes(entry.recipeIds)
    missingRecipes ||= dishes === null
    if (dishes?.length) {
      const cost = selectedValue(entry)
      if (cost === null) missingPrices = true
      else {
        confirmedCost += cost
        if (!isTarget) otherConfirmedCost += cost
      }
    } else if (!isTarget) {
      weight += typical * entry.servings
    }
  }

  const selected = getSlot(slots, target)
  if (!slots.some((entry) => sameSlot(entry, target)) && targetInForecast && target.slot !== 'breakfast') {
    weight -= typicalCost[target.slot]
  }

  const targetWeight = targetInForecast && selected.active ? typicalCost[target.slot] * targetServings : 0
  const pool = Math.max(0, available - otherConfirmedCost)
  const allowance = targetWeight ? Math.floor(pool * (targetWeight / (weight + targetWeight))) : null
  const otherRequirements: RecipeCosts = Object.fromEntries(
    plannedRequirements(slots, start, end, target).map(({ ingredientId, quantity }) => [ingredientId, quantity]),
  )

  return { allowance, confirmedCost, forecastLeft: available - confirmedCost, otherRequirements, missingRecipes, missingPrices }
}

export function adjacentDate(date: string, offset: -1 | 1) {
  if (offset === 1) return endDate(date, 2) ?? date
  const previous = new Date(Date.parse(date + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10)
  return isCalendarDate(previous) ? previous : date
}
