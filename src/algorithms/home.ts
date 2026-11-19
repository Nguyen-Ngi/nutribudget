import { budgetTotals, currentPeriod, periodExpenses, periodProgress } from './budget.ts'
import { cookingRequirements, cookingShortages, kitchenOf } from './kitchen.ts'
import { periodSlots } from './mealSchedule.ts'
import { cookedKeys, mealKey } from './shopping.ts'
import type { BudgetData } from '../types/budget.ts'
import { mealSlots } from '../types/meals.ts'
import type { MealPlanData, SlotKey } from '../types/meals.ts'

export function mealHref(periodId: string, meal: SlotKey) {
  return '#meals?' + new URLSearchParams({ period: periodId, date: meal.date, slot: meal.slot }).toString()
}

export function resolveHome(data: BudgetData, meals: MealPlanData, today: string) {
  const period = currentPeriod(data)
  if (!period) return { kind: 'setup' } as const
  const timing = periodProgress(period, today)
  if (timing.status === 'completed') return { kind: 'expired' } as const

  const totals = budgetTotals(period, periodExpenses(data, period.id))
  const kitchen = kitchenOf(data)
  const cooked = cookedKeys(kitchen)
  const slots = periodSlots(meals, period.id)
  const start = today > period.startDate ? today : period.startDate
  const upcoming = slots.filter((slot) => slot.active && slot.recipeIds.length &&
    slot.date >= start && slot.date <= timing.end && !cooked.has(mealKey(period.id, slot)))
  const meal = upcoming.sort((a, b) => a.date.localeCompare(b.date) || mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot))[0]
  const selectedDishes = upcoming.reduce((count, slot) => count + slot.recipeIds.length, 0)
  const hasShoppingPlan = kitchen.approved?.periodId === period.id && kitchen.approved.lines.length > 0
  const budget = { period, timing, totals, selectedDishes, hasShoppingPlan }
  if (!meal) return { kind: slots.some((slot) => cooked.has(mealKey(period.id, slot))) ? 'cooked' : 'plan', budget } as const

  const requirements = cookingRequirements(meal)
  const href = mealHref(period.id, meal)
  if (!requirements) return { kind: 'review', budget, meal, href } as const
  const shortages = cookingShortages(requirements, kitchen)
  if (shortages.length) return { kind: 'shop', budget, meal, shortages } as const
  return { kind: timing.status === 'upcoming' ? 'scheduled' : 'cook', budget, meal, href } as const
}
