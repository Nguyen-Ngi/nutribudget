import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetTotals, createPeriod, currentPeriod, recordExpense } from '../src/algorithms/budget.ts'
import { adjustStock, approveShopping, assertUncooked, confirmCooking, confirmPurchase, cookingRequirements, kitchenOf, withKitchen } from '../src/algorithms/kitchen.ts'
import { basketTotal, compareBaskets, defaultShopping, paidTrips, pantryStock, pendingLines, shoppingNeeds } from '../src/algorithms/shopping.ts'
import { budgetStorageKey, parseBudget, readBudget, updateBudget } from '../src/data/budgetStorage.ts'
import { retailers } from '../src/data/kitchen/retailers.ts'

const today = '2026-11-18'
const id = 'first-period'
const settings = { startDate: today, duration: 8, startingAmount: 500_000, buffer: { percentage: 10 } }
const empty = { version: 1, periods: [], transactions: [] }
const meal = { date: today, slot: 'breakfast', active: true, servings: 2, recipeIds: ['banh-mi-trung'] }
const mealsFor = (slots) => ({ version: 1, periods: [{ budgetPeriodId: id, slots }] })
const mealPlan = mealsFor([meal])
const open = () => createPeriod(empty, settings, { id, today, confirmReplacement: false, approvedCarryOver: null })
const nextPeriod = (budget) => createPeriod(budget, settings, {
  id: 'next-period', previousId: id, today, confirmReplacement: true, approvedCarryOver: null,
})
const manual = (budget, ingredientId, quantity, kind = 'addition') => adjustStock(budget, {
  id: `manual-${kitchenOf(budget).events.length}`, date: today, ingredientId, quantity, kind, reason: 'Stocktake',
})
function approve(budget = open(), plans = mealPlan, planId = 'list-id', retailer) {
  const kitchen = kitchenOf(budget)
  const needs = shoppingNeeds(currentPeriod(budget), today, plans.periods[0].slots, kitchen)
  const options = compareBaskets(needs, id, today, kitchen.preferences, paidTrips(kitchen))
  const option = retailer ? options.find(({ stores }) => stores.length === 1 && stores[0].retailerId === retailer) : options[0]
  return approveShopping(budget, plans, id, today, planId, option.proposal)
}

test('shopping aggregates confirmed servings, excludes disabled/unconfirmed slots, and offsets pantry stock', () => {
  let budget = manual(open(), 'egg', 1)
  budget = manual(budget, 'salt', 50)
  const slots = [
    meal,
    { ...meal, date: '2026-11-20', servings: 1 },
    { ...meal, date: '2026-11-21', active: false },
    { ...meal, date: '2026-11-22', recipeIds: [] },
    { ...meal, date: '2026-11-17' },
  ]
  const needs = shoppingNeeds(currentPeriod(budget), today, slots, kitchenOf(budget))
  assert.equal(needs.mealCount, 2)
  assert.deepEqual(needs.requirements.find(({ ingredientId }) => ingredientId === 'egg'),
    { ingredientId: 'egg', required: 6, onHand: 1, shortage: 5 })
  assert.equal(needs.requirements.find(({ ingredientId }) => ingredientId === 'salt').shortage, 0)
  const quote = compareBaskets(needs, id, today, defaultShopping, new Set())[0]
  const egg = quote.proposal.lines.find(({ ingredientId }) => ingredientId === 'egg')
  assert.equal(egg.packs * egg.packQuantity, 6)
  assert.equal(egg.packs * egg.packQuantity - egg.shortage, 1)
})

test('pack minimums, availability, and day preferences affect feasible baskets', () => {
  const needs = {
    requirements: [{ ingredientId: 'water-spinach', required: 130, onHand: 20, shortage: 110 }],
    deadline: '2026-11-21', mealCount: 1,
  }
  const quotes = compareBaskets(needs, id, today, { ...defaultShopping, mode: 'convenient', days: [4] }, new Set())
  const produce = quotes.find(({ stores }) => stores[0].retailerId === 'produce')
  assert.equal(produce.stores[0].date, '2026-11-19')
  assert.equal(produce.stores[0].fee, 5000)
  assert.equal(produce.proposal.lines[0].packs, 2)
  assert.equal(produce.total, 15_400)
  assert.ok(!quotes.some(({ stores }) => stores[0].retailerId === 'staples'))
  const sunday = { ...needs, deadline: '2026-11-22' }
  assert.ok(!compareBaskets(sunday, id, '2026-11-22', defaultShopping, new Set())
    .some(({ stores }) => stores.some(({ retailerId }) => retailerId === 'produce')))
})

