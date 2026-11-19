import { budgetTotals, periodProgress } from '../../algorithms/budget'
import type { BudgetPeriod, ExpenseTransaction } from '../../types/budget'
import { formatPeriod, formatVnd } from './format'

export function PeriodTiming({ period, today }: { period: BudgetPeriod; today: string }) {
  const { end, daysRemaining, status } = periodProgress(period, today)
  const timing = status === 'completed' ? 'Đã hết kỳ' : status === 'upcoming' ?
    `Sắp bắt đầu · ${daysRemaining} ngày` :
    `Còn ${daysRemaining} ngày`

  return (
    <p className="period-timing">
      <span>{formatPeriod(period.startDate, end)}</span>
      <strong>{timing}</strong>
    </p>
  )
}

export function BudgetSummary({ period, expenses }: {
  period: BudgetPeriod
  expenses: ExpenseTransaction[]
}) {
  const totals = budgetTotals(period, expenses)
  return (
    <section className="balance-block simple-balance" aria-label="Số dư ngân sách">
      <h2>{totals.balanceEstimated ? 'Còn lại · Ước tính' : 'Còn lại'}</h2>
      <strong className={totals.remaining < 0 ? 'balance-amount negative' : 'balance-amount'}>{formatVnd(totals.remaining)}</strong>
    </section>
  )
}
