import { currentPeriod, isPositiveInteger, periodProgress, recordExpense } from './budget.ts'
import { locateBasket, shoppingArea } from './shoppingLocation.ts'
import { dayDifference } from './calendar.ts'
import { isRealRetailer, priceMaxAge, retailerPlans } from './retailerShopping.ts'
import type { RetailerReference } from '../data/kitchen/retailerResearch.ts'
import type { ManualOffer } from './retailerShopping.ts'
import { sameDishes, selectedRequirements } from './dishSelection.ts'
import { getSlot, periodSlots, slotDateInPeriod } from './mealSchedule.ts'
import { compareBaskets, emptyKitchen, isCurrentShoppingLine, linePrice, mealKey, paidTrips, pantryStock, purchaseKey, shoppingNeeds, tripKey } from './shopping.ts'
import type { BudgetData } from '../types/budget.ts'
import type { MealPlanData, PlannedSlot, SlotKey } from '../types/meals.ts'
import type { KitchenData, ManualStockEvent, ShoppingProposal, StockIngredient } from '../types/kitchen.ts'
import { stockIngredientIds } from '../data/kitchen/retailers.ts'

export const kitchenOf = (data: BudgetData) => data.kitchen ?? emptyKitchen
export const withKitchen = (data: BudgetData, kitchen: KitchenData): BudgetData => ({ ...data, kitchen })

export function assertUncooked(kitchen: KitchenData, periodId: string, meal: SlotKey) {
  const id = mealKey(periodId, meal)
  if (kitchen.events.some((event) => event.kind === 'cooking' && event.id === id)) {
    throw new Error('Bữa này đã nấu nên không thể sửa nguyên liệu đã ghi.')
  }
}

function requirePeriod(data: BudgetData, periodId: string, today: string, mustBeActive: boolean) {
  const period = currentPeriod(data)
  const status = period && periodProgress(period, today).status
  if (!period || period.id !== periodId || status === 'completed' || (mustBeActive && status !== 'active')) {
    throw new Error(mustBeActive ? 'Chỉ xác nhận được khi kỳ ngân sách đang diễn ra.' : 'Kỳ ngân sách đã đóng.')
  }
  return period
}

export function approveShopping(data: BudgetData, meals: MealPlanData, periodId: string, today: string, id: string,
  proposal: ShoppingProposal | null) {
  const period = requirePeriod(data, periodId, today, false)
  const kitchen = kitchenOf(data)
  if (kitchen.approved?.id === id || kitchen.events.some((event) => event.kind === 'purchase' && event.id.startsWith(id + ':'))) {
    throw new Error('Mã giỏ hàng này đã được dùng.')
  }
  const needs = shoppingNeeds(period, today, periodSlots(meals, periodId), kitchen)
  const options = compareBaskets(needs, periodId, today > period.startDate ? today : period.startDate, kitchen.preferences, paidTrips(kitchen))
  if (proposal ? !options.some((option) => option.key === JSON.stringify(proposal)) :
    options.length > 0) {
    throw new Error('Thực đơn, nguyên liệu đang có hoặc giá đã thay đổi. Tính lại giỏ để xem lựa chọn mới.')
  }
  return withKitchen(data, { ...kitchen, approved: proposal ? { ...proposal, id, periodId } : null })
}

export function approveRetailerShopping(data: BudgetData, meals: MealPlanData, periodId: string, today: string, id: string,
  proposal: ShoppingProposal, manual: readonly ManualOffer[], areaId = '', catalog?: readonly RetailerReference[]) {
  const period = requirePeriod(data, periodId, today, false)
  const kitchen = kitchenOf(data)
  if (kitchen.approved?.id === id || kitchen.events.some((event) => event.kind === 'purchase' && event.id.startsWith(id + ':'))) {
    throw new Error('Mã giỏ hàng này đã được dùng.')
  }
  const needs = shoppingNeeds(period, today, periodSlots(meals, periodId), kitchen)
  const options = retailerPlans(needs, today, manual, catalog)
  const key = JSON.stringify(proposal)
  const allowed = options.quotes.map(({ proposal }) => proposal)
  if (manual.length && options.provisional) allowed.push(options.provisional)
  if (!allowed.some((option) => option && JSON.stringify(option) === key)) {
    throw new Error('Danh sách mua hoặc giá đã thay đổi. Hãy xem lại phương án.')
  }
  const area = shoppingArea(areaId)
  const retailers = [...new Set(proposal.lines.map(({ retailerId }) => retailerId).filter(isRealRetailer))]
  const branches = area ? locateBasket(retailers, area).branches : undefined
  return withKitchen(data, { ...kitchen, approved: { ...proposal, id, periodId, mealSignature: needs.mealSignature, ...(branches?.length ? { branches } : {}) } })
}

export function confirmRetailerPurchase(data: BudgetData, meals: MealPlanData, periodId: string, today: string, planId: string,
  ingredientId: StockIngredient, enteredAmount?: number) {
  return confirmPurchase(data, meals, periodId, today, planId, ingredientId, { enteredAmount })
}