test('Save More chooses total cost including fees and More Convenient favors fewer stores', () => {
  const offer = (price) => ({ quantity: 1, price, minimumPacks: 1 })
  const catalog = [
    { id: 'neighborhood', name: 'A', days: [3], fee: 5, offers: { egg: offer(50), salt: offer(50) } },
    { id: 'produce', name: 'B', days: [3], fee: 20, offers: { egg: offer(20) } },
    { id: 'staples', name: 'C', days: [3], fee: 20, offers: { salt: offer(30) } },
  ]
  const needs = { deadline: today, mealCount: 1, requirements: [
    { ingredientId: 'egg', required: 1, shortage: 1, onHand: 0 },
    { ingredientId: 'salt', required: 1, shortage: 1, onHand: 0 },
  ] }
  const save = compareBaskets(needs, id, today, defaultShopping, new Set(), catalog)
  assert.equal(save[0].total, 90)
  assert.equal(save[0].stores.length, 2)
  const quick = compareBaskets(needs, id, today, { ...defaultShopping, mode: 'convenient' }, new Set(), catalog)
  assert.equal(quick[0].total, 105)
  assert.equal(quick[0].stores.length, 1)
  assert.ok(quick.find((quote) => quote.proposal.uncovered.length === 1))
  const higherFees = catalog.map((store) => ({ ...store, fee: store.id === 'neighborhood' ? 5 : 40 }))
  assert.equal(compareBaskets(needs, id, today, defaultShopping, new Set(), higherFees)[0].total, 105)
})

test('purchase confirmation appends one estimated expense with stock and never charges a trip fee twice', () => {
  let budget = recordExpense(open(), { id: 'old-manual', budgetPeriodId: id, amount: 2000, date: today,
    category: 'groceries', priceStatus: 'verified', source: { type: 'manual' } }, today)
  budget = approve(budget, mealPlan, 'list-id', 'neighborhood')
  const plan = kitchenOf(budget).approved
  const total = basketTotal(plan.lines, new Set(), id)
  assert.equal(budget.transactions.length, 1)
  for (const line of plan.lines) budget = confirmPurchase(budget, mealPlan, id, today, plan.id, line.ingredientId)
  const kitchen = kitchenOf(budget)
  assert.equal(kitchen.events.length, plan.lines.length)
  assert.equal(kitchen.events.filter(({ fee }) => fee > 0).length, 1)
  assert.equal(pendingLines(kitchen, id).length, 0)
  assert.equal(budget.transactions.length, 1 + plan.lines.length)
  assert.equal(budget.transactions[0].id, 'old-manual')
  assert.ok(budget.transactions.slice(1).every(({ priceStatus }) => priceStatus === 'estimated'))
  assert.equal(budgetTotals(currentPeriod(budget), budget.transactions).remaining, 500_000 - total - 2000)
  assert.equal(pantryStock(kitchen).egg, 6)
  const refreshed = parseBudget(JSON.stringify(budget)).data
  assert.deepEqual(refreshed, budget)
  assert.equal(confirmPurchase(refreshed, mealPlan, id, today, plan.id, 'egg'), refreshed)
})

test('revised shopping keeps purchases and rejects a stale or removed pending quantity', () => {
  let budget = approve(open(), mealPlan, 'old-list', 'neighborhood')
  budget = confirmPurchase(budget, mealPlan, id, today, 'old-list', 'egg')
  const different = mealsFor([{ ...meal, servings: 1 }])
  assert.throws(() => confirmPurchase(budget, different, id, today, 'old-list', 'baguette'), /thay đổi/)
  const revised = approve(budget, different, 'new-list', 'neighborhood')
  assert.equal(pantryStock(kitchenOf(revised)).egg, 6)
  assert.equal(kitchenOf(revised).events.length, 1)
  assert.ok(!kitchenOf(revised).approved.lines.some(({ ingredientId }) => ingredientId === 'egg'))
  assert.throws(() => confirmPurchase(revised, different, id, today, 'old-list', 'baguette'), /không còn/)
  const after = confirmPurchase(revised, different, id, today, 'new-list', 'baguette')
  assert.equal(kitchenOf(after).events.at(-1).fee, 0)
  assert.equal(after.transactions.length, 2)
  assert.equal(confirmPurchase(after, different, id, today, 'old-list', 'egg'), after)
})

