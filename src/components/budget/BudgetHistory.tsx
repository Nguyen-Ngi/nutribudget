import { budgetTotals, currentPeriod, periodExpenses, periodProgress } from '../../algorithms/budget'
import type { BudgetData } from '../../types/budget'
import { ExpenseList } from './ExpenseList'
import { formatDate, formatPeriod, formatVnd } from './format'

export function BudgetHistory({ data, today }: { data: BudgetData; today: string }) {
  const current = currentPeriod(data)
  const history = data.periods.filter((period) => period.id !== current?.id).reverse()
  if (!history.length) return null

  return (
    <section className="budget-section" aria-labelledby="history-heading">
      <h2 id="history-heading">Các kỳ trước</h2>
      <div className="panel period-history">
        {history.map((period) => {
          const expenses = periodExpenses(data, period.id)
          const totals = budgetTotals(period, expenses)
          const { end } = periodProgress(period, today)
          const carriedTo = data.periods.find(({ carryOver }) => carryOver?.fromPeriodId === period.id)
          return (
            <details key={period.id}>
              <summary>
                <strong>{formatPeriod(period.startDate, end)}</strong>{' '}
                <span>{totals.balanceEstimated ? 'Số dư ước tính' : 'Số dư cuối kỳ'} · {formatVnd(totals.remaining)}</span>
              </summary>
              <div className="history-body">
                <dl className="history-totals">
                  <div><dt>Ngân sách đầu kỳ</dt><dd>{formatVnd(totals.startingTotal)}</dd></div>
                  <div><dt>{totals.includesEstimates ? 'Chi tiêu ước tính' : 'Chi tiêu đã ghi'}</dt><dd>{formatVnd(totals.spending)}</dd></div>
                  <div><dt>Khoản dự phòng</dt><dd>{formatVnd(totals.bufferReserve)}</dd></div>
                  {period.closedOn && period.closedOn < end && <div><dt>Đóng trước hạn</dt><dd>{formatDate(period.closedOn)}</dd></div>}
                </dl>
                {carriedTo?.carryOver && (
                  <p className="section-note">Đã chuyển {formatVnd(carriedTo.carryOver.amount)} sang kỳ bắt đầu ngày {formatDate(carriedTo.startDate)}.</p>
                )}
                <ExpenseList expenses={expenses} />
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