export function confirmPurchase(data: BudgetData, meals: MealPlanData, periodId: string, today: string, planId: string,
  ingredientId: StockIngredient, realPurchase?: { enteredAmount?: number }): BudgetData {
  const kitchen = kitchenOf(data)
  const id = purchaseKey(planId, ingredientId)
  if (kitchen.events.some((event) => event.kind === 'purchase' && event.id === id)) return data

  const period = requirePeriod(data, periodId, today, true)
  const plan = kitchen.approved
  let line = plan?.id === planId && plan.periodId === period.id ? plan.lines.find((item) => item.ingredientId === ingredientId) : null
  if (!line) throw new Error('Món hàng này không còn trong giỏ đã duyệt.')
  const needs = shoppingNeeds(period, today, periodSlots(meals, periodId), kitchen)
  if (!isCurrentShoppingLine(line, needs, period, today)) {
    throw new Error('Danh sách đã thay đổi. Chọn “Cập nhật danh sách” để tiếp tục.')
  }

  if (realPurchase) {
    if (!isRealRetailer(line.retailerId) || !line.priceSource) throw new Error('Hãy duyệt phương án mua mới.')
    const source = line.priceSource
    const age = source.kind === 'observed' ? dayDifference(source.observedOn, today) : 0
    if (source.kind === 'unpriced' || age > priceMaxAge || age < 0) {
      const amount = realPurchase.enteredAmount
      if (!isPositiveInteger(amount)) throw new Error('Nhập số tiền mua hàng lớn hơn 0 trước khi xác nhận.')
      const quantity = line.packs * line.packQuantity
      line = { ...line, packs: 1, packQuantity: quantity, packPrice: amount, priceSource: { kind: 'manual', product: source.product } }
    }
  } else if (isRealRetailer(line.retailerId)) {
    throw new Error('Xác nhận mua qua phương án cửa hàng thực.')
  }

  const fee = paidTrips(kitchen).has(tripKey(line, periodId)) ? 0 : line.tripFee
  const updated = recordExpense(data, { id: 'shopping:' + id, budgetPeriodId: periodId, amount: linePrice(line) + fee,
    date: today, category: 'groceries', priceStatus: 'estimated', source: { type: 'shopping-purchase', reference: id } }, today)
  if (updated === data) throw new Error('Không tìm thấy bản ghi tương ứng với khoản mua này. Số lượng nguyên liệu vẫn giữ nguyên.')
  if (!Number.isSafeInteger((pantryStock(kitchen)[ingredientId] ?? 0) + line.packs * line.packQuantity)) {
    throw new Error('Khoản mua này vượt giới hạn số lượng nguyên liệu có thể lưu.')
  }
  return withKitchen(updated, { ...kitchen, events: [...kitchen.events, { kind: 'purchase', id, date: today, periodId, line, fee }] })
}

export function adjustStock(data: BudgetData, event: ManualStockEvent) {
  const kitchen = kitchenOf(data)
  if (kitchen.events.some(({ id }) => id === event.id)) return data
  const after = (pantryStock(kitchen)[event.ingredientId] ?? 0) + event.quantity
  if (!stockIngredientIds.includes(event.ingredientId) || !Number.isSafeInteger(event.quantity) ||
      event.quantity === 0 || !Number.isSafeInteger(after) || after < 0 ||
      (event.kind === 'addition' && event.quantity < 0) || !event.reason.trim()) {
    throw new Error('Nhập số lượng khác 0 và lý do hợp lệ. Số lượng còn lại phải từ 0 trở lên.')
  }
  return withKitchen(data, { ...kitchen, events: [...kitchen.events, event] })
}

export function cookingRequirements(meal: PlannedSlot) {
  const requirements = selectedRequirements(meal)
  if (!meal.recipeIds.length || !requirements) return null
  return requirements.flatMap(({ ingredientId, quantity }) =>
    ingredientId === 'water' ? [] : [{ ingredientId, quantity }])
}

export function cookingShortages(requirements: NonNullable<ReturnType<typeof cookingRequirements>>, kitchen: KitchenData) {
  const stock = pantryStock(kitchen)
  return requirements.flatMap(({ ingredientId, quantity }) => {
    const missing = quantity - (stock[ingredientId] ?? 0)
    return missing > 0 ? [{ ingredientId, quantity: missing }] : []
  })
}

export function confirmCooking(data: BudgetData, meals: MealPlanData, periodId: string, today: string, expected: PlannedSlot) {
  const kitchen = kitchenOf(data)
  const id = mealKey(periodId, expected)
  if (kitchen.events.some((event) => event.kind === 'cooking' && event.id === id)) return data
  const period = requirePeriod(data, periodId, today, true)
  const meal = getSlot(periodSlots(meals, periodId), expected)
  if (!slotDateInPeriod(period, meal.date) || !meal.active || !expected.active ||
      !sameDishes(meal, expected)) {
    throw new Error('Bữa đã lưu có thay đổi. Xem lại món đã chọn trước khi xác nhận.')
  }
  const requirements = cookingRequirements(meal)
  if (!requirements) throw new Error('Chọn một bữa đã lưu có công thức trong danh mục.')
  if (cookingShortages(requirements, kitchen).length) throw new Error('Còn thiếu nguyên liệu. Kiểm tra số lượng trong tủ trước khi xác nhận.')
  return withKitchen(data, { ...kitchen,
    events: [...kitchen.events, { kind: 'cooking', id, date: today, periodId, meal, ingredients: requirements }] })
}