test('simple cooking rejects shortages and deducts saved recipe quantities exactly once', () => {
  assert.throws(() => confirmCooking(open(), mealPlan, id, today, meal), /thiếu nguyên liệu/)
  let budget = open()
  for (const { ingredientId, quantity } of cookingRequirements(meal)) budget = manual(budget, ingredientId, quantity + 1)
  assert.throws(() => confirmCooking(budget, mealPlan, id, today, { ...meal, servings: 1 }), /thay đổi/)
  const cooked = confirmCooking(budget, mealPlan, id, today, meal)
  assert.equal(pantryStock(kitchenOf(cooked)).egg, 1)
  assert.equal(cooked.transactions.length, 0)
  assert.equal(kitchenOf(cooked).events.at(-1).meal.servings, 2)
  assert.throws(() => assertUncooked(kitchenOf(cooked), id, meal), /đã nấu/)
  assert.equal(shoppingNeeds(currentPeriod(cooked), today, [meal], kitchenOf(cooked)).mealCount, 0)
  const refreshed = parseBudget(JSON.stringify(cooked)).data
  assert.equal(confirmCooking(refreshed, mealPlan, id, today, meal), refreshed)
})

test('stock and past records survive rollover; new historical confirmations are blocked', () => {
  const purchased = confirmPurchase(approve(), mealPlan, id, today, 'list-id', 'egg')
  const next = nextPeriod(purchased)
  assert.deepEqual(pantryStock(kitchenOf(next)), pantryStock(kitchenOf(purchased)))
  assert.equal(kitchenOf(next).events[0].periodId, id)
  assert.deepEqual(pendingLines(kitchenOf(next), 'next-period'), [])
  assert.throws(() => confirmPurchase(next, mealPlan, id, today, 'list-id', 'salt'), /kỳ ngân sách đang diễn ra/)
  assert.throws(() => confirmCooking(next, mealPlan, id, today, meal), /kỳ ngân sách đang diễn ra/)
  assert.throws(() => confirmPurchase(purchased, mealPlan, id, '2026-12-01', 'list-id', 'salt'), /kỳ ngân sách đang diễn ra/)
  assert.throws(() => manual(next, 'egg', -7, 'correction'), /từ 0 trở lên/)
  const corrected = manual(next, 'egg', -2, 'correction')
  assert.equal(pantryStock(kitchenOf(corrected)).egg, 4)
  assert.equal(kitchenOf(corrected).events.at(-1).reason, 'Stocktake')
})

test('storage writes are atomic, failed purchases are recoverable, and invalid kitchen data pauses writes', async () => {
  const seed = approve()
  const original = JSON.stringify(seed)
  let stored = original
  let failNext = true
  let writes = 0
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem(key) { assert.equal(key, budgetStorageKey); return stored },
    setItem(key, value) {
      assert.equal(key, budgetStorageKey)
      if (failNext) { failNext = false; throw new Error('quota') }
      stored = value
      writes += 1
    },
  } } })
  const attempt = (data) => confirmPurchase(data, mealPlan, id, today, 'list-id', 'egg')
  try {
    await assert.rejects(updateBudget(attempt), /Chưa lưu được/)
    assert.equal(stored, original)
    assert.equal(readBudget().data.transactions.length, 0)
    assert.equal(pantryStock(kitchenOf(readBudget().data)).egg, undefined)
    await updateBudget(attempt)
    await updateBudget(attempt)
    assert.equal(writes, 1)
    assert.equal(readBudget().data.transactions.length, 1)
    assert.equal(pantryStock(kitchenOf(readBudget().data)).egg, 6)
    const missingEvent = JSON.parse(stored)
    missingEvent.kitchen.events = []
    assert.equal(parseBudget(JSON.stringify(missingEvent)).invalidKitchen, true)
    delete missingEvent.kitchen
    assert.equal(parseBudget(JSON.stringify(missingEvent)).invalidKitchen, true)
    const damaged = JSON.parse(stored)
    damaged.kitchen.events[0].fee += 1
    stored = JSON.stringify(damaged)
    assert.equal(readBudget().invalidKitchen, true)
    assert.equal(readBudget().data.transactions.length, 1)
    await assert.rejects(updateBudget(attempt), /bảo vệ lịch sử/)
    assert.equal(writes, 1)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else delete globalThis.window
  }
})

test('retailer coverage is complete across the illustrative pantry catalog', () => {
  const kitchen = { ...kitchenOf(open()), preferences: { ...defaultShopping, includeFees: false } }
  const budget = withKitchen(open(), kitchen)
  const options = compareBaskets(shoppingNeeds(currentPeriod(budget), today, [meal], kitchen), id, today, kitchen.preferences, new Set())
  assert.equal(retailers.length, 3)
  assert.ok(options[0].stores.every(({ fee }) => fee === 0))
  assert.ok(options[0].proposal.lines.every(({ packPrice }) => packPrice > 0))
})
