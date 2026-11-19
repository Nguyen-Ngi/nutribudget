import type { PlannedSlot } from '../types/meals.ts'
import { dayDifference, endDate, formatCalendarDate, isCalendarDate } from './calendar.ts'
import type { BudgetData, BudgetPeriod, BudgetSettings, CarryOver, ExpenseTransaction } from '../types/budget.ts'

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function isBufferPercentage(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 100 &&
    Number((Math.round(value * 100) / 100).toFixed(2)) === value
}

export function isBudgetSettings(settings: BudgetSettings) {
  return isPositiveInteger(settings.startingAmount) &&
    endDate(settings.startDate, settings.duration) !== null &&
    (settings.buffer === null || isBufferPercentage(settings.buffer.percentage))
}

export function currentPeriod(data: BudgetData) {
  return data.periods.at(-1)
}

export function periodProgress(period: BudgetPeriod, today: string) {
  const end = endDate(period.startDate, period.duration)!
  if (period.status === 'closed' || today > end) {
    return { end, status: 'completed', daysRemaining: 0 } as const
  }
  if (today < period.startDate) {
    return { end, status: 'upcoming', daysRemaining: period.duration } as const
  }
  return { end, status: 'active', daysRemaining: dayDifference(today, end) + 1 } as const
}

export function periodExpenses(data: BudgetData, periodId: string) {
  return data.transactions.filter((transaction) => transaction.budgetPeriodId === periodId)
}

export function budgetTotals(period: BudgetPeriod, expenses: readonly ExpenseTransaction[]) {
  const startingTotal = period.startingAmount + (period.carryOver?.amount ?? 0)
  const basisPoints = Math.round((period.buffer?.percentage ?? 0) * 100)
  const bufferReserve = Number((BigInt(startingTotal) * BigInt(basisPoints) + 5_000n) / 10_000n)
  const spending = expenses.reduce((total, expense) => total + expense.amount, 0)
  const remaining = startingTotal - spending

  const includesEstimates = expenses.some((expense) => expense.priceStatus === 'estimated')

  return {
    startingTotal,
    bufferReserve,
    spending,
    remaining,
    planningAvailable: Math.max(0, Math.max(0, remaining) - bufferReserve),
    spendingPercent: spending / startingTotal * 100,
    includesEstimates,
    balanceEstimated: includesEstimates || period.carryOver?.estimated === true,
  }
}

export function carryOverOffer(data: BudgetData, today: string): CarryOver | null {
  const previous = currentPeriod(data)
  if (!previous || periodProgress(previous, today).status !== 'completed') return null
  if (data.periods.some((period) => period.carryOver?.fromPeriodId === previous.id)) return null

  const totals = budgetTotals(previous, periodExpenses(data, previous.id))
  if (totals.remaining <= 0) return null

  return {
    fromPeriodId: previous.id,
    amount: totals.remaining,
    estimated: totals.balanceEstimated,
  }
}

export function createPeriod(
  data: BudgetData,
  settings: BudgetSettings,
  options: {
    id: string
    today: string
    previousId?: string
    confirmReplacement: boolean
    approvedCarryOver: CarryOver | null
  },
): BudgetData {
  if (!isBudgetSettings(settings)) throw new Error('Kiểm tra số tiền, thời gian và khoản dự phòng.')
  if (!options.id.trim()) throw new Error('Không xác định được mã kỳ ngân sách.')
  if (data.periods.some(({ id }) => id === options.id)) throw new Error('Kỳ ngân sách này đã tồn tại.')

  const previous = currentPeriod(data)
  if (previous?.id !== options.previousId) {
    throw new Error('Kỳ hiện tại đã thay đổi. Mở lại phần thiết lập để kiểm tra.')
  }
  const replacingOpenPeriod = previous && periodProgress(previous, options.today).status !== 'completed'
  if (replacingOpenPeriod && !options.confirmReplacement) {
    throw new Error('Xác nhận đóng kỳ hiện tại.')
  }

  const approved = options.approvedCarryOver
  if (approved) {
    const offer = carryOverOffer(data, options.today)
    if (offer?.fromPeriodId !== approved.fromPeriodId || offer.amount !== approved.amount ||
        offer.estimated !== approved.estimated) {
      throw new Error('Số dư chuyển kỳ đã thay đổi. Mở lại phần thiết lập để kiểm tra.')
    }
    if (!Number.isSafeInteger(settings.startingAmount + approved.amount)) {
      throw new Error('Nhập ngân sách nhỏ hơn để tổng cộng với số dư chuyển kỳ nằm trong giới hạn.')
    }
  }

  const period: BudgetPeriod = {
    ...settings,
    id: options.id,
    status: 'open',
    carryOver: approved,
  }
  if (!previous) return { ...data, periods: [period] }

  const archived: BudgetPeriod = { ...previous, status: 'closed', closedOn: options.today }
  return { ...data, periods: [...data.periods.slice(0, -1), archived, period] }
}

