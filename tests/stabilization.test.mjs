import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetTotals, carryOverOffer, createPeriod, currentPeriod, editPeriod, periodExpenses, recordExpense } from '../src/algorithms/budget.ts'
import { endDate, localDate } from '../src/algorithms/calendar.ts'
import { adjustStock, approveShopping, confirmCooking, confirmPurchase, cookingRequirements, kitchenOf } from '../src/algorithms/kitchen.ts'
import { rankMeals } from '../src/algorithms/mealRecommendations.ts'
import { combinations, defaultPreferences, extraPackCost, mealMetrics } from '../src/algorithms/mealRecipes.ts'
import { getSlot, periodSlots, remainingMealForecast, updateSlot } from '../src/algorithms/mealSchedule.ts'
import { compareBaskets, defaultShopping, emptyKitchen, isCurrentShoppingLine, paidTrips, pantryStock, pendingLines, shoppingNeeds } from '../src/algorithms/shopping.ts'
import { budgetStorageKey, readBudget, updateBudget } from '../src/data/budgetStorage.ts'
import { mealStorageKey, readMealPlans, saveMealPlans } from '../src/data/meals/mealStorage.ts'
import { illustrativePrices } from '../src/data/meals/prices.ts'
import { recipeById } from '../src/data/meals/recipes.ts'

const start = '2026-12-31'
const followingDay = '2027-01-01'
const periodId = 'new-years'
const emptyBudget = { version: 1, periods: [], transactions: [] }
const settings = { startDate: start, duration: 3, startingAmount: 500_000, buffer: { percentage: 10 } }
const breakfast = { date: followingDay, slot: 'breakfast', active: true, servings: 1, recipeIds: ['banh-mi-trung'] }
const linked = { version: 1, periods: [{ budgetPeriodId: periodId, slots: [breakfast] }] }

function create(data = emptyBudget, options = {}, changes = {}) {
  return createPeriod(data, { ...settings, ...changes }, {
    id: periodId, today: start, confirmReplacement: false, approvedCarryOver: null, ...options,
  })
}

function withStock(data, id, quantity) {
  return adjustStock(data, { id: 'stock-' + id, date: start, ingredientId: id, quantity,
    kind: 'addition', reason: 'On hand' })
}

function quotes(data, slots = [breakfast], today = start) {
  const kitchen = kitchenOf(data)
  return compareBaskets(shoppingNeeds(currentPeriod(data), today, slots, kitchen), periodId, today,
    kitchen.preferences, paidTrips(kitchen))
}

function storageHarness(t, initial = []) {
  const entries = new Map(initial)
  let rejectKey
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key) => entries.get(key) ?? null,
    setItem(key, value) {
      if (key === rejectKey) {
        rejectKey = undefined
        throw new Error('Simulated quota failure')
      }
      entries.set(key, value)
    },
  } } })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else delete globalThis.window
  })
  return { entries, failOnce(key) { rejectKey = key } }
}

test('budget date edits protect paused confirmed meals, while preserving previously out-of-range and unconfirmed records', () => {
  const data = create()
  const oneDay = { ...settings, duration: 1 }
  const paused = { ...breakfast, active: false }
  const oldOutOfRange = { ...breakfast, date: '2027-01-10' }
  assert.throws(() => editPeriod(data, periodId, oneDay, start, [paused]), /Bữa đã lưu ngày 1\/1\/2027/)
  assert.equal(currentPeriod(editPeriod(data, periodId, oneDay, start,
    [oldOutOfRange, { ...breakfast, recipeIds: [] }])).duration, 1)
  assert.equal(currentPeriod(editPeriod(data, periodId, { ...settings, buffer: null }, start, [paused])).buffer, null)
})

test('date edits protect early cooking by both its scheduled date and actual recorded date', () => {
  let data = create()
  for (const { ingredientId, quantity } of cookingRequirements(breakfast)) data = withStock(data, ingredientId, quantity)
  const cooked = confirmCooking(data, linked, periodId, start, breakfast)
  assert.throws(() => editPeriod(cooked, periodId, { ...settings, duration: 1 }, start), /Bản ghi nấu ăn ngày 1\/1\/2027/)
  assert.throws(() => editPeriod(cooked, periodId, { ...settings, startDate: followingDay }, start), /Bản ghi nấu ăn ngày 31\/12\/2026/)
  const changed = editPeriod(cooked, periodId, { ...settings, duration: 4 }, start)
  assert.deepEqual(changed.kitchen.events, cooked.kitchen.events)
})

