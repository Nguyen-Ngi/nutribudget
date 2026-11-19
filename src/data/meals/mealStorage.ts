import { budgetStorageKey } from '../budgetStorage.ts'
import { isCalendarDate } from '../../algorithms/calendar.ts'
import { maxServings, validDishSelection } from '../../algorithms/dishSelection.ts'
import { mealSlots } from '../../types/meals.ts'
import type { MealPlanData, PeriodMealPlan, PlannedSlot } from '../../types/meals.ts'

export const mealStorageKey = 'nutribudget:meals'
const emptyPlan: MealPlanData = { version: 1, periods: [] }

export interface MealSnapshot {
  data: MealPlanData
  warning?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSlot(value: unknown): value is PlannedSlot {
  return isObject(value) && typeof value.date === 'string' && isCalendarDate(value.date) &&
    mealSlots.some((slot) => slot === value.slot) && typeof value.active === 'boolean' &&
    typeof value.servings === 'number' && Number.isInteger(value.servings) && value.servings >= 1 &&
    value.servings <= maxServings && validDishSelection(value.recipeIds, value.dishPortions)
}

function isPeriod(value: unknown): value is PeriodMealPlan {
  if (!isObject(value) || typeof value.budgetPeriodId !== 'string' || !value.budgetPeriodId.trim() ||
      !Array.isArray(value.slots) || !value.slots.every(isSlot)) return false
  return new Set(value.slots.map(({ date, slot }) => date + ':' + slot)).size === value.slots.length
}

export function parseMealPlans(raw: string | null): MealSnapshot {
  if (raw === null) return { data: emptyPlan }
  try {
    const value: unknown = JSON.parse(raw)
    if (isObject(value) && value.version === 1 && Array.isArray(value.periods) && value.periods.every(isPeriod) &&
        new Set(value.periods.map(({ budgetPeriodId }) => budgetPeriodId)).size === value.periods.length) {
      return { data: { version: 1, periods: value.periods } }
    }
  } catch {
    // Unreadable data is left in storage while the page is viewed.
  }
  return { data: emptyPlan, warning: 'Không đọc được thực đơn đã lưu. Tạm dừng lưu để bảo vệ lịch sử.' }
}

export function readMealPlans(): MealSnapshot {
  try {
    return parseMealPlans(window.localStorage.getItem(mealStorageKey))
  } catch {
    return { data: emptyPlan, warning: 'Không dùng được bộ nhớ trình duyệt. Chưa thể lưu thực đơn.' }
  }
}

export async function saveMealPlans(update: (data: MealPlanData) => MealPlanData) {
  function save() {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(mealStorageKey)
    } catch {
      throw new Error('Không dùng được bộ nhớ trình duyệt. Kiểm tra cài đặt rồi thử lại.')
    }
    const snapshot = parseMealPlans(raw)
    if (snapshot.warning) throw new Error(snapshot.warning)
    const data = update(snapshot.data)
    if (data === snapshot.data) return
    try {
      window.localStorage.setItem(mealStorageKey, JSON.stringify(data))
    } catch {
      throw new Error('Chưa lưu được thay đổi. Kiểm tra dung lượng trống của trình duyệt rồi thử lại.')
    }
  }
  if (navigator.locks) await navigator.locks.request(budgetStorageKey, async () => save())
  else save()
}
