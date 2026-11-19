import { useState } from 'react'
import type { FormEvent } from 'react'
import { adjustStock, kitchenOf } from '../algorithms/kitchen'
import { localDate } from '../algorithms/calendar'
import { mealName } from '../algorithms/mealRecipes'
import { pantryStock } from '../algorithms/shopping'
import { formatDate } from '../components/budget/format'
import { ingredientLabels, ingredientQuantity, slotLabels } from '../components/meals/labelsVi'
import type { KitchenCommit } from '../components/kitchen/shared'
import { budgetId } from '../data/budgetStorage'
import { retailerName, stockIngredientIds } from '../data/kitchen/retailers'
import { ingredients } from '../data/meals/ingredients'
import type { BudgetData } from '../types/budget'
import type { KitchenEvent, StockIngredient } from '../types/kitchen'
import './kitchen.css'

const alphabeticIngredients = [...stockIngredientIds].sort((a, b) => ingredientLabels[a].localeCompare(ingredientLabels[b], 'vi'))

export function Pantry({ data, warning, commit }: { data: BudgetData; warning?: string; commit: KitchenCommit }) {
  const kitchen = kitchenOf(data)
  const stock = pantryStock(kitchen)
  const inStock = alphabeticIngredients.filter((id) => (stock[id] ?? 0) > 0)
  const events = [...kitchen.events].reverse()

  return (
    <>
      <div className="budget-page-heading">
        <h1>Tủ thực phẩm</h1>
      </div>
      {warning && <p className="storage-warning" role="status">{warning}</p>}
      <div className="pantry-grid">
        <section className="panel kitchen-panel" aria-labelledby="pantry-stock">
          <h2 id="pantry-stock">Đang có</h2>
          {inStock.length ? <ul className="kitchen-rows">
            {inStock.map((id) => <li key={id}><span>{ingredientLabels[id]}</span>
              <strong>{ingredientQuantity(id, stock[id]!)}</strong></li>)}
          </ul> : <p className="section-note">Chưa có nguyên liệu.</p>}
        </section>
        <StockForm commit={commit} />
      </div>
      {events.length > 0 && <details className="kitchen-section kitchen-disclosure">
        <summary>Lịch sử tủ thực phẩm</summary>
        <ul className="kitchen-rows">{events.map((event) => (
          <li key={event.id}><HistoryEntry event={event} /></li>
        ))}</ul>
      </details>}
    </>
  )
}

function StockForm({ commit }: { commit: KitchenCommit }) {
  const [ingredientId, setIngredient] = useState<StockIngredient>(alphabeticIngredients[0])
  const [operation, setOperation] = useState<'addition' | 'correction'>('addition')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ error: boolean; text: string }>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setNotice(undefined)
    try {
      const value = /^-?\d+$/.test(quantity.trim()) ? Number(quantity) : NaN
      const id = budgetId()
      await commit((data) => adjustStock(data, {
        id, date: localDate(), ingredientId, quantity: value, kind: operation,
        reason: operation === 'addition' ? 'Thêm nguyên liệu đang có' : reason.trim(),
      }))
      setQuantity('')
      setReason('')
      setNotice({ error: false, text: 'Đã cập nhật tủ thực phẩm.' })
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : 'Chưa cập nhật được tủ thực phẩm.' })
    } finally { setPending(false) }
  }

  return (
    <section className="panel kitchen-panel" aria-labelledby="adjust-heading">
      <h2 id="adjust-heading">Cập nhật nguyên liệu</h2>
      <form onSubmit={submit} className="kitchen-form">
        <fieldset className="kitchen-controls" disabled={pending}>
          <legend className="kitchen-visually-hidden">Thay đổi số lượng</legend>
          <label className="meal-field"><span>Thao tác</span>
            <select value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)}>
              <option value="addition">Thêm nguyên liệu đang có</option><option value="correction">Điều chỉnh số lượng</option>
            </select>
          </label>
          <label className="meal-field"><span>Nguyên liệu</span>
            <select value={ingredientId} onChange={(event) => setIngredient(event.target.value as StockIngredient)}>
              {alphabeticIngredients.map((id) => <option key={id} value={id}>{ingredientLabels[id]}</option>)}
            </select>
          </label>
          <label className="meal-field"><span>Số lượng ({ingredients[ingredientId].unit === 'each' ? 'quả' : ingredients[ingredientId].unit})</span>
            <input type="number" step="1" min={operation === 'addition' ? 1 : undefined} value={quantity} required
              onChange={(event) => setQuantity(event.target.value)} />
          </label>
          {operation === 'correction' && <>
            <p className="section-note">Nhập số âm để trừ bớt.</p>
            <label className="meal-field"><span>Lý do điều chỉnh</span>
              <input value={reason} maxLength={160} required onChange={(event) => setReason(event.target.value)} />
            </label>
          </>}
          <button type="submit" className="button">Lưu thay đổi</button>
        </fieldset>
      </form>
      {notice && <p className={notice.error ? 'meal-warning' : 'section-note pantry-note'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    </section>
  )
}

function HistoryEntry({ event }: { event: KitchenEvent }) {
  if (event.kind === 'purchase') {
    const line = event.line
    return <><div><strong>{line.priceSource ? 'Mua nguyên liệu' : 'Mua theo giỏ mô phỏng'} · {ingredientLabels[line.ingredientId]}</strong>
      <p>{formatDate(event.date)} · {retailerName(line.retailerId)}</p></div>
      <strong>+{ingredientQuantity(line.ingredientId, line.packs * line.packQuantity)}</strong></>
  }
  if (event.kind === 'cooking') {
    return <div><strong>Đã nấu · <span lang="vi">{mealName(event.meal.recipeIds)}</span></strong>
      <p>{formatDate(event.date)} · {slotLabels[event.meal.slot]} ngày {formatDate(event.meal.date)} · {event.meal.dishPortions ? `${event.meal.recipeIds.length} món` : `${event.meal.servings} phần`}</p>
      <details className="kitchen-disclosure"><summary>Nguyên liệu đã dùng</summary>
        <ul>{event.ingredients.map(({ ingredientId, quantity }) => <li key={ingredientId} className="section-note">
          {ingredientLabels[ingredientId]} · −{ingredientQuantity(ingredientId, quantity)}</li>)}</ul>
      </details></div>
  }
  return <><div><strong>{event.kind === 'addition' ? 'Thêm nguyên liệu' : 'Điều chỉnh số lượng'} · {ingredientLabels[event.ingredientId]}</strong>
    <p>{formatDate(event.date)} · {event.kind === 'addition' && event.reason === 'Stock entered by hand' ? 'Thêm nguyên liệu đang có' : event.reason}</p></div>
    <strong>{event.quantity > 0 ? '+' : '−'}{ingredientQuantity(event.ingredientId, Math.abs(event.quantity))}</strong></>
}
