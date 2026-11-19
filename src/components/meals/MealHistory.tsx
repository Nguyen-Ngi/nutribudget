import { mealKey } from '../../algorithms/shopping'
import { periodProgress } from '../../algorithms/budget'
import { mealName } from '../../algorithms/mealRecipes'
import { slotDateInPeriod } from '../../algorithms/mealSchedule'
import type { BudgetPeriod } from '../../types/budget'
import type { PeriodMealPlan, PlannedSlot, SlotKey } from '../../types/meals'
import { mealSlots } from '../../types/meals'
import { slotLabels } from './labelsVi'
import { formatDate, formatPeriod } from '../budget/format'

function SavedMeals({ slots, period, periodId, onNavigate, cooked }: {
  slots: PlannedSlot[]
  period?: BudgetPeriod
  periodId: string
  cooked: ReadonlySet<string>
  onNavigate?: (slot: SlotKey) => void
}) {
  const saved = slots.filter(({ recipeIds }) => recipeIds.length).sort((a, b) =>
    (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot))
  if (!saved.length) return <p className="section-note">Chưa có bữa đã lưu.</p>

  return (
    <ul className="meal-saved-list">
      {saved.map((slot) => {
        const outside = period && !slotDateInPeriod(period, slot.date)
        const canOpen = !outside && onNavigate
        return (
          <li key={slot.date + slot.slot}>
            <p className="meal-saved-date">{formatDate(slot.date)} · <span>{slotLabels[slot.slot]}</span></p>
            <p lang="vi">{mealName(slot.recipeIds)}</p>
            <p className="section-note">{slot.dishPortions ? `${slot.recipeIds.length} món` : `${slot.servings} phần`}
              {cooked.has(mealKey(periodId, slot)) ? ' · Đã nấu' : !slot.active ? ' · Đã tắt' : ''}{outside ? ' · Ngoài kỳ ngân sách' : ''}</p>
            {canOpen && (
              <button type="button" className="meal-text-button" aria-label={`Mở ${slotLabels[slot.slot]} ngày ${formatDate(slot.date)}`}
                onClick={() => onNavigate(slot)}>Mở bữa ăn</button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function MealHistory({ plans, budgetPeriods, currentId, today, cooked }: {
  plans: PeriodMealPlan[]
  budgetPeriods: BudgetPeriod[]
  currentId?: string
  today: string
  cooked: ReadonlySet<string>
}) {
  const history = plans.filter((plan) => plan.budgetPeriodId !== currentId && plan.slots.some(({ recipeIds }) => recipeIds.length))
  if (!history.length) return null

  return (
    <details className="meal-history kitchen-disclosure">
      <summary>Lịch sử bữa ăn</summary>
      {[...history].reverse().map((plan) => {
        const period = budgetPeriods.find(({ id }) => id === plan.budgetPeriodId)
        const title = period ? formatPeriod(period.startDate, periodProgress(period, today).end) : 'Không có thông tin kỳ ngân sách'
        return (
          <details key={plan.budgetPeriodId}>
            <summary>{title}</summary>
            <SavedMeals slots={plan.slots} periodId={plan.budgetPeriodId} cooked={cooked} />
          </details>
        )
      })}
    </details>
  )
}

export function PlannedMeals({ slots, period, onNavigate, cooked }: {
  slots: PlannedSlot[]
  period: BudgetPeriod
  cooked: ReadonlySet<string>
  onNavigate: (slot: SlotKey) => void
}) {
  if (!slots.some(({ recipeIds }) => recipeIds.length)) return null
  return (
    <details className="planned-meals kitchen-disclosure">
      <summary>Bữa đã lưu</summary>
      <SavedMeals slots={slots} period={period} periodId={period.id} onNavigate={onNavigate} cooked={cooked} />
    </details>
  )
}
