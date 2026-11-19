import { useEffect, useState } from 'react'
import { budgetTotals, currentPeriod, periodExpenses, periodProgress } from '../algorithms/budget'
import { localDate } from '../algorithms/calendar'
import { assertUncooked, confirmCooking, kitchenOf } from '../algorithms/kitchen'
import { cookedKeys, mealKey } from '../algorithms/shopping'
import { CookingCard } from '../components/kitchen/CookMeal'
import type { KitchenCommit } from '../components/kitchen/shared'
import { readMealPlans } from '../data/meals/mealStorage'
import type { KitchenData } from '../types/kitchen'
import { defaultPreferences } from '../algorithms/mealRecipes'
import { getSlot, periodSlots, slotDateInPeriod, updateSlot } from '../algorithms/mealSchedule'
import { MealHistory, PlannedMeals } from '../components/meals/MealHistory'
import { slotLabels } from '../components/meals/labelsVi'
import { SlotMealPicker } from '../components/meals/MealPicker'
import { MealPreferences } from '../components/meals/MealPreferences'
import { readBudget } from '../data/budgetStorage'
import { useMealPlans } from '../hooks/useMealPlans'
import type { BudgetData, BudgetPeriod } from '../types/budget'
import { mealSlots } from '../types/meals'
import type { MealPlanData, MealPreferences as Preferences, PlannedSlot, SlotKey } from '../types/meals'
import './meals.css'

type Commit = (update: (data: MealPlanData) => MealPlanData) => Promise<void>

export function Meals({ data, today, budgetWarning, commitBudget, target }: { target?: string; data: BudgetData; today: string; budgetWarning?: string; commitBudget: KitchenCommit }) {
  const { data: plans, warning, commit } = useMealPlans()
  const kitchen = kitchenOf(data)
  const period = currentPeriod(data)
  const canPlan = period && periodProgress(period, today).status !== 'completed'

  return (
    <div lang="vi">
      <div className="budget-page-heading meals-heading">
        <h1>Món ăn</h1>
      </div>
      {warning && <p className="storage-warning" role="status">{warning}</p>}
      {budgetWarning && <p className="storage-warning" role="status">{budgetWarning}</p>}
      {canPlan ? (
        <MealPlanner
          key={period.id}
          period={period}
          today={today}
          available={budgetTotals(period, periodExpenses(data, period.id)).planningAvailable}
          slots={periodSlots(plans, period.id)}
          commit={commit}
          kitchen={kitchen}
          commitBudget={commitBudget}
          target={target}
        />
      ) : (
        <section className="panel meal-no-budget">
          <a className="button" href={period ? '#budget/new' : '#budget'}>{period ? 'Mở kỳ mới' : 'Thiết lập ngân sách'}</a>
        </section>
      )}
      <MealHistory plans={plans.periods} budgetPeriods={data.periods} currentId={canPlan ? period.id : undefined} today={today} cooked={cookedKeys(kitchen)} />
    </div>
  )
}

