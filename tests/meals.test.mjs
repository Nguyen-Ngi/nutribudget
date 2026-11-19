import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetTotals, createPeriod, currentPeriod, recordExpense } from '../src/algorithms/budget.ts'
import {
  combinations, defaultPreferences, extraPackCost, ingredientRequirements, ingredientValue,
  matchesMealSearch, mealMetrics, recipeTags, reusablePackValue,
} from '../src/algorithms/mealRecipes.ts'
import { rankMeals, recommendationShortlist, typicalMealCost } from '../src/algorithms/mealRecommendations.ts'
import {
  adjacentDate, getSlot, periodSlots, plannedRequirements, remainingMealForecast, slotDateInPeriod, updateSlot,
} from '../src/algorithms/mealSchedule.ts'
import { parseMealPlans, readMealPlans, saveMealPlans, mealStorageKey } from '../src/data/meals/mealStorage.ts'
import { illustrativePrices } from '../src/data/meals/prices.ts'
import { illustrativeNutrition } from '../src/data/meals/nutrition.ts'
import { ingredients } from '../src/data/meals/ingredients.ts'
import { recipes, recipeById, legacyRecipes } from '../src/data/meals/recipes.ts'

const today = '2026-11-18'
const tomorrow = '2026-11-19'
const period = {
  id: 'period-1', startingAmount: 400_000, startDate: today, duration: 3,
  buffer: { percentage: 10 }, status: 'open', carryOver: null,
}
const lunch = { date: today, slot: 'lunch' }
const breakfast = { date: tomorrow, slot: 'breakfast' }
const basePlan = { version: 1, periods: [] }
const dish = (id) => recipeById.get(id)
const lunchDishes = ['com-trang', 'dau-hu-sot-ca', 'canh-bi-do']
const typical = { breakfast: 13_000, lunch: 23_000, dinner: 20_000 }

function rank(candidates, options = {}) {
  return rankMeals(candidates, {
    slot: 'lunch', servings: 1, allowance: null, otherIngredients: {},
    recentDishes: [], preferences: defaultPreferences, ...options,
  })
}

test('catalog prices cover every ingredient and legacy nutrition remains available', () => {
  assert.ok(recipes.length >= 15)
  assert.equal(recipeById.size, recipes.length)
  assert.equal(Object.keys(illustrativePrices).length, Object.keys(ingredients).length)
  for (const recipe of recipes) {
    assert.ok(recipe.instructions.length)
    assert.ok(recipe.mealTypes.length)
    assert.ok(recipe.equipment.length)
    if (legacyRecipes.some(({ id }) => id === recipe.id)) assert.ok(illustrativeNutrition[recipe.id].calories > 0)
    for (const { ingredientId, quantity } of recipe.ingredients) {
      assert.ok(ingredients[ingredientId])
      assert.ok(illustrativePrices[ingredientId].packQuantity > 0)
      assert.ok(quantity > 0)
    }
  }
  assert.equal(combinations('breakfast', defaultPreferences).length, 5)
  assert.equal(combinations('lunch', defaultPreferences).length, 96)
  assert.equal(combinations('dinner', defaultPreferences).length, 96)
})

test('quantities scale per serving and merge shared ingredients across dishes', () => {
  const dishes = [dish('dau-hu-sot-ca'), dish('rau-muong-xao')]
  const scaled = new Map(ingredientRequirements(dishes, 3).map(({ ingredientId, quantity }) => [ingredientId, quantity]))
  assert.equal(scaled.get('tofu'), 420)
  assert.equal(scaled.get('garlic'), 27)
  assert.equal(scaled.get('oil'), 33)
  assert.deepEqual(ingredientRequirements([dish('banh-mi-trung')], 2).find(({ ingredientId }) => ingredientId === 'egg'),
    { ingredientId: 'egg', quantity: 4 })
})

test('costs use the price catalog and distinguish portion value from adding packs', () => {
  assert.equal(mealMetrics([dish('com-trang')], 1).cost, 1875)
  const combination = [dish('com-trang'), dish('canh-bi-do')]
  const metrics = mealMetrics(combination, 2)
  const expected = Math.round(150 * 25 + 260 * 40 + 12 * 90 + 2 * 26)
  assert.equal(metrics.cost, expected)
  assert.equal(metrics.nutrition.protein, 6)
  const rice = ingredientRequirements([dish('com-trang')], 2)
  assert.equal(ingredientValue(rice), 3750)
  assert.equal(extraPackCost(rice, {}), 25_000)
  assert.equal(extraPackCost(rice, { 'white-rice': 700 }), 0)
  assert.equal(reusablePackValue(rice, { 'white-rice': 700 }), 3750)
  assert.equal(extraPackCost(rice, { 'white-rice': 950 }), 25_000)
})

