import test from 'node:test'
import assert from 'node:assert/strict'
import { applyDishEntries, dishEntries, selectedRequirements, selectedValue } from '../src/algorithms/dishSelection.ts'
import { browseDishes, dishCategory } from '../src/algorithms/dishCatalog.ts'
import { defaultPreferences } from '../src/algorithms/mealRecipes.ts'
import { createPeriod, editPeriod, periodExpenses } from '../src/algorithms/budget.ts'
import { approveShopping, assertUncooked, confirmCooking, confirmPurchase, cookingRequirements, kitchenOf } from '../src/algorithms/kitchen.ts'
import { getSlot, periodSlots, remainingMealForecast, updateSlot } from '../src/algorithms/mealSchedule.ts'
import { compareBaskets, pantryStock, pendingLines, shoppingNeeds } from '../src/algorithms/shopping.ts'
import { parseMealPlans } from '../src/data/meals/mealStorage.ts'
import { parseBudget } from '../src/data/budgetStorage.ts'
import { recipes } from '../src/data/meals/recipes.ts'

const today = '2026-11-18'
const settings = { startingAmount: 500000, duration: 3, startDate: today, buffer: null }
const periodId = 'independent'
const budget = createPeriod({ version: 1, periods: [], transactions: [] }, settings, {
  id: periodId, today, confirmReplacement: false, approvedCarryOver: null,
})
const period = budget.periods[0]
const unassigned = getSlot([], { date: today, slot: 'lunch' })
const initial = { version: 1, periods: [] }
const soup = applyDishEntries(unassigned, [{recipeId: 'bun-rieu', servings: 1}])
const saved = updateSlot(initial, period, today, soup, unassigned)

test('catalog search is accent-insensitive, categorized and filterable', () => {
  assert.ok(recipes.length >= 50 && recipes.length <= 70)
  assert.equal(new Set(recipes.map(({id}) => id)).size, recipes.length)
  for (const id of ['hu-tieu', 'bun-bo-hue', 'bun-rieu', 'bo-kho', 'ga-kho-sa', 'com-trang']) {
    assert.ok(recipes.some((recipe) => recipe.id === id))
  }
  assert.deepEqual(browseDishes('bun rieu', 'noodles', defaultPreferences).map(({id}) => id), ['bun-rieu'])
  assert.deepEqual(browseDishes('bun rieu', 'rice', defaultPreferences), [])
  assert.deepEqual(browseDishes('bun rieu', 'all', { ...defaultPreferences, allergens: ['shellfish'] }), [])
  assert.equal(new Set(recipes.map(dishCategory)).size, 5)
})

test('one soup saves on its own, persists and contributes to forecasts without spending', () => {
  assert.deepEqual(parseMealPlans(JSON.stringify(saved)).data, saved)
  assert.equal(periodSlots(saved, periodId)[0].recipeIds.length, 1)
  assert.equal(periodExpenses(budget, periodId).length, 0)
  const forecast = remainingMealForecast(period, today, [soup], 500000, unassigned, 1,
    { breakfast: 20000, lunch: 20000, dinner: 20000 })
  assert.equal(forecast.confirmedCost, selectedValue(soup))
  assert.equal(parseMealPlans(JSON.stringify({ ...saved, periods: [{ budgetPeriodId: periodId, slots: [
    { ...soup, dishPortions: [1.25] },
  ] }] })).warning !== undefined, true)
})

test('independent additions, removals and servings share whole-unit rounding after aggregation', () => {
  const two = applyDishEntries(soup, [{recipeId:'bun-rieu', servings:.5}, {recipeId:'banh-mi-trung', servings:1.5}])
  const updated = updateSlot(saved, period, today, two, soup)
  assert.deepEqual(dishEntries(periodSlots(updated, periodId)[0]), dishEntries(two))
  assert.equal(selectedRequirements(two).find(({ ingredientId }) => ingredientId === 'egg').quantity, 4)
  const one = applyDishEntries(two, [{recipeId:'banh-mi-trung', servings:1.5}])
  assert.deepEqual(periodSlots(updateSlot(updated, period, today, one, two), periodId)[0].recipeIds, ['banh-mi-trung'])
  assert.throws(() => updateSlot(updated, period, today, one, soup), /ở thẻ khác/)
})

test('legacy shared servings are read without rewriting old selections', () => {
  const legacy = { ...unassigned, servings: 2, recipeIds: ['com-trang','ga-kho-sa','canh-bi-do'] }
  assert.equal(selectedRequirements(legacy).find(({ ingredientId }) => ingredientId === 'white-rice').quantity,150)
  assert.deepEqual(dishEntries(legacy).map(({ servings }) => servings), [2,2,2])
  const snapshot = { version: 1, periods: [{budgetPeriodId:periodId,slots:[legacy]}] }
  assert.deepEqual(parseMealPlans(JSON.stringify(snapshot)).data, snapshot)
})

test('standalone soup shops and cooks exactly once, preserving its expense and cooking history', () => {
  const kitchen = kitchenOf(budget)
  const needs = shoppingNeeds(period, today, [soup], kitchen)
  const quote = compareBaskets(needs, periodId, today, kitchen.preferences, new Set())[0]
  assert.deepEqual(quote.proposal.uncovered, [])
  let data = approveShopping(budget, saved, periodId, today, 'soup-list', quote.proposal)
  assert.throws(() => confirmCooking(data, saved, periodId, today, soup), /thiếu nguyên liệu/)
  for (const line of pendingLines(kitchenOf(data), periodId)) {
    data = confirmPurchase(data, saved, periodId, today, 'soup-list', line.ingredientId)
    assert.equal(confirmPurchase(data, saved, periodId, today, 'soup-list', line.ingredientId), data)
  }
  const before = pantryStock(kitchenOf(data))
  const after = confirmCooking(data, saved, periodId, today, soup)
  for(const {ingredientId,quantity} of cookingRequirements(soup)) {
    assert.equal(pantryStock(kitchenOf(after))[ingredientId], before[ingredientId] - quantity)
  }
  assert.deepEqual(after.transactions, data.transactions)
  const restored = parseBudget(JSON.stringify(after)).data
  assert.deepEqual(restored, after)
  assert.equal(confirmCooking(restored, saved, periodId, today, soup), restored)
  assert.throws(() => assertUncooked(kitchenOf(restored), periodId, soup), /đã nấu/)
  assert.throws(() => updateSlot(saved, period, '2026-11-22', soup, soup), /ngoài kỳ/)
  assert.throws(() => editPeriod(after, periodId, { ...settings,startDate:'2026-11-19' },today,[soup]), /Khoản mua/)
})
