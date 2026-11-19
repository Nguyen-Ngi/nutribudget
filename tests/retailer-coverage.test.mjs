import assert from 'node:assert/strict'
import { test } from 'node:test'
import { comparableRetailerBaskets, retailerCoverage } from '../src/algorithms/retailerCoverage.ts'
import { formatCalendarDate } from '../src/algorithms/calendar.ts'
import { retailerReferences } from '../src/data/kitchen/retailerResearch.ts'
import { recipes } from '../src/data/meals/recipes.ts'

const [bachHoaXanh, sanHa, kingfoodmart, coopFood, winMart] = retailerReferences
const eggs = { ingredientId: 'egg', required: 8, onHand: 1, shortage: 7 }
const cabbage = { ingredientId: 'cabbage', required: 200, onHand: 0, shortage: 200 }
const eggBasket = { requirements: [eggs], missingMeals: 0 }

test('historical coverage rounds to whole packs and does not invent totals for missing offers', () => {
  const complete = retailerCoverage(kingfoodmart, eggBasket)
  assert.equal(complete.total, 28000)
  assert.equal(complete.lines[0].observation.packQuantity, 10)
  const small = retailerCoverage(kingfoodmart, { ...eggBasket, requirements: [{ ...eggs, shortage: 6 }] })
  assert.equal(small.total, 19500)
  assert.equal(small.lines[0].observation.packQuantity, 6)

  const mixed = { missingMeals: 0, requirements: [eggs, cabbage] }
  for (const retailer of retailerReferences) assert.equal(retailerCoverage(retailer, mixed).total, null)
  const partial = retailerCoverage(bachHoaXanh, mixed)
  assert.deepEqual(partial.missing, [cabbage])
  assert.equal(partial.lines[0].cost, 26000)
  for (const retailer of [sanHa, coopFood]) assert.deepEqual(retailerCoverage(retailer, mixed).missing, [eggs, cabbage])
  assert.equal(retailerCoverage(bachHoaXanh, { ...eggBasket, missingMeals: 1 }).total, null)
  assert.equal(retailerCoverage(bachHoaXanh, { ...eggBasket, requirements: [{ ...eggs, shortage: 0 }] }).total, null)
})

test('only full historical baskets with the same products and package quantities are comparable', () => {
  const first = retailerCoverage(bachHoaXanh, eggBasket)
  assert.equal(comparableRetailerBaskets(first, retailerCoverage(winMart, eggBasket)), false)
  assert.equal(comparableRetailerBaskets(first, retailerCoverage(sanHa, eggBasket)), false)

  const offer = bachHoaXanh.observations[0]
  const sameProduct = (packQuantity) => ({ ...winMart, observations: [{ ...offer, packQuantity, priceVnd: 21000 }] })
  assert.equal(comparableRetailerBaskets(first, retailerCoverage(sameProduct(10), eggBasket)), true)
  assert.equal(comparableRetailerBaskets(first, retailerCoverage(sameProduct(6), eggBasket)), false)
  const otherQuantity = { ...eggBasket, requirements: [{ ...eggs, shortage: 12 }] }
  assert.equal(comparableRetailerBaskets(first, retailerCoverage(sameProduct(10), otherQuantity)), false)
  const partial = retailerCoverage(bachHoaXanh, { ...eggBasket, requirements: [eggs, cabbage] })
  assert.equal(comparableRetailerBaskets(partial, partial), false)
})

test('calendar dates use Vietnamese order and recipe methods are localized', () => {
  assert.equal(formatCalendarDate('2026-11-19'), '19/11/2026')
  assert.ok(recipes.every(({ instructions }) => instructions.length > 0 &&
    instructions.every((step) => /[\u00c0-\u1ef9]/u.test(step))))
})