export function editPeriod(
  data: BudgetData, periodId: string, settings: BudgetSettings, today: string,
  linkedMeals: readonly PlannedSlot[] = [],
): BudgetData {
  const period = currentPeriod(data)
  if (!period || period.id !== periodId || periodProgress(period, today).status === 'completed') {
    throw new Error('Kỳ này đã đóng. Hãy mở kỳ ngân sách mới.')
  }
  if (!isBudgetSettings(settings)) throw new Error('Kiểm tra số tiền, thời gian và khoản dự phòng.')
  if (!Number.isSafeInteger(settings.startingAmount + (period.carryOver?.amount ?? 0))) {
    throw new Error('Nhập ngân sách nhỏ hơn để tổng cộng với số dư chuyển kỳ nằm trong giới hạn.')
  }
  const end = endDate(settings.startDate, settings.duration)!
  const excluded = periodExpenses(data, periodId).find(({ date }) => date < settings.startDate || date > end)
  if (excluded) throw new Error(`Khoản mua ngày ${formatCalendarDate(excluded.date)} phải nằm trong kỳ.`)

  const oldEnd = endDate(period.startDate, period.duration)!
  const newlyExcluded = (date: string) =>
    date >= period.startDate && date <= oldEnd && (date < settings.startDate || date > end)
  const cooking = data.kitchen?.events.find((event) =>
    event.kind === 'cooking' && event.periodId === periodId &&
    (newlyExcluded(event.meal.date) || newlyExcluded(event.date)))
  if (cooking?.kind === 'cooking') {
    const date = newlyExcluded(cooking.meal.date) ? cooking.meal.date : cooking.date
    throw new Error(`Bản ghi nấu ăn ngày ${formatCalendarDate(date)} phải nằm trong kỳ.`)
  }
  const meal = linkedMeals.find((slot) => slot.recipeIds.length > 0 && newlyExcluded(slot.date))
  if (meal) throw new Error(`Bữa đã lưu ngày ${formatCalendarDate(meal.date)} phải nằm trong kỳ. Bạn có thể xóa bữa này trước khi đổi ngày.`)

  return { ...data, periods: [...data.periods.slice(0, -1), { ...period, ...settings }] }
}

export function transactionSourceKey(transaction: ExpenseTransaction) {
  const { source } = transaction
  return source.reference ? JSON.stringify([source.type, source.reference]) : null
}

// A future purchase confirmation can use the same source reference for its expense and
// inventory events and commit both in one update. A repeated confirmation is a no-op.
export function recordExpense(data: BudgetData, expense: ExpenseTransaction, today: string): BudgetData {
  const sourceKey = transactionSourceKey(expense)
  const existing = data.transactions.find((transaction) =>
    transaction.id === expense.id || (sourceKey !== null && transactionSourceKey(transaction) === sourceKey),
  )
  if (existing) {
    if (
      existing.budgetPeriodId === expense.budgetPeriodId && existing.amount === expense.amount &&
      existing.date === expense.date && existing.category === expense.category &&
      existing.priceStatus === expense.priceStatus && existing.source.type === expense.source.type &&
      transactionSourceKey(existing) === sourceKey
    ) return data
    throw new Error('Khoản mua này đã được ghi với thông tin khác.')
  }

  const period = currentPeriod(data)
  if (!period || period.id !== expense.budgetPeriodId || periodProgress(period, today).status !== 'active') {
    throw new Error('Chỉ ghi được khoản chi khi kỳ ngân sách đang diễn ra.')
  }
  if (!expense.id.trim() || !isPositiveInteger(expense.amount) || expense.category !== 'groceries' ||
      !['estimated', 'verified'].includes(expense.priceStatus) ||
      (expense.source.type !== 'manual' && expense.source.type !== 'shopping-purchase') ||
      (expense.source.type === 'shopping-purchase' && !expense.source.reference.trim()) ||
      (expense.source.reference !== undefined && !expense.source.reference.trim())) {
    throw new Error('Nhập khoản chi mua nguyên liệu hợp lệ.')
  }
  if (!isCalendarDate(expense.date) || expense.date < period.startDate || expense.date > today) {
    throw new Error('Chọn ngày mua trong kỳ và không muộn hơn hôm nay.')
  }
  const { spending } = budgetTotals(period, periodExpenses(data, period.id))
  if (!Number.isSafeInteger(spending + expense.amount)) throw new Error('Nhập số tiền mua nhỏ hơn.')

  return { ...data, transactions: [...data.transactions, expense] }
}