test('shopping rejects an approved trip moved outside an edited budget and keeps the pending history intact', () => {
  const data = create()
  const quote = quotes(data)[0].proposal
  // A preferred day can schedule a trip before the meal. Represent that approved trip explicitly for the freshness check.
  const line = { ...quote.lines[0], shoppingDate: start }
  const revised = { ...currentPeriod(data), startDate: followingDay }
  const needs = shoppingNeeds(revised, start, [breakfast], emptyKitchen)
  assert.equal(isCurrentShoppingLine(line, needs, revised, start), false)
  assert.equal(isCurrentShoppingLine(quote.lines[0], needs, revised, start), true)
})

test('retailer comparison skips zero stock, incomplete offers, and zero or missing prices', () => {
  const needs = { deadline: start, mealCount: 1, missingMeals: 0,
    requirements: [{ ingredientId: 'egg', required: 4, onHand: 0, shortage: 4 }] }
  const offer = { quantity: 2, price: 4000, minimumPacks: 1 }
  const retailer = { id: 'produce', name: 'Test store', fee: 0, days: [4], offers: {} }
  for (const offers of [
    {}, { egg: { ...offer, availablePacks: 0 } }, { egg: { ...offer, availablePacks: 1 } },
    { egg: { ...offer, price: 0 } }, { egg: { ...offer, price: undefined } }, { egg: { ...offer, quantity: 0 } },
  ]) {
    assert.deepEqual(compareBaskets(needs, periodId, start, defaultShopping, new Set(), [{ ...retailer, offers }]), [])
  }
  const [basket] = compareBaskets(needs, periodId, start, defaultShopping, new Set(),
    [{ ...retailer, offers: { egg: { ...offer, availablePacks: 2 } } }])
  assert.equal(basket.proposal.lines[0].packs, 2)
  assert.equal(basket.total, 8000)
})

test('missing base prices and retired recipe IDs do not produce free or misleading meal estimates', () => {
  const original = illustrativePrices.egg
  delete illustrativePrices.egg
  try {
    const recipe = [recipeById.get('banh-mi-trung')]
    const metrics = mealMetrics(recipe, 1)
    assert.equal(metrics.cost, null)
    assert.equal(extraPackCost(metrics.requirements, {}), null)
    const ranked = rankMeals(combinations('breakfast', defaultPreferences), {
      slot: 'breakfast', servings: 1, allowance: 50000, otherIngredients: {}, recentDishes: [], preferences: defaultPreferences,
    })
    assert.ok(ranked.length)
    assert.ok(ranked.every(({ key }) => key !== 'banh-mi-trung'))
    const forecast = remainingMealForecast(currentPeriod(create()), start, [breakfast], 50000, breakfast, 1,
      { breakfast: 10000, lunch: 20000, dinner: 20000 })
    assert.equal(forecast.missingPrices, true)
  } finally {
    illustrativePrices.egg = original
  }
  const shopping = shoppingNeeds(currentPeriod(create()), start, [{ ...breakfast, recipeIds: ['retired-breakfast'] }], emptyKitchen)
  assert.equal(shopping.mealCount, 1)
  assert.equal(shopping.missingMeals, 1)
  assert.deepEqual(shopping.requirements, [])
})

test('corrupt budget and meal documents are preserved verbatim and their update callbacks do not run', async (t) => {
  const rawBudget = JSON.stringify({ version: 2, periods: [{ id: 'future-budget' }] })
  const rawMeals = '{"version":1,"periods":[{"budgetPeriodId":"original","slots":['
  const { entries } = storageHarness(t, [[budgetStorageKey, rawBudget], [mealStorageKey, rawMeals]])
  const shouldNotRun = () => assert.fail('An unreadable state must never be given to a writer')
  await assert.rejects(updateBudget(shouldNotRun), /Tạm dừng lưu/)
  await assert.rejects(saveMealPlans(shouldNotRun), /Tạm dừng lưu/)
  assert.equal(entries.get(budgetStorageKey), rawBudget)
  assert.equal(entries.get(mealStorageKey), rawMeals)
})