test('allergens, dietary exclusions, and essential equipment filter full combinations', () => {
  const restricted = { ...defaultPreferences, diet: 'vegan', allergens: ['soy', 'wheat'], equipment: ['stovetop', 'pot', 'knife'] }
  const matches = combinations('lunch', restricted)
  assert.ok(matches.length > 0)
  for (const combo of matches) {
    const tags = recipeTags(combo)
    assert.deepEqual(tags.animalSources, [])
    assert.deepEqual(tags.allergens, [])
    assert.equal(combo[0].id, 'com-trang')
    assert.equal(combo[1].id, 'dau-xanh-kho-nam')
    assert.ok(combo.every((recipe) => !recipe.equipment.includes('skillet')))
  }
  assert.deepEqual(combinations('dinner', { ...restricted, equipment: ['knife'] }), [])
  assert.ok(combinations('lunch', { ...defaultPreferences, diet: 'no pork' })
    .every((combo) => !combo.some(({ id }) => id === 'thit-kho-trung')))
  assert.ok(combinations('breakfast', { ...defaultPreferences, allergens: ['fish'] })
    .every(([recipe]) => recipe.id !== 'chao-ga'))
  assert.equal(matchesMealSearch([dish('dau-hu-sot-ca')], 'dau hu tofu'), true)
  assert.equal(matchesMealSearch([dish('dau-xanh-kho-nam'), dish('canh-ca-chua')], 'dau hu'), false)
})

test('ranking is deterministic, prioritizes fit, and offers several mains', () => {
  const candidates = combinations('lunch', defaultPreferences)
  const price = Math.min(...candidates.map((combo) => mealMetrics(combo, 1).cost))
  const results = rank(candidates, { allowance: price })
  assert.equal(results[0].exceedsAllowance, false)
  assert.ok(results.at(-1).exceedsAllowance)
  assert.deepEqual(results.map(({ key }) => key), rank([...candidates].reverse(), { allowance: price }).map(({ key }) => key))
  const shortlist = recommendationShortlist(rank(candidates, { allowance: 500_000 }))
  assert.equal(shortlist.length, 5)
  assert.equal(new Set(shortlist.map(({ leadingDish }) => leadingDish)).size, 5)
  assert.ok(typicalMealCost('lunch', []) > 0)

  const pair = [
    [dish('com-trang'), dish('dau-hu-sot-ca'), dish('canh-bi-do')],
    [dish('com-trang'), dish('ga-kho-sa'), dish('canh-bi-do')],
  ]
  const preferences = { ...defaultPreferences, savings: 0, nutrition: 0, variety: 4 }
  assert.equal(rank(pair, { preferences, recentDishes: ['dau-hu-sot-ca'] })[0].leadingDish, 'ga-kho-sa')
})

test('defaults and sparse schedule edits support bounded dates and independently enabled meals', () => {
  const initial = getSlot([], lunch)
  assert.equal(initial.active, true)
  assert.equal(initial.servings, 1)
  assert.deepEqual(initial.recipeIds, [])
  assert.equal(getSlot([], breakfast).active, false)
  assert.equal(getSlot([], { ...breakfast, slot: 'dinner' }).active, true)
  assert.equal(slotDateInPeriod(period, '2026-11-20'), true)
  assert.equal(slotDateInPeriod(period, '2026-11-21'), false)
  assert.equal(adjacentDate('2026-12-31', 1), '2027-01-01')
  assert.equal(adjacentDate('2024-03-01', -1), '2024-02-29')

  const active = updateSlot(basePlan, period, today, { ...getSlot([], breakfast), active: true, servings: 2 }, getSlot([], breakfast))
  const changed = updateSlot(active, period, today, { ...initial, active: false }, initial)
  assert.equal(getSlot(periodSlots(changed, period.id), breakfast).servings, 2)
  assert.equal(getSlot(periodSlots(changed, period.id), lunch).active, false)
  assert.equal(getSlot(periodSlots(changed, period.id), { ...lunch, date: tomorrow }).active, true)
  assert.throws(() => updateSlot(basePlan, period, '2026-11-21', initial, initial), /ngoài kỳ/)
  assert.throws(() => updateSlot(changed, period, today, initial, initial), /ở thẻ khác/)
})

