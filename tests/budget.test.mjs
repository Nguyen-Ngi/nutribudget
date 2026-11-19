import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  budgetTotals,
  carryOverOffer,
  createPeriod,
  currentPeriod,
  editPeriod,
  isBudgetSettings,
  periodExpenses,
  periodProgress,
  recordExpense,
} from '../src/algorithms/budget.ts'
import { endDate, isCalendarDate, localDate } from '../src/algorithms/calendar.ts'
import { parseBudget } from '../src/data/budgetStorage.ts'

const today = '2026-11-18'
const empty = () => ({ version: 1, periods: [], transactions: [] })
const settings = {
  startingAmount: 500_000,
  duration: 10,
  startDate: today,
  buffer: { percentage: 10 },
}

function create(data = empty(), overrides = {}, options = {}) {
  return createPeriod(data, { ...settings, ...overrides }, {
    id: 'first',
    today,
    previousId: currentPeriod(data)?.id,
    approvedCarryOver: null,
    confirmReplacement: false,
    ...options,
  })
}

function expense(overrides = {}) {
  return {
    id: 'expense',
    budgetPeriodId: 'first',
    amount: 120_000,
    date: today,
    category: 'groceries',
    priceStatus: 'estimated',
    source: { type: 'manual' },
    ...overrides,
  }
}

test('calendar dates are inclusive and independent of daylight-saving boundaries', () => {
  assert.equal(localDate(new Date(2026, 10, 18, 0, 30)), today)
  assert.equal(endDate('2026-03-07', 3), '2026-03-09')
  assert.equal(endDate('2024-02-28', 2), '2024-02-29')
  assert.equal(endDate('2026-12-31', 2), '2027-01-01')
  assert.equal(endDate('9999-12-31', 2), null)
  assert.equal(isCalendarDate('2026-02-29'), false)
  assert.equal(isCalendarDate('0000-01-01'), false)
  assert.equal(endDate(today, 1), today)
})

test('create validates positive whole amounts, durations, dates, and buffer bounds', () => {
  for (const amount of [0, -1, 1.2, NaN, Infinity, '500000', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => create(empty(), { startingAmount: amount }), /Kiểm tra số tiền/)
  }
  for (const duration of [0, -1, 1.2, NaN, 10_000_000]) {
    assert.throws(() => create(empty(), { duration }), /Kiểm tra số tiền/)
  }
  for (const percentage of [-1, 100.01, 10.001, NaN]) {
    assert.equal(isBudgetSettings({ ...settings, buffer: { percentage } }), false)
  }
  assert.equal(isBudgetSettings({ ...settings, buffer: { percentage: 99.99 } }), true)
})

test('zero expenses and a buffer reserve the right amount without lowering actual balance', () => {
  const period = currentPeriod(create())
  assert.deepEqual(budgetTotals(period, []), {
    startingTotal: 500_000, spending: 0, remaining: 500_000, bufferReserve: 50_000,
    planningAvailable: 450_000, spendingPercent: 0, includesEstimates: false, balanceEstimated: false,
  })
  assert.deepEqual(periodProgress(period, today), { end: '2026-11-27', status: 'active', daysRemaining: 10 })
  assert.equal(periodProgress(period, '2026-11-27').daysRemaining, 1)
  assert.equal(periodProgress(period, '2026-11-28').status, 'completed')
  assert.equal(periodProgress(period, '2026-11-17').status, 'upcoming')
})

test('edits preserve linked purchases, update dates, and can remove or re-enable the buffer', () => {
  const original = recordExpense(create(), expense(), today)
  const changed = editPeriod(original, 'first', { ...settings, duration: 14, startDate: '2026-11-17', buffer: null }, today)
  const period = currentPeriod(changed)
  assert.equal(period.id, 'first')
  assert.equal(periodProgress(period, today).end, '2026-11-30')
  assert.equal(periodProgress(period, today).daysRemaining, 13)
  assert.equal(changed.transactions, original.transactions)
  const totals = budgetTotals(period, periodExpenses(changed, period.id))
  assert.equal(totals.spending, 120_000)
  assert.equal(totals.remaining, 380_000)
  assert.equal(totals.planningAvailable, 380_000)
  assert.equal(totals.includesEstimates, true)
  const restored = editPeriod(changed, period.id, { ...settings, buffer: { percentage: 20 } }, today)
  assert.equal(budgetTotals(currentPeriod(restored), restored.transactions).planningAvailable, 280_000)
  assert.throws(() => editPeriod(changed, 'first', { ...settings, startDate: '2026-11-19' }, today), /Khoản mua/)
})