test('persisted journey keeps forecasts, manual expense, purchases and cooking distinct across retries and rollover', async (t) => {
  const { entries, failOnce } = storageHarness(t)
  await updateBudget((data) => create(data))
  await updateBudget((data) => withStock(data, 'egg', 1))
  await updateBudget((data) => recordExpense(data, {
    id: 'manual-expense', budgetPeriodId: periodId, date: start, amount: 10000, category: 'groceries',
    priceStatus: 'estimated', source: { type: 'manual' },
  }, start))
  const ledgerBeforePlanning = entries.get(budgetStorageKey)
  const saveBreakfast = (data) =>
    updateSlot(data, currentPeriod(readBudget().data), start, breakfast, getSlot([], breakfast))
  failOnce(mealStorageKey)
  await assert.rejects(saveMealPlans(saveBreakfast), /Chưa lưu được/)
  assert.equal(entries.has(mealStorageKey), false)
  await saveMealPlans(saveBreakfast)
  assert.equal(entries.get(budgetStorageKey), ledgerBeforePlanning)
  const [best] = quotes(readBudget().data)
  const oneStore = quotes(readBudget().data).find(({ stores }) => stores.length === 1 && !best.proposal.uncovered.length && stores[0].retailerId === 'neighborhood')
  await updateBudget((data) => approveShopping(data, readMealPlans().data, periodId, start, 'demo-list', oneStore.proposal))
  assert.equal(readBudget().data.transactions.length, 1)
  const buy = (data) => confirmPurchase(data, readMealPlans().data, periodId, start, 'demo-list', 'egg')
  await updateBudget(buy)
  const partial = entries.get(budgetStorageKey)
  await updateBudget(buy)
  assert.equal(entries.get(budgetStorageKey), partial)
  assert.equal(pantryStock(kitchenOf(readBudget().data)).egg, 7)
  assert.equal(pendingLines(kitchenOf(readBudget().data), periodId).length, 4)

  await saveMealPlans((data) => updateSlot(data, currentPeriod(readBudget().data), start, { ...breakfast, servings: 2 }, breakfast))
  assert.equal(entries.get(budgetStorageKey), partial)
  assert.throws(() => confirmPurchase(readBudget().data, readMealPlans().data, periodId, start, 'demo-list', 'baguette'), /thay đổi/)
  await saveMealPlans((data) => updateSlot(data, currentPeriod(readBudget().data), start, breakfast, { ...breakfast, servings: 2 }))
  for (const line of pendingLines(kitchenOf(readBudget().data), periodId)) {
    await updateBudget((data) => confirmPurchase(data, readMealPlans().data, periodId, start, 'demo-list', line.ingredientId))
  }
  const cook = (data) => confirmCooking(data, readMealPlans().data, periodId, start, breakfast)
  const beforeCooking = entries.get(budgetStorageKey)
  failOnce(budgetStorageKey)
  await assert.rejects(updateBudget(cook), /Chưa lưu được/)
  assert.equal(entries.get(budgetStorageKey), beforeCooking)
  await updateBudget(cook)
  const afterCooking = entries.get(budgetStorageKey)
  await updateBudget(cook)
  assert.equal(entries.get(budgetStorageKey), afterCooking)
  const finished = readBudget().data
  assert.deepEqual(finished.transactions, JSON.parse(beforeCooking).transactions)
  assert.equal(pantryStock(kitchenOf(finished)).egg, 5)
  assert.equal(finished.transactions.length, 6)
  assert.equal(budgetTotals(currentPeriod(finished), finished.transactions).planningAvailable, 367000)

  const nextDate = '2027-01-03'
  const offer = carryOverOffer(finished, nextDate)
  assert.equal(offer.amount, 417000)
  const next = create(finished, { id: 'next', previousId: periodId, approvedCarryOver: offer, today: nextDate },
    { startDate: nextDate })
  assert.equal(carryOverOffer(next, '2027-01-06').fromPeriodId, 'next')
  assert.throws(() => create(next, { id: 'replay', previousId: 'next', today: '2027-01-06', approvedCarryOver: offer }), /Số dư chuyển kỳ đã thay đổi/)
  assert.deepEqual(kitchenOf(next).events, kitchenOf(finished).events)
  assert.deepEqual(periodExpenses(next, periodId), finished.transactions)
  assert.deepEqual(periodSlots(readMealPlans().data, periodId), [breakfast])
})

test('a long period and a very small overspent budget keep dates and planning forecasts finite', () => {
  const data = create(emptyBudget, {}, { startingAmount: 1, duration: 36500, buffer: { percentage: 100 } })
  const overspent = recordExpense(data, { id: 'overspent', budgetPeriodId: periodId, amount: 20, date: start,
    category: 'groceries', priceStatus: 'estimated', source: { type: 'manual' } }, start)
  const period = currentPeriod(overspent)
  const totals = budgetTotals(period, overspent.transactions)
  assert.equal(totals.remaining, -19)
  assert.equal(totals.planningAvailable, 0)
  assert.equal(endDate(start, 2), followingDay)
  assert.equal(localDate(new Date(2026, 11, 31, 23, 45)), start)
  const result = remainingMealForecast(period, start, [breakfast], totals.planningAvailable,
    { date: start, slot: 'lunch' }, 1, { breakfast: 15000, lunch: 25000, dinner: 25000 })
  assert.equal(result.allowance, 0)
  assert.ok(result.forecastLeft < 0)
})
