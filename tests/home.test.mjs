import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHome } from '../src/algorithms/home.ts'
import { adjustStock, confirmCooking, cookingRequirements } from '../src/algorithms/kitchen.ts'

const today = '2026-11-18'
const tomorrow = '2026-11-19'
const period = { id: 'p & 1', startDate: today, duration: 2, startingAmount: 500000, buffer: { percentage: 10 }, status: 'open', carryOver: null }
const data = { version: 1, periods: [period], transactions: [] }
const breakfast = { date: tomorrow, slot: 'breakfast', active: true, servings: 2, recipeIds: ['banh-mi-trung'] }
const meals = (...slots) => ({ version: 1, periods: [{ budgetPeriodId: period.id, slots }] })

function stocked() {
  return cookingRequirements(breakfast).reduce((budget, { ingredientId, quantity }) => adjustStock(budget, {
    kind: 'addition', id: ingredientId, date: today, ingredientId, quantity, reason: 'Test stock',
  }), data)
}

test('Home distinguishes setup, planning, and expired periods', () => {
  assert.equal(resolveHome({ ...data, periods: [] }, meals(), today).kind, 'setup')
  const plan = resolveHome(data, meals(), today)
  assert.equal(plan.kind, 'plan')
  assert.equal(plan.budget.totals.planningAvailable, 450000)
  assert.equal(plan.budget.selectedDishes, 0)
  assert.equal(plan.budget.hasShoppingPlan, false)
  assert.equal(resolveHome(data, meals(breakfast), '2026-11-20').kind, 'expired')
})

test('Home routes a shortage to shopping and preserves the next meal date and servings', () => {
  const next = resolveHome(data, meals({ ...breakfast, date: today, active: false }, breakfast), today)
  assert.equal(next.kind, 'shop')
  assert.deepEqual(next.meal, breakfast)
  assert.equal(next.shortages.find(({ ingredientId }) => ingredientId === 'egg').quantity, 4)
})

test('Home skips shopping when stock is sufficient and deep-links to the exact slot', () => {
  const next = resolveHome(stocked(), meals(breakfast), today)
  assert.equal(next.kind, 'cook')
  assert.deepEqual(Object.fromEntries(new URLSearchParams(next.href.split('?')[1])), {
    period: period.id, date: tomorrow, slot: 'breakfast',
  })
  const upcoming = { ...stocked(), periods: [{ ...period, startDate: tomorrow }] }
  assert.equal(resolveHome(upcoming, meals(breakfast), today).kind, 'scheduled')
})

test('Home ignores cooked selections and offers another meal when there is nothing else upcoming', () => {
  const cooked = confirmCooking(stocked(), meals(breakfast), period.id, today, breakfast)
  const next = resolveHome(cooked, meals(breakfast), today)
  assert.equal(next.kind, 'cooked')
  const alternative = { date: tomorrow, slot: 'lunch', active: true, servings: 1, recipeIds: ['com-trang', 'trung-chien', 'canh-bi-do'] }
  assert.equal(resolveHome(cooked, meals(alternative, breakfast), today).meal.slot, 'lunch')
})

test('Home surfaces unavailable recipes for review and ignores off-period meals', () => {
  assert.equal(resolveHome(data, meals({ ...breakfast, recipeIds: ['retired'] }), today).kind, 'review')
  assert.equal(resolveHome(data, meals({ ...breakfast, date: '2026-11-20' }), today).kind, 'plan')
})

test('Home counts selected dishes in upcoming active meals and scopes approved shopping to the open budget', () => {
  const lunch = { ...breakfast, slot: 'lunch', recipeIds: ['com-trang', 'rau-muong-luoc'] }
  const planned = meals(breakfast, lunch, { ...breakfast, active: false, slot: 'dinner' })
  const approved = { periodId: period.id, lines: [{ ingredientId: 'egg' }] }
  const withPlan = { ...data, kitchen: { events: [], approved } }
  assert.equal(resolveHome(withPlan, planned, today).budget.selectedDishes, 3)
  assert.equal(resolveHome(withPlan, planned, today).budget.hasShoppingPlan, true)
  assert.equal(resolveHome({ ...withPlan, kitchen: { ...withPlan.kitchen, approved: { ...approved, periodId: 'old-period' } } },
    planned, today).budget.hasShoppingPlan, false)
})