test('verified spending, overspending, and 100% reserve use actual ledger entries', () => {
  const data = create(empty(), { startingAmount: 100, buffer: { percentage: 100 } })
  const withExpense = recordExpense(data, expense({ amount: 160, priceStatus: 'verified' }), today)
  const totals = budgetTotals(currentPeriod(withExpense), withExpense.transactions)
  assert.equal(totals.spendingPercent, 160)
  assert.equal(totals.remaining, -60)
  assert.equal(totals.bufferReserve, 100)
  assert.equal(totals.planningAvailable, 0)
  assert.equal(totals.balanceEstimated, false)
})

test('starting a new period requires confirmation if the old period is still open', () => {
  const original = recordExpense(create(), expense(), today)
  assert.throws(() => create(original, {}, { id: 'next' }), /Xác nhận/)
  const next = create(original, {}, { id: 'next', confirmReplacement: true })
  assert.equal(next.periods.length, 2)
  assert.equal(next.periods[0].status, 'closed')
  assert.deepEqual(next.transactions, original.transactions)
  assert.equal(periodExpenses(next, 'next').length, 0)
  assert.throws(() => recordExpense(next, expense({ id: 'another' }), today), /kỳ ngân sách đang diễn ra/)
  assert.throws(() => create(next, {}, { id: 'retry', previousId: 'first' }), /Kỳ hiện tại đã thay đổi/)
})

test('carry-over is opt-in, uses the final balance including the buffer, and applies once', () => {
  const original = recordExpense(create(empty(), { duration: 1 }), expense(), today)
  const nextDay = '2026-11-19'
  assert.equal(carryOverOffer(original, today), null)
  const offer = carryOverOffer(original, nextDay)
  assert.deepEqual(offer, { fromPeriodId: 'first', amount: 380_000, estimated: true })
  const noCarry = create(original, {}, { id: 'next', today: nextDay })
  assert.equal(currentPeriod(noCarry).carryOver, null)

  const next = create(original, {}, { id: 'next', today: nextDay, approvedCarryOver: offer })
  const period = currentPeriod(next)
  const totals = budgetTotals(period, periodExpenses(next, period.id))
  assert.equal(totals.startingTotal, 880_000)
  assert.equal(totals.bufferReserve, 88_000)
  assert.equal(totals.remaining, 880_000)
  assert.equal(totals.balanceEstimated, true)
  assert.equal(totals.includesEstimates, false)
  assert.throws(() => create(next, {}, { id: 'third', today: '2026-12-01', approvedCarryOver: offer }), /Số dư chuyển kỳ đã thay đổi/)
  assert.deepEqual(parseBudget(JSON.stringify(next)).data, next)
})

test('source reference makes future shopping confirmations idempotent across periods', () => {
  const purchase = expense({ source: { type: 'shopping-purchase', reference: 'purchase-1' } })
  const recorded = recordExpense(create(), purchase, today)
  assert.equal(recordExpense(recorded, { ...purchase, id: 'retry' }, today), recorded)
  assert.throws(() => recordExpense(recorded, { ...purchase, amount: 30_000 }, today), /đã được ghi/)
  const next = create(recorded, {}, { id: 'next', confirmReplacement: true })
  assert.throws(() => recordExpense(next, { ...purchase, id: 'retry', budgetPeriodId: 'next' }, today), /đã được ghi/)
  assert.equal(recordExpense(next, purchase, today), next)
})

test('storage round trips valid data and safely rejects invalid JSON, versions, and links', () => {
  const data = recordExpense(create(), expense(), today)
  assert.deepEqual(parseBudget(null), { data: empty() })
  assert.deepEqual(parseBudget(JSON.stringify(data)), { data })
  for (const invalid of [
    '{broken',
    JSON.stringify({ ...data, version: 2 }),
    JSON.stringify({ ...data, transactions: [expense({ budgetPeriodId: 'missing' })] }),
    JSON.stringify({ ...data, transactions: [expense(), expense()] }),
    JSON.stringify({ ...data, periods: [{ ...currentPeriod(data), duration: 0 }] }),
  ]) {
    const result = parseBudget(invalid)
    assert.deepEqual(result.data, empty())
    assert.match(result.warning, /Không đọc được/)
  }
})
