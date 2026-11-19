import { isBufferPercentage, isPositiveInteger, transactionSourceKey } from '../algorithms/budget.ts'
import { endDate, isCalendarDate } from '../algorithms/calendar.ts'
import { isKitchen } from './kitchen/kitchenValidation.ts'
import type { BudgetData, BudgetPeriod, ExpenseTransaction } from '../types/budget.ts'

export const budgetStorageKey = 'nutribudget:budget'
export function budgetId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const emptyBudget: BudgetData = { version: 1, periods: [], transactions: [] }

export interface BudgetSnapshot {
  data: BudgetData
  warning?: string
  invalidKitchen?: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPeriod(value: unknown): value is BudgetPeriod {
  if (!isObject(value) || !isText(value.id) || !isPositiveInteger(value.startingAmount) ||
      !isPositiveInteger(value.duration) || !isText(value.startDate) || !endDate(value.startDate, value.duration)) return false

  if (value.status === 'closed') {
    if (typeof value.closedOn !== 'string' || !isCalendarDate(value.closedOn)) return false
  } else if (value.status !== 'open' || value.closedOn !== undefined) {
    return false
  }

  if (value.buffer !== null &&
      (!isObject(value.buffer) || !isBufferPercentage(value.buffer.percentage))) return false

  return value.carryOver === null || (
    isObject(value.carryOver) && isText(value.carryOver.fromPeriodId) &&
    isPositiveInteger(value.carryOver.amount) && typeof value.carryOver.estimated === 'boolean' &&
    Number.isSafeInteger(value.startingAmount + value.carryOver.amount)
  )
}

function isTransaction(value: unknown): value is ExpenseTransaction {
  if (!isObject(value) || !isText(value.id) || !isText(value.budgetPeriodId) ||
      !isPositiveInteger(value.amount) || typeof value.date !== 'string' || !isCalendarDate(value.date) ||
      value.category !== 'groceries' || (value.priceStatus !== 'estimated' && value.priceStatus !== 'verified') ||
      !isObject(value.source)) return false

  const { type, reference } = value.source
  return type === 'manual' ? reference === undefined || isText(reference) :
    type === 'shopping-purchase' && isText(reference)
}

function isBudgetData(value: unknown): value is BudgetData {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.periods) ||
      !Array.isArray(value.transactions) || !value.periods.every(isPeriod) ||
      !value.transactions.every(isTransaction)) return false

  const periods = new Map<string, BudgetPeriod>()
  const carriedFrom = new Set<string>()
  for (const [index, period] of value.periods.entries()) {
    if (periods.has(period.id) || (period.status === 'open' && index !== value.periods.length - 1)) return false
    if (period.carryOver) {
      const source = periods.get(period.carryOver.fromPeriodId)
      if (source?.status !== 'closed' || carriedFrom.has(source.id)) return false
      carriedFrom.add(source.id)
    }
    periods.set(period.id, period)
  }

  const transactionIds = new Set<string>()
  const sources = new Set<string>()
  const spending = new Map<string, number>()
  const estimatedPeriods = new Set<string>()
  for (const transaction of value.transactions) {
    const period = periods.get(transaction.budgetPeriodId)
    const source = transactionSourceKey(transaction)
    const periodSpending = (spending.get(transaction.budgetPeriodId) ?? 0) + transaction.amount
    if (!period || transactionIds.has(transaction.id) || (source && sources.has(source)) ||
        transaction.date < period.startDate || transaction.date > endDate(period.startDate, period.duration)! ||
        !Number.isSafeInteger(periodSpending)) return false

    transactionIds.add(transaction.id)
    if (source) sources.add(source)
    spending.set(period.id, periodSpending)
    if (transaction.priceStatus === 'estimated') estimatedPeriods.add(period.id)
  }

  return value.periods.every((period) => {
    if (!period.carryOver) return true
    const source = periods.get(period.carryOver.fromPeriodId)!
    const sourceBalance = source.startingAmount + (source.carryOver?.amount ?? 0) - (spending.get(source.id) ?? 0)
    const estimated = estimatedPeriods.has(source.id) || source.carryOver?.estimated === true
    return period.carryOver.amount === sourceBalance && period.carryOver.estimated === estimated
  })
}

export function parseBudget(raw: string | null): BudgetSnapshot {
  if (raw === null) return { data: emptyBudget }

  try {
    const value: unknown = JSON.parse(raw)
    if (isBudgetData(value)) {
      const hasKitchenExpenses = value.transactions.some((expense) =>
        expense.source.type === 'shopping-purchase' && expense.id === 'shopping:' + expense.source.reference)
      if (value.kitchen === undefined ? hasKitchenExpenses : !isKitchen(value.kitchen, value)) {
        return {
          data: { version: 1, periods: value.periods, transactions: value.transactions },
          warning: 'Không đọc được tủ thực phẩm hoặc giỏ hàng đã lưu. Tạm dừng lưu để bảo vệ lịch sử.',
          invalidKitchen: true,
        }
      }
      return { data: value }
    }
  } catch {
    // Invalid JSON falls through to the same recovery state as an invalid schema.
  }

  return {
    data: emptyBudget,
    warning: 'Không đọc được ngân sách đã lưu. Tạm dừng lưu thay đổi để bảo vệ lịch sử.',
  }
}

export function readBudget(): BudgetSnapshot {
  try {
    return parseBudget(window.localStorage.getItem(budgetStorageKey))
  } catch {
    return { data: emptyBudget, warning: 'Không dùng được bộ nhớ trình duyệt. Chưa thể lưu ngân sách.' }
  }
}

export async function updateBudget(update: (data: BudgetData) => BudgetData): Promise<BudgetSnapshot> {
  function save() {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(budgetStorageKey)
    } catch {
      throw new Error('Không dùng được bộ nhớ trình duyệt. Kiểm tra cài đặt rồi thử lại.')
    }

    const snapshot = parseBudget(raw)
    if (snapshot.warning) throw new Error(snapshot.warning)
    const previous = snapshot.data
    const data = update(previous)
    if (data.kitchen && !isKitchen(data.kitchen, data)) throw new Error('Thay đổi không khớp với các khoản chi đã lưu.')
    try {
      if (data !== previous) window.localStorage.setItem(budgetStorageKey, JSON.stringify(data))
    } catch {
      throw new Error('Chưa lưu được thay đổi. Kiểm tra dung lượng trống của trình duyệt rồi thử lại.')
    }
    return { data }
  }

  return navigator.locks ? navigator.locks.request(budgetStorageKey, async () => save()) : save()
}
