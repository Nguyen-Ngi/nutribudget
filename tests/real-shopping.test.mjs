import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPeriod, currentPeriod } from '../src/algorithms/budget.ts'
import { adjustStock, approveRetailerShopping, approveShopping, confirmPurchase, confirmRetailerPurchase, kitchenOf } from '../src/algorithms/kitchen.ts'
import { isRealRetailer, normalizedPack, priceIssue, retailerPlans, shortlistRetailerPlans } from '../src/algorithms/retailerShopping.ts'
import { compareBaskets, pantryStock, pendingLines, shoppingNeeds } from '../src/algorithms/shopping.ts'
import { parseBudget } from '../src/data/budgetStorage.ts'
import { retailerReferences, retailerReviewDate } from '../src/data/kitchen/retailerResearch.ts'
import { retailerName } from '../src/data/kitchen/retailers.ts'

const today = retailerReviewDate
const id = 'real-period'
const empty = { version: 1, periods: [], transactions: [] }
const period = { startDate: today, duration: 90, startingAmount: 500000, buffer: null }
const opened = () => createPeriod(empty, period, { id, today, confirmReplacement: false, approvedCarryOver: null })
const meal = { date: '2026-12-31', active: true, slot: 'lunch', servings: 1, recipeIds: ['rau-muong-xao'] }
const meals = { version: 1, periods: [{ budgetPeriodId: id, slots: [meal] }] }
const noManual = []
const item = (ingredientId, shortage) => ({ ingredientId, required: shortage, shortage, onHand: 0 })
const needs = (...requirements) => ({ requirements, deadline: today, mealCount: 1, missingMeals: 0 })

test('catalog offers map to the pantry unit, and expired, invalid and unavailable prices do not qualify', () => {
  const [bach, , king, , win] = retailerReferences
  for (const store of retailerReferences) {
    assert.ok(isRealRetailer(store.id))
    for (const obs of store.observations) assert.ok(normalizedPack(obs) > 0)
  }
  assert.equal(normalizedPack(bach.observations.find(({ ingredientId }) => ingredientId === 'oil')), 1000)
  const egg = king.observations.find(({ ingredientId }) => ingredientId === 'egg')
  assert.equal(normalizedPack({ ...egg, unit: 'kg' }), null)
  assert.equal(priceIssue(egg, '2026-12-19'), null)
  assert.match(priceIssue(egg, '2026-12-20'), /thời hạn/)
  assert.match(priceIssue({ ...egg, priceVnd: 0 }, today), /Thiếu giá/)
  assert.match(priceIssue({ ...egg, observedOn: 'bad-date' }, today), /Thiếu ngày/)
  assert.match(priceIssue(win.observations.find(({ availability }) => availability), today), /hết hàng/)
  assert.match(priceIssue(bach.observations[0], today), /đã cũ/)
})

test('single and mixed retailer plans compare identical products and packs only', () => {
  const retailer = (id, offers) => ({ id, name: id, url: 'https://example.test/store', observations: offers.map(([ingredientId, priceVnd, packQuantity = 10]) => ({
    ingredientId, priceVnd, packQuantity, unit: ingredientId === 'egg' ? 'each' : 'g',
    productKey: ingredientId, product: ingredientId, observedOn: today, verification: 'product', url: 'https://example.test/product',
  })) })
  const catalog = [retailer('winmart', [['egg', 9000], ['garlic', 1000]]),
    retailer('kingfoodmart', [['egg', 3000], ['garlic', 7000], ['egg', 1000, 6]])]
  const requirement = needs(item('egg', 11), item('garlic', 11))
  const compare = (input = requirement, offers = catalog) => retailerPlans(input, today, noManual, offers)
  const { options, recommended } = shortlistRetailerPlans(compare().quotes)
  assert.ok(options.length <= 3)
  assert.deepEqual(recommended.retailerIds, ['kingfoodmart', 'winmart'])
  assert.deepEqual(recommended.proposal.lines.map(({ packs, packQuantity }) => [packs, packQuantity]), [[2, 10], [2, 10]])
  assert.equal(recommended.total, 8000)
  assert.ok(compare().quotes.some(({ total }) => total === 4000))
  assert.ok(compare().quotes.some(({ retailerIds }) => retailerIds.length === 1))
  assert.ok(compare().quotes.every(({ proposal }) => proposal.lines.every(({ tripFee }) => tripFee === 0)))

  const unmatched = [retailer('winmart', [['egg', 1200, 10]]), retailer('kingfoodmart', [['egg', 800, 6]])]
  assert.equal(shortlistRetailerPlans(compare(needs(item('egg', 4)), unmatched).quotes).recommended, undefined)
  const differentBrand = [retailer('winmart', [['egg', 1200]]), retailer('kingfoodmart', [['egg', 800]])]
  differentBrand[0].observations[0].productKey = 'different-brand'
  assert.equal(shortlistRetailerPlans(compare(needs(item('egg', 4)), differentBrand).quotes).recommended, undefined)
  assert.equal(compare(needs(item('salt', 1))).quotes.length, 0)
  assert.equal(compare({ ...requirement, missingMeals: 1 }).quotes.length, 0)
})