function MealPlanner({ period, today, slots, available, commit, kitchen, commitBudget, target }: {
  target?: string
  period: BudgetPeriod
  today: string
  slots: PlannedSlot[]
  available: number
  commit: Commit
  kitchen: KitchenData
  commitBudget: KitchenCommit
}) {
  const { end } = periodProgress(period, today)
  const initialDate = today > period.startDate ? today : period.startDate
  const params = new URLSearchParams(target)
  const targeted = params.get('period') === period.id ? slots.find((entry) =>
    entry.date === params.get('date') && entry.slot === params.get('slot') && entry.active && entry.recipeIds.length &&
    slotDateInPeriod(period, entry.date)) : undefined
  const [selection, setSelection] = useState<SlotKey>(targeted ?? { date: initialDate, slot: 'lunch' })
  useEffect(() => {
    if (!targeted) return
    const frame = requestAnimationFrame(() => {
      const summary = document.getElementById('meal-cooking-summary')
      const details = summary?.closest('details')
      if (details) details.open = true
      summary?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [targeted?.date, targeted?.slot])
  const [preferences, setPreferences] = useState(defaultPreferences)
  const date = slotDateInPeriod(period, selection.date) ? selection.date : initialDate
  const key = { ...selection, date }
  const cooked = cookedKeys(kitchen)

  function chooseDate(value: string) {
    if (slotDateInPeriod(period, value)) setSelection({ ...key, date: value })
  }

  return (
    <>
      <section className="meal-date-choice" id="meal-schedule" tabIndex={-1} aria-label="Chọn ngày và bữa">
        <label className="meal-field"><span>Ngày nấu</span>
          <input type="date" min={period.startDate} max={end} value={date}
            onInput={(event) => chooseDate(event.currentTarget.value)} onChange={(event) => chooseDate(event.target.value)} />
        </label>
        <label className="meal-field"><span>Bữa ăn</span>
          <select value={key.slot} onChange={(event) => setSelection({ date, slot: event.target.value as SlotKey['slot'] })}>
            {mealSlots.map((slot) => {
              const entry = getSlot(slots, { date, slot })
              return <option key={slot} value={slot}>{slotLabels[slot]}{cooked.has(mealKey(period.id, entry)) ?
                ' · Đã nấu' : entry.recipeIds.length > 0 ? ' · Đã lưu' : ''}</option>
            })}
          </select>
        </label>
      </section>
      <div className="meal-diet"><MealPreferences preferences={preferences} onChange={setPreferences} /></div>
      <ActiveSlot key={key.date + key.slot} slot={getSlot(slots, key)} period={period} today={today}
        slots={slots} available={available} commit={commit} kitchen={kitchen} commitBudget={commitBudget} preferences={preferences}
        onNavigate={(target) => {
          setSelection(target)
          document.getElementById('meal-schedule')?.focus()
        }} />
    </>
  )
}

function ActiveSlot({ slot, period, today, slots, available, commit, kitchen, commitBudget, preferences, onNavigate }: {
  slot: PlannedSlot
  period: BudgetPeriod
  today: string
  slots: PlannedSlot[]
  available: number
  commit: Commit
  kitchen: KitchenData
  commitBudget: KitchenCommit
  preferences: Preferences
  onNavigate: (slot: SlotKey) => void
}) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'status'; text: string } | null>(null)
  const cooked = cookedKeys(kitchen)
  const cookedMeal = kitchen.events.find((event) => event.kind === 'cooking' && event.id === mealKey(period.id, slot))

  async function save(next: PlannedSlot) {
    if (pending) return false
    setPending(true)
    setMessage(null)
    try {
      await commit((plans) => {
        const snapshot = readBudget()
        if (snapshot.warning) throw new Error(snapshot.warning)
        assertUncooked(kitchenOf(snapshot.data), period.id, slot)
        const latest = currentPeriod(snapshot.data)
        if (!latest || latest.id !== period.id) throw new Error('Kỳ ngân sách đã đổi. Kiểm tra kỳ hiện tại trước khi lưu.')
        return updateSlot(plans, latest, localDate(), next, slot)
      })
      if (next.recipeIds.length > 0 && next.date >= localDate()) window.location.hash = 'shopping/compare'
      else setMessage({ type: 'status', text: next.recipeIds.length ? 'Đã lưu bữa ăn.' : 'Đã xóa bữa ăn.' })
      return true
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Chưa lưu được bữa ăn.' })
      return false
    } finally {
      setPending(false)
    }
  }

  async function cook() {
    if (pending) return
    setPending(true)
    setMessage(null)
    try {
      await commitBudget((latest) => {
        const saved = readMealPlans()
        if (saved.warning) throw new Error('Không đọc được thực đơn đã lưu.')
        return confirmCooking(latest, saved.data, period.id, localDate(), slot)
      })
      setMessage({ type: 'status', text: 'Đã ghi bữa nấu và cập nhật tủ thực phẩm.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Chưa ghi được bữa đã nấu.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="simple-meals">
      {message && <p className={message.type === 'error' ? 'storage-warning' : 'status-message'}
        role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {!cookedMeal && <SlotMealPicker slot={slot} allowance={available} preferences={preferences} pending={pending}
        opensShopping={slot.date >= today} onSave={save} />}
      <div className="meal-tools">
        {(slot.recipeIds.length > 0 || cookedMeal) && <details className="kitchen-disclosure">
          <summary id="meal-cooking-summary">{cookedMeal ? 'Đã nấu' : 'Nấu bữa này'}</summary>
          <CookingCard meal={slot} kitchen={kitchen} cooked={cookedMeal?.kind === 'cooking' ? cookedMeal : undefined}
            canCook={periodProgress(period, today).status === 'active'} pending={pending} onCook={cook} />
        </details>}
        <PlannedMeals slots={slots} period={period} onNavigate={onNavigate} cooked={cooked} />
      </div>
    </div>
  )
}
