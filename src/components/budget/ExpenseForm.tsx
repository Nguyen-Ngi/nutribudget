import { useState } from 'react'
import type { FormEvent } from 'react'
import { isPositiveInteger } from '../../algorithms/budget'
import { isCalendarDate } from '../../algorithms/calendar'
import { budgetId } from '../../data/budgetStorage'
import type { ExpenseTransaction } from '../../types/budget'
import { errorAttributes, Field } from './Field'
import { wholeNumber } from './format'

interface ExpenseFormProps {
  periodId: string
  startDate: string
  today: string
  onSave: (expense: ExpenseTransaction) => Promise<void>
  onCancel: () => void
}

type Errors = Partial<Record<'amount' | 'date' | 'submit', string>>

export function ExpenseForm({ periodId, startDate, today, onSave, onCancel }: ExpenseFormProps) {
  const [id] = useState(budgetId)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [estimated, setEstimated] = useState(true)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const next: Errors = {}
    const value = wholeNumber(amount)
    if (!isPositiveInteger(value)) next.amount = 'Nhập số tiền nguyên lớn hơn 0.'
    if (!isCalendarDate(date) || date < startDate || date > today) {
      next.date = 'Chọn ngày từ đầu kỳ đến hôm nay.'
    }
    setErrors(next)
    const firstError = Object.keys(next)[0]
    if (firstError) {
      document.getElementById(`expense-${firstError}`)?.focus()
      return
    }

    setSaving(true)
    try {
      await onSave({
        id,
        amount: value,
        date,
        budgetPeriodId: periodId,
        priceStatus: estimated ? 'estimated' : 'verified',
        category: 'groceries',
        source: { type: 'manual' },
      })
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Chưa lưu được khoản chi. Hãy thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="budget-form expense-form" onSubmit={submit} noValidate aria-label="Ghi khoản chi mua nguyên liệu">
      <fieldset disabled={saving}>
        <legend>Ghi khoản chi</legend>
        <div className="form-grid">
          <Field id="expense-amount" label="Số tiền (₫)" error={errors.amount}>
            <input id="expense-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)}
              required {...errorAttributes('expense-amount', errors.amount)} />
          </Field>
          <Field id="expense-date" label="Ngày mua" error={errors.date}>
            <input id="expense-date" type="date" min={startDate} max={today} value={date} onChange={(event) => setDate(event.target.value)}
              required {...errorAttributes('expense-date', errors.date)} />
          </Field>
        </div>
        <label className="check-option">
          <input type="checkbox" checked={estimated} onChange={(event) => setEstimated(event.target.checked)} />
          <span><strong>Số tiền ước tính</strong><small>Bỏ chọn nếu bạn đã biết số tiền thực trả.</small></span>
        </label>
      </fieldset>
      {errors.submit && <p className="field-error" role="alert">{errors.submit}</p>}
      <div className="action-row">
        <button className="button" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu khoản chi'}</button>
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={saving}>Hủy</button>
      </div>
    </form>
  )
}
