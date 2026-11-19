import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPeriod, currentPeriod } from '../src/algorithms/budget.ts'
import { adjustStock, approveRetailerShopping, confirmRetailerPurchase, kitchenOf } from '../src/algorithms/kitchen.ts'
import { retailerPlans, shortlistRetailerPlans } from '../src/algorithms/retailerShopping.ts'
import { distanceKm, locateBasket, shoppingArea } from '../src/algorithms/shoppingLocation.ts'
import { pantryStock, pendingLines, shoppingNeeds } from '../src/algorithms/shopping.ts'
import { parseBudget } from '../src/data/budgetStorage.ts'
import { parsePriceSnapshot } from '../src/data/kitchen/priceSnapshot.ts'
import { retailerBranches } from '../src/data/kitchen/retailerLocations.ts'
import { retailerReferences, retailerReviewDate } from '../src/data/kitchen/retailerResearch.ts'
import snapshot from '../src/data/kitchen/retailer-snapshot.json' with { type: 'json' }

const today = retailerReviewDate

test('the imported snapshot has official source URLs, compatible package units and valid review timestamps', () => {
  assert.deepEqual(parsePriceSnapshot(snapshot), snapshot)
  assert.ok(snapshot.observations.some(({ reviewedAt }) => reviewedAt))
  const row = snapshot.observations.find(({ reviewedAt }) => reviewedAt)
  for (const patch of [
    { reviewedAt: '2026-02-31T07:00:00Z' },
    { url: 'https://kingfoodmart.com.example.org/product' },
    { priceUrl: 'https://example.org/price' },
    { priceVnd: 0 },
    { unit: 'ml' },
  ]) {
    assert.throws(() => parsePriceSnapshot({ version: 1, observations: [{ ...row, ...patch }] }), /không hợp lệ/)
  }
  assert.throws(() => parsePriceSnapshot({ version: 1, observations: [row, row] }), /không hợp lệ/)
  assert.throws(() => parsePriceSnapshot({ version: 2, observations: [row] }), /phiên bản 1/)
})

test('a genuine like-for-like basket uses the same amount of Simply oil at each real retailer', () => {
  const oil = retailerReferences.flatMap(({ observations }) => observations)
    .filter(({ productKey }) => productKey === 'simply-soybean-oil-1l')
  assert.equal(oil.length, 2)
  const date = oil.map(({ observedOn }) => observedOn).sort().at(-1)
  const needs = { requirements: [{ ingredientId: 'oil', required: 1100, shortage: 1001, onHand: 99 }],
    mealCount: 2, missingMeals: 0, deadline: date }
  const { quotes } = retailerPlans(needs, date)
  assert.ok(quotes.every(({ proposal }) => proposal.lines[0].packs * proposal.lines[0].packQuantity >= 1001))
  const samePacks = quotes.filter(({ proposal }) => proposal.lines[0].priceSource.productKey === 'simply-soybean-oil-1l')
  assert.equal(samePacks.length, 2)
  assert.ok(samePacks.every(({ proposal }) => proposal.lines[0].packs === 2 && proposal.lines[0].packQuantity === 1000))
  assert.equal(shortlistRetailerPlans(samePacks).comparable, true)
})

test('only a real price-distance tradeoff produces three distinct ranking roles', () => {
  const origin = { latitude: 10.79, longitude: 106.72 }
  const stores = ['kingfoodmart', 'winmart', 'san-ha', 'coop-food']
  const prices = [20000, 27000, 24000, 29000]
  const branches = stores.map((retailerId, index) => ({ ...origin, latitude: origin.latitude + [.05, .005, .027, .045][index],
    id: retailerId, retailerId, name: retailerId, address: '', source: '', reviewedOn: today }))
  const quotes = stores.map((retailerId, index) => ({ total: prices[index], retailerIds: [retailerId],
    proposal: { uncovered: [], lines: [{ ingredientId: 'egg', retailerId, packs: 1, packQuantity: 10,
      priceSource: { kind: 'observed', productKey: 'same-sku' } }] } }))
  const ranked = shortlistRetailerPlans(quotes, origin, branches)
  assert.deepEqual(ranked.options.map(({ retailerIds }) => retailerIds[0]), stores.slice(0, 3))
  assert.equal(ranked.recommended.total, 20000)
  assert.equal(ranked.convenient.total, 27000)
  assert.ok(ranked.convenient.km < ranked.balanced.km)
  assert.equal(ranked.balanced.total, 24000)
  const incomplete = shortlistRetailerPlans(quotes, origin, branches.slice(0, 2))
  assert.equal(incomplete.comparableLocations, false)
  assert.equal(incomplete.convenient, undefined)
  assert.equal(incomplete.balanced, undefined)
  assert.equal(incomplete.recommended.total, 20000)
  assert.equal(shortlistRetailerPlans(quotes).options.length, 1)
})