test('provisional plans persist real stores, require an amount for an unknown price, and reconcile once after refresh', () => {
  const data = opened()
  const kitchen = kitchenOf(data)
  const manual = [
    { ingredientId: 'garlic', retailerId: 'san-ha', quantity: 20 },
    { ingredientId: 'salt', retailerId: 'san-ha', quantity: 50 },
  ]
  const requirement = shoppingNeeds(currentPeriod(data), today, [meal], kitchen)
  const options = retailerPlans(requirement, today, manual)
  assert.equal(options.quotes.length, 0)
  assert.ok(options.provisional.uncovered.includes('oil') || options.provisional.uncovered.length === 0)
  const approved = approveRetailerShopping(data, meals, id, today, 'real-list', options.provisional, manual)
  // Plans saved by the previous UI may already have a user-entered fee and item price.
  const legacy = structuredClone(approved)
  for (const line of legacy.kitchen.approved.lines) {
    if (line.retailerId === 'san-ha') line.tripFee = 2000
    if (line.ingredientId === 'salt') {
      line.packPrice = 2500
      line.priceSource = { kind: 'manual' }
    }
  }
  const afterReload = parseBudget(JSON.stringify(legacy))
  assert.equal(afterReload.warning, undefined)
  const garlic = pendingLines(kitchenOf(afterReload.data), id).find(({ ingredientId }) => ingredientId === 'garlic')
  assert.equal(retailerName(garlic.retailerId), 'San Hà Foodstore')
  assert.equal(garlic.priceSource.kind, 'unpriced')
  const buy = (input, ingredientId, amount) => confirmRetailerPurchase(input, meals, id, today, 'real-list', ingredientId, amount)
  assert.throws(() => buy(afterReload.data, 'garlic'), /Nhập số tiền/)
  assert.throws(() => buy(afterReload.data, 'garlic', 0), /Nhập số tiền/)
  const bought = buy(afterReload.data, 'garlic', 5000)
  const boughtAgain = parseBudget(JSON.stringify(bought)).data
  assert.equal(buy(boughtAgain, 'garlic', 6000), boughtAgain)
  const both = buy(boughtAgain, 'salt')
  assert.deepEqual(both.transactions.map(({ amount, priceStatus }) => [amount, priceStatus]), [[7000, 'estimated'], [2500, 'estimated']])
  assert.equal(pantryStock(kitchenOf(both)).garlic, 20)
  assert.equal(kitchenOf(both).events[0].line.priceSource.kind, 'manual')
  assert.equal(parseBudget(JSON.stringify(both)).warning, undefined)
})

test('a legacy plan cannot enter the real checkout and old purchases retain names and amounts', () => {
  const data = opened()
  const kitchen = kitchenOf(data)
  const quote = compareBaskets(shoppingNeeds(currentPeriod(data), today, [meal], kitchen), id, today, kitchen.preferences, new Set())[0]
  const old = approveShopping(data, meals, id, today, 'old-list', quote.proposal)
  assert.throws(() => approveRetailerShopping(data, meals, id, today, 'invalid', quote.proposal, noManual), /đã thay đổi/)
  const line = quote.proposal.lines[0]
  assert.throws(() => confirmRetailerPurchase(old, meals, id, today, 'old-list', line.ingredientId), /phương án mua mới/)
  const bought = confirmPurchase(old, meals, id, today, 'old-list', line.ingredientId)
  const restored = parseBudget(JSON.stringify(bought))
  assert.equal(restored.warning, undefined)
  assert.deepEqual(restored.data, bought)
  assert.equal(restored.data.kitchen.events[0].line.retailerId, line.retailerId)
  assert.equal(restored.data.kitchen.events[0].line.priceSource, undefined)
})

test('expired approved observations require a fresh amount and closed periods cannot record a purchase', () => {
  const data = opened()
  const cooking = { ...meal, recipeIds: ['com-gao-lut'] }
  const planned = { ...meals, periods: [{ budgetPeriodId: id, slots: [cooking] }] }
  const kitchen = kitchenOf(data)
  const requirement = shoppingNeeds(currentPeriod(data), today, [cooking], kitchen)
  const quote = retailerPlans(requirement, today).quotes[0]
  const approved = approveRetailerShopping(data, planned, id, today, 'dated', quote.proposal, noManual)
  const later = '2026-12-20'
  assert.throws(() => confirmRetailerPurchase(approved, planned, id, later, 'dated', 'brown-rice'), /Nhập số tiền/)
  const purchased = confirmRetailerPurchase(approved, planned, id, later, 'dated', 'brown-rice', 54500)
  assert.equal(purchased.transactions[0].amount, 54500)
  assert.equal(kitchenOf(purchased).events[0].line.priceSource.kind, 'manual')
  const next = createPeriod(approved, period, { id: 'next', previousId: id, today, confirmReplacement: true, approvedCarryOver: null })
  assert.throws(() => confirmRetailerPurchase(next, planned, id, later, 'dated', 'brown-rice', 54500), /kỳ ngân sách đang diễn ra/)
})