test('allowances weigh portions and composition, reserve other plans, and skip past/out-of-range meals', () => {
  const initial = remainingMealForecast(period, today, [], 360_000, lunch, 1, typical)
  assert.equal(initial.allowance, Math.floor(360_000 * 23_000 / 129_000))
  assert.equal(initial.confirmedCost, 0)
  assert.ok(remainingMealForecast(period, today, [], 360_000, lunch, 2, typical).allowance > initial.allowance)
  assert.equal(remainingMealForecast(period, tomorrow, [], 360_000, lunch, 1, typical).allowance, null)
  const selected = { ...getSlot([], lunch), date: tomorrow, servings: 2, recipeIds: lunchDishes }
  const archived = { ...selected, date: '2026-11-21' }
  const forecast = remainingMealForecast(period, today, [selected, archived], 360_000, lunch, 1, typical)
  const reserved = mealMetrics(lunchDishes.map(dish), 2).cost
  assert.equal(forecast.confirmedCost, reserved)
  assert.equal(forecast.forecastLeft, 360_000 - reserved)
  assert.equal(forecast.allowance, Math.floor((360_000 - reserved) * 23_000 / 106_000))
  assert.equal(forecast.otherRequirements['white-rice'], 150)
  assert.deepEqual(plannedRequirements([{ ...selected, active: false }], today, tomorrow), [])
  assert.equal(plannedRequirements([selected], today, tomorrow).find(({ ingredientId }) => ingredientId === 'tofu').quantity, 280)
})

test('versioned localStorage refresh preserves selected meals while budget and expense bytes stay intact', async () => {
  const budget = recordExpense(
    createPeriod({ version: 1, periods: [], transactions: [] }, period, {
      id: period.id, today, confirmReplacement: false, approvedCarryOver: null,
    }),
    { id: 'grocery-1', budgetPeriodId: period.id, amount: 18_000, date: today, category: 'groceries',
      priceStatus: 'estimated', source: { type: 'manual' } },
    today,
  )
  const original = JSON.stringify(budget)
  const store = new Map([['nutribudget:budget', original]])
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true, value: { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } },
  })
  try {
    const initial = getSlot([], lunch)
    await saveMealPlans((data) => updateSlot(data, currentPeriod(budget), today, { ...initial, recipeIds: lunchDishes }, initial))
    const refreshed = readMealPlans().data
    assert.deepEqual(getSlot(periodSlots(refreshed, period.id), lunch).recipeIds, lunchDishes)
    const saved = getSlot(periodSlots(refreshed, period.id), lunch)
    const replacement = ['com-trang', 'ga-kho-sa', 'rau-muong-xao']
    await saveMealPlans((data) => updateSlot(data, period, today, { ...saved, recipeIds: replacement, servings: 2 }, saved))
    assert.deepEqual(getSlot(periodSlots(readMealPlans().data, period.id), lunch).recipeIds, replacement)
    assert.deepEqual(getSlot(periodSlots(readMealPlans().data, 'new-period'), lunch).recipeIds, [])
    assert.equal(store.get('nutribudget:budget'), original)
    assert.equal(budgetTotals(currentPeriod(budget), budget.transactions).planningAvailable, 342_000)
    assert.ok(store.has(mealStorageKey))
    const paused = getSlot(periodSlots(readMealPlans().data, period.id), lunch)
    await saveMealPlans((data) => updateSlot(data, period, today, { ...paused, active: false }, paused))
    assert.deepEqual(getSlot(periodSlots(readMealPlans().data, period.id), lunch).recipeIds, replacement)
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, 'window', storageDescriptor)
    else delete globalThis.window
  }
})

test('corrupt meal schemas fail safely and historical catalog IDs round trip', () => {
  const historical = {
    version: 1, periods: [{ budgetPeriodId: period.id, slots: [{ ...getSlot([], breakfast), active: true, recipeIds: ['retired-dish'] }] }],
  }
  assert.deepEqual(parseMealPlans(JSON.stringify(historical)).data, historical)
  const invalid = [
    '{invalid', JSON.stringify({ ...historical, version: 2 }),
    JSON.stringify({ ...historical, periods: [...historical.periods, ...historical.periods] }),
  ]
  for (const raw of invalid) assert.match(parseMealPlans(raw).warning, /Không đọc được/)
  assert.deepEqual(parseMealPlans(null), { data: basePlan })
})
