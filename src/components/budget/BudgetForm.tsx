import { useState } from 'react'
import type { FormEvent } from 'react'
import { isBufferPercentage, isPositiveInteger } from '../../algorithms/budget'
import { endDate, isCalendarDate } from '../../algorithms/calendar'
import type { BudgetPeriod, BudgetSettings, CarryOver } from '../../types/budget'
import { Field, errorAttributes } from './Field'
import { formatDate, formatVnd, wholeNumber } from './format'

interface BudgetFormProps {
  period?: BudgetPeriod
  today: string
  carryOver: CarryOver | null
  replacing: boolean
  onSave: (settings: BudgetSettings, carryOver: CarryOver | null, confirmReplacement: boolean) => Promise<void>
  onCancel?: () => void
}

type Errors = Partial<Record<'amount' | 'duration' | 'start' | 'percentage' | 'replace' | 'submit', string>>

export function BudgetForm({ period, today, carryOver, replacing, onSave, onCancel }: BudgetFormProps) {
  const [amount, setAmount] = useState(period ? String(period.startingAmount) : '')
  const [duration, setDuration] = useState(String(period?.duration ?? 7))
  const [start, setStart] = useState(period?.startDate ?? today)
  const [buffer, setBuffer] = useState(period?.buffer != null)
  const [percentage, setPercentage] = useState(String(period?.buffer?.percentage ?? 10).replace('.', ','))
  const [applyCarry, setApplyCarry] = useState(false)
  const [replace, setReplace] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const days = wholeNumber(duration)
  const startingAmount = wholeNumber(amount)
  const end = endDate(start, days)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const next: Errors = {}
    const bufferPercent = /^\d+(?:[.,]\d{1,2})?$/.test(percentage.trim()) ? Number(percentage.replace(',', '.')) : NaN

    if (!isPositiveInteger(startingAmount)) next.amount = 'Nhập số tiền nguyên lớn hơn 0.'
    if (!isPositiveInteger(days)) next.duration = 'Nhập số ngày nguyên lớn hơn 0.'
    if (!isCalendarDate(start)) next.start = 'Chọn ngày bắt đầu hợp lệ.'
    if (!end && !next.start && !next.duration) next.duration = 'Chọn số ngày sao cho kỳ kết thúc chậm nhất vào 31/12/9999.'
    if (buffer && !isBufferPercentage(bufferPercent)) next.percentage = 'Nhập tỷ lệ từ 0 đến 100, tối đa hai chữ số thập phân.'
    if (replacing && !replace) next.replace = 'Xác nhận đóng kỳ hiện tại.'
    setErrors(next)

    const firstError = Object.keys(next)[0]
    if (firstError) {
      const field = document.getElementById(`budget-${firstError}`)
      const details = field?.closest('details')
      if (details) details.open = true
      field?.focus()
      return
    }

    setSaving(true)
    try {
      await onSave(
        { startingAmount, duration: days, startDate: start, buffer: buffer ? { percentage: bufferPercent } : null },
        applyCarry ? carryOver : null,
        replace,
      )
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Chưa lưu được ngân sách. Hãy thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="budget-form panel" onSubmit={submit} noValidate aria-label={period ? 'Sửa ngân sách' : 'Thiết lập ngân sách'}>
      <fieldset disabled={saving}>
        <legend className="kitchen-visually-hidden">Số tiền và thời gian</legend>
        <div className="form-grid">
          <Field id="budget-amount" label="Ngân sách nấu ăn (₫)" error={errors.amount}>
            <input id="budget-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)}
              placeholder="Ví dụ 500000" required {...errorAttributes('budget-amount', errors.amount)} />
          </Field>
          <Field id="budget-duration" label="Số ngày" error={errors.duration}>
            <input id="budget-duration" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)}
              placeholder="Ví dụ 10" required {...errorAttributes('budget-duration', errors.duration)} />
          </Field>
        </div>
      </fieldset>
      <details className="budget-options kitchen-disclosure">
        <summary>{period ? 'Ngày bắt đầu và dự phòng' : carryOver ? 'Ngày bắt đầu và chuyển số dư' : 'Đổi ngày bắt đầu'} · {isCalendarDate(start) ? formatDate(start) : 'Chọn ngày'}</summary>
        <fieldset disabled={saving}>
          <div className="form-grid">
            <Field id="budget-start" label="Ngày bắt đầu" error={errors.start}>
              <input id="budget-start" type="date" min="0001-01-01" max="9999-12-31" value={start}
                onChange={(event) => setStart(event.target.value)} required {...errorAttributes('budget-start', errors.start)} />
            </Field>
            <div className="date-preview" aria-live="polite">
              <span>Ngày cuối kỳ</span>
              <strong>{end ? formatDate(end) : 'Chưa xác định'}</strong>
            </div>
          </div>
          {period && <>
            <label className="check-option">
              <input type="checkbox" checked={buffer} onChange={(event) => setBuffer(event.target.checked)} />
              <span><strong>Dành một khoản dự phòng</strong><small>Giữ riêng khoản này khi lên món.</small></span>
            </label>
            {buffer && <Field id="budget-percentage" label="Tỷ lệ dự phòng (%)" error={errors.percentage}>
              <input id="budget-percentage" inputMode="decimal" value={percentage} onChange={(event) => setPercentage(event.target.value)}
                required {...errorAttributes('budget-percentage', errors.percentage)} />
            </Field>}
          </>}
          {carryOver && <label className="check-option">
            <input type="checkbox" checked={applyCarry} onChange={(event) => setApplyCarry(event.target.checked)} />
            <span><strong>Chuyển {formatVnd(carryOver.amount)} từ kỳ trước</strong>
              {carryOver.estimated && <small>Số dư ước tính.</small>}</span>
          </label>}
        </fieldset>
      </details>
      {replacing && (
        <fieldset disabled={saving}>
          <legend>Kỳ hiện tại</legend>
          <label className="check-option">
            <input id="budget-replace" type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)}
              {...errorAttributes('budget-replace', errors.replace)} />
            <span><strong>Đóng kỳ hiện tại</strong><small>Ngân sách và các khoản đã mua vẫn có trong lịch sử.</small></span>
          </label>
          {errors.replace && <p className="field-error" id="budget-replace-help" role="alert">{errors.replace}</p>}
        </fieldset>
      )}
      {errors.submit && <p className="field-error" role="alert">{errors.submit}</p>}
      <div className="action-row">
        <button className="button" disabled={saving}>{saving ? 'Đang lưu…' : period ? 'Lưu thay đổi' : 'Tạo ngân sách'}</button>
        {onCancel && <button className="button button-secondary" type="button" disabled={saving} onClick={onCancel}>Hủy</button>}
      </div>
    </form>
  )
}
