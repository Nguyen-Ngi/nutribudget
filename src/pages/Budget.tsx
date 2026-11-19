import { useState } from 'react'
import { budgetTotals, carryOverOffer, createPeriod, currentPeriod, editPeriod, periodExpenses, periodProgress, recordExpense } from '../algorithms/budget'
import { periodSlots } from '../algorithms/mealSchedule'
import { readMealPlans } from '../data/meals/mealStorage'
import { localDate } from '../algorithms/calendar'
import { BudgetForm } from '../components/budget/BudgetForm'
import { BudgetHistory } from '../components/budget/BudgetHistory'
import { BudgetSummary, PeriodTiming } from '../components/budget/BudgetSummary'
import { ExpenseForm } from '../components/budget/ExpenseForm'
import { formatVnd } from '../components/budget/format'
import { ExpenseList } from '../components/budget/ExpenseList'
import { budgetId } from '../data/budgetStorage'
import type { BudgetData } from '../types/budget'

interface BudgetProps {
  data: BudgetData
  today: string
  startNew: boolean
  commit: (update: (data: BudgetData) => BudgetData) => Promise<void>
}

export function Budget({ data, today, startNew, commit }: BudgetProps) {
  const period = currentPeriod(data)
  const [mode, setMode] = useState<'summary' | 'edit' | 'expense'>('summary')
  const [notice, setNotice] = useState('')
  const status = period ? periodProgress(period, today).status : null

  if (!period || startNew) {
    return (
      <>
        <div className="budget-page-heading">
          <h1>{period ? 'Mở kỳ mới' : 'Thiết lập ngân sách'}</h1>
        </div>
        <BudgetForm
          key={period?.id ?? 'first'}
          today={today}
          carryOver={carryOverOffer(data, today)}
          replacing={Boolean(period && status !== 'completed')}
          onSave={async (settings, approvedCarryOver, confirmReplacement) => {
            const id = budgetId()
            await commit((latest) => createPeriod(latest, settings, {
              id,
              today: localDate(),
              previousId: period?.id,
              approvedCarryOver,
              confirmReplacement,
            }))
            window.location.hash = 'overview'
          }}
          onCancel={period ? () => { window.location.hash = 'budget' } : undefined}
        />
      </>
    )
  }

  const expenses = periodExpenses(data, period.id)
  const { bufferReserve } = budgetTotals(period, expenses)
  if (mode === 'edit' && status !== 'completed') {
    return (
      <>
        <div className="budget-page-heading">
          <h1>Sửa ngân sách</h1>
          <p>Chọn ngày sao cho các khoản mua, bữa đã lưu và bữa đã nấu vẫn nằm trong kỳ.</p>
        </div>
        <BudgetForm
          key={period.id}
          period={period}
          today={today}
          carryOver={null}
          replacing={false}
          onSave={async (settings) => {
            await commit((latest) => {
              const current = currentPeriod(latest)
              const datesChanged = current?.startDate !== settings.startDate || current.duration !== settings.duration
              if (!datesChanged) return editPeriod(latest, period.id, settings, localDate())
              const meals = readMealPlans()
              if (meals.warning) throw new Error('Chưa thể đổi ngày vì không đọc được các bữa đã lưu.')
              return editPeriod(latest, period.id, settings, localDate(), periodSlots(meals.data, period.id))
            })
            setMode('summary')
            setNotice('Đã lưu ngân sách.')
          }}
          onCancel={() => setMode('summary')}
        />
      </>
    )
  }

  return (
    <>
      <div className="budget-page-heading budget-heading-actions">
        <div>
          <h1>Ngân sách</h1>
          <PeriodTiming period={period} today={today} />
        </div>
      </div>
      {notice && <p className="status-message" role="status">{notice}</p>}
      <BudgetSummary period={period} expenses={expenses} />
      <div className="budget-next">
        <a className="button" href={status === 'completed' ? '#budget/new' : '#meals'}>
          {status === 'completed' ? 'Mở kỳ tiếp theo' : 'Chọn món'}
        </a>
      </div>
      <details className="budget-section kitchen-disclosure" open={mode === 'expense' || undefined}>
        <summary>Quản lý ngân sách</summary>
        <div className="action-row budget-management">
          {status !== 'completed' && <>
            <button className="button button-secondary" onClick={() => { setNotice(''); setMode('edit') }}>Sửa ngân sách</button>
            <a className="button button-secondary" href="#budget/new">Mở kỳ mới</a>
          </>}
          {status === 'active' && mode !== 'expense' &&
            <button className="button button-secondary" onClick={() => { setNotice(''); setMode('expense') }}>Ghi khoản chi</button>}
        </div>
        {mode === 'expense' && status === 'active' && <ExpenseForm
          key={period.id}
          periodId={period.id}
          startDate={period.startDate}
          today={today}
          onSave={async (expense) => {
            await commit((latest) => recordExpense(latest, expense, localDate()))
            setMode('summary')
            setNotice('Đã ghi khoản chi.')
          }}
          onCancel={() => setMode('summary')}
        />}
        {bufferReserve > 0 && <p className="section-note">Dự phòng {formatVnd(bufferReserve)}</p>}
        <ExpenseList expenses={expenses} />
        <BudgetHistory data={data} today={today} />
      </details>
    </>
  )
}