test('verified branches supply the nearest known store, and incomplete stops never get a total distance', () => {
  const origin = shoppingArea('king-green-view')
  const close = locateBasket(['kingfoodmart'], origin)
  assert.equal(close.branches[0].id, 'king-green-view')
  assert.equal(close.km, 0)
  const boulevard = retailerBranches.find(({ id }) => id === 'king-q7-boulevard')
  assert.ok(distanceKm(origin, boulevard) > 1)
  assert.equal(locateBasket(['kingfoodmart', 'san-ha'], origin).km, undefined)
  assert.equal(locateBasket(['kingfoodmart', 'san-ha'], origin).branches.length, 1)
})

test('editing meals rebuilds only remaining needs and leaves checked purchases intact after reload', () => {
  const id = 'shopping-workflow'
  const seed = { version: 1, periods: [], transactions: [] }
  const base = createPeriod(seed, { startDate: today, duration: 7, startingAmount: 500000, buffer: null }, {
    id, today, confirmReplacement: false, approvedCarryOver: null,
  })
  const slot = (recipeIds) => ({ date: today, active: true, slot: 'lunch', servings: 1, recipeIds })
  const mealData = (slot) => ({ version: 1, periods: [{ budgetPeriodId: id, slots: [slot] }] })
  const rice = slot(['com-gao-lut'])
  const requirements = (budget, meal) => shoppingNeeds(currentPeriod(budget), today, [meal], kitchenOf(budget))
  const first = retailerPlans(requirements(base, rice), today).quotes[0].proposal
  const chosen = approveRetailerShopping(base, mealData(rice), id, today, 'first', first, [], 'king-green-view')
  assert.equal(chosen.transactions.length, 0)
  const checked = confirmRetailerPurchase(chosen, mealData(rice), id, today, 'first', 'brown-rice')
  const persisted = parseBudget(JSON.stringify(checked))
  assert.equal(persisted.warning, undefined)
  assert.equal(persisted.data.kitchen.approved.branches[0].id, 'king-green-view')
  assert.equal(confirmRetailerPurchase(persisted.data, mealData(rice), id, today, 'first', 'brown-rice'), persisted.data)

  const next = slot(['com-gao-lut', 'rau-muong-xao'])
  const withAromatics = ['garlic', 'salt'].reduce((data, ingredientId) => adjustStock(data, {
    kind: 'addition', id: ingredientId, date: today, ingredientId, quantity: 100, reason: 'Có sẵn',
  }), persisted.data)
  const updated = requirements(withAromatics, next)
  assert.notEqual(updated.mealSignature, persisted.data.kitchen.approved.mealSignature)
  assert.equal(updated.requirements.find(({ ingredientId }) => ingredientId === 'brown-rice').shortage, 0)
  const revised = retailerPlans(updated, today).quotes[0].proposal
  const approved = approveRetailerShopping(withAromatics, mealData(next), id, today, 'revised', revised, [])
  assert.equal(pendingLines(kitchenOf(approved), id).some(({ ingredientId }) => ingredientId === 'brown-rice'), false)
  assert.equal(pantryStock(kitchenOf(approved))['brown-rice'], 1000)
  assert.deepEqual(approved.transactions, checked.transactions)
  assert.deepEqual(approved.kitchen.events.filter(({ kind }) => kind === 'purchase'), checked.kitchen.events)
})

test('Cơm đậu xanh with an empty pantry yields a complete sourced two-retailer basket, while an uncovered item cannot be approved', () => {
  const id = 'shopping-real-mixed'
  const input = { version: 1, periods: [], transactions: [] }
  const data = createPeriod(input, { startDate: today, duration: 7, startingAmount: 500000, buffer: null }, {
    id, today, confirmReplacement: false, approvedCarryOver: null,
  })
  const meal = { date: today, active: true, slot: 'lunch', servings: 1, recipeIds: ['com-dau-xanh'] }
  const schedule = (slot) => ({ version: 1, periods: [{ budgetPeriodId: id, slots: [slot] }] })
  const needs = (slot) => shoppingNeeds(currentPeriod(data), today, [slot], kitchenOf(data))
  const quote = shortlistRetailerPlans(retailerPlans(needs(meal), today).quotes).options[0]
  assert.deepEqual(new Set(quote.retailerIds), new Set(['kingfoodmart', 'winmart']))
  assert.deepEqual(quote.proposal.uncovered, [])
  assert.equal(quote.total, quote.proposal.lines.reduce((sum, line) => sum + line.packPrice * line.packs, 0))
  assert.equal(approveRetailerShopping(data, schedule(meal), id, today, 'mixed', quote.proposal, []).kitchen.approved.lines.length, 3)
  const partial = { ...meal, recipeIds: ['com-dau-xanh', 'bun-rieu'] }
  const result = retailerPlans(needs(partial), today)
  assert.equal(result.quotes.length, 0)
  assert.ok(result.provisional.uncovered.length)
  assert.throws(() => approveRetailerShopping(data, schedule(partial), id, today, 'partial', result.provisional, []), /đã thay đổi/)
})
