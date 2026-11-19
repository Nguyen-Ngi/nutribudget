import { useState } from 'react'
import { budgetTotals, currentPeriod, periodExpenses, periodProgress } from '../algorithms/budget'
import { localDate } from '../algorithms/calendar'
import { approveRetailerShopping, confirmRetailerPurchase, kitchenOf } from '../algorithms/kitchen'
import { periodSlots } from '../algorithms/mealSchedule'
import { isRealRetailer, retailerPlans, shortlistRetailerPlans } from '../algorithms/retailerShopping'
import { shoppingArea } from '../algorithms/shoppingLocation'
import { isCurrentShoppingLine, paidTrips, pendingLines, shoppingNeeds } from '../algorithms/shopping'
import { formatVnd } from '../components/budget/format'
import { PlanDetails } from '../components/kitchen/RetailerPlanDetails'
import { ShoppingChecklist } from '../components/kitchen/ShoppingChecklist'
import type { KitchenCommit } from '../components/kitchen/shared'
import { ingredientLabels, ingredientQuantity } from '../components/meals/labelsVi'
import { budgetId } from '../data/budgetStorage'
import { retailerBranches, shoppingAreas } from '../data/kitchen/retailerLocations'
import { retailerName } from '../data/kitchen/retailers'
import { readMealPlans } from '../data/meals/mealStorage'
import { useShoppingPrices } from '../hooks/useShoppingPrices'
import { useMealPlans } from '../hooks/useMealPlans'
import type { BudgetData, BudgetPeriod } from '../types/budget'
import type { ShoppingBranch, ShoppingLine, ShoppingProposal } from '../types/kitchen'
import type { PlannedSlot } from '../types/meals'
import './kitchen.css'

function latestMeals() {
  const snapshot = readMealPlans()
  if (snapshot.warning) throw new Error(snapshot.warning)
  return snapshot.data
}

export function Shopping({ data, today, warning, commit, startInComparison }: {
  data: BudgetData; today: string; warning?: string; commit: KitchenCommit; startInComparison: boolean
}) {
  const plan = useMealPlans()
  const period = currentPeriod(data)

  return (
    <div className="shopping-page">
      <div className="budget-page-heading"><h1>Mua sắm</h1></div>
      {(warning || plan.warning) && <p className="storage-warning" role="status">{warning ?? plan.warning}</p>}
      {period && periodProgress(period, today).status !== 'completed' ?
        <BasketPlanner key={period.id} data={data} period={period} today={today} commit={commit}
          slots={periodSlots(plan.data, period.id)} startInComparison={startInComparison} usable={!warning && !plan.warning} /> :
        <section className="panel kitchen-panel kitchen-empty">
          <p className="section-note">Mở kỳ ngân sách để lập danh sách mua.</p>
          <a className="button" href={period ? '#budget/new' : '#budget'}>{period ? 'Mở kỳ mới' : 'Thiết lập ngân sách'}</a>
        </section>}
    </div>
  )
}

const distanceFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function BasketPlanner({ data, period, today, slots, commit, usable, startInComparison }: {
  data: BudgetData; period: BudgetPeriod; today: string; slots: PlannedSlot[]; commit: KitchenCommit; usable: boolean; startInComparison: boolean
}) {
  const kitchen = kitchenOf(data)
  const [areaId, setAreaId] = useState('')
  const [comparing, setComparing] = useState(startInComparison)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needs = shoppingNeeds(period, today, slots, kitchen)
  const shortages = needs.requirements.filter(({ shortage }) => shortage > 0)
  const approved = kitchen.approved?.periodId === period.id ? kitchen.approved : null
  const active = periodProgress(period, today).status === 'active'
  const realChecklist = approved && approved.lines.length > 0 && approved.lines.every((line) => isRealRetailer(line.retailerId)) ? approved : null
  const prices = useShoppingPrices(shortages.map(({ ingredientId }) => ingredientId), !realChecklist || comparing)
  const isCurrent = (line: ShoppingLine) => isCurrentShoppingLine(line, needs, period, today)

  async function save(update: Parameters<KitchenCommit>[0]) {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      await commit(update)
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không lưu được thay đổi.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function showStage(compare: boolean) {
    setError('')
    if (!compare && startInComparison) {
      window.location.replace('#shopping')
      return
    }
    setComparing(compare)
    requestAnimationFrame(() => document.getElementById(compare ? 'retailer-comparison' : 'pending-shopping')?.focus())
  }

  async function apply(proposal: ShoppingProposal) {
    const id = budgetId()
    const saved = await save((latest) =>
      approveRetailerShopping(latest, latestMeals(), period.id, localDate(), id, proposal, [], areaId, prices.catalog))
    if (saved) {
      showStage(false)
    }
  }

  if (realChecklist && !comparing) {
    const pending = pendingLines(kitchen, period.id)
    const coverage = new Set([...pending.map(({ ingredientId }) => ingredientId), ...realChecklist.uncovered])
    const changed = pending.some((line) => !isCurrent(line)) || shortages.some(({ ingredientId }) => !coverage.has(ingredientId)) ||
      (realChecklist.mealSignature !== undefined && realChecklist.mealSignature !== needs.mealSignature)
    const purchases = new Map(kitchen.events.flatMap((event) => event.kind === 'purchase' ? [[event.id, event] as const] : []))
    return <>
      {error && <p className="storage-warning" role="alert">{error}</p>}
      <ShoppingChecklist approved={realChecklist} purchases={purchases} today={today} paid={paidTrips(kitchen)}
        active={active} disabled={busy || !usable} needsUpdate={changed} isCurrent={isCurrent}
        onUpdate={() => showStage(true)} onBuy={(line) => {
          void save((latest) => confirmRetailerPurchase(latest, latestMeals(), period.id, localDate(), realChecklist.id, line.ingredientId))
        }} />
    </>
  }

  const area = shoppingArea(areaId)
  const { quotes, provisional } = retailerPlans(needs, today, [], prices.catalog)
  const ranking = shortlistRetailerPlans(quotes, area)
  const missing = shortages.filter(({ ingredientId }) =>
    !provisional?.lines.some((line) => line.ingredientId === ingredientId))
  const canLocate = retailerBranches.some(({ retailerId }) =>
    ranking.options.some((quote) => quote.retailerIds.includes(retailerId)))
  const available = budgetTotals(period, periodExpenses(data, period.id)).planningAvailable
  const lookupNote = prices.state === 'loading' ? 'Giá đã ghi nhận · Đang kiểm tra giá mới…' :
    prices.found ? 'Có giá vừa ghi nhận. Xem thời điểm từng giá trong chi tiết giỏ.' : 'Theo giá đã ghi nhận.'

  return (
    <section className="shopping-compare" aria-labelledby="retailer-comparison">
      <header className="shopping-stage-header">
        <div>
          <h2 id="retailer-comparison" tabIndex={-1}>Chọn nơi mua</h2>
          {shortages.length > 0 && <p className="section-note">{shortages.length} nguyên liệu cần mua · <span role="status">{lookupNote}</span></p>}
        </div>
        {realChecklist && <button type="button" className="meal-text-button" onClick={() => showStage(false)}>Về danh sách</button>}
      </header>
      {error && <p className="storage-warning" role="alert">{error}</p>}
      {ranking.options.length > 0 ? <>
        {ranking.options.length > 1 && !ranking.comparable && <p className="section-note">Các giỏ khác sản phẩm hoặc quy cách.</p>}
        <div className="shopping-options">
          {ranking.options.map((option) => (
            <article className="panel shopping-option" key={JSON.stringify(option.proposal)}
              data-selected={option === ranking.recommended}>
              <OptionSummary title={option === ranking.recommended ? 'Rẻ nhất cùng quy cách' : option === ranking.convenient ?
                'Tiện nhất' : option === ranking.balanced ? 'Cân bằng' : 'Giỏ đủ nguyên liệu'}
                stores={option.retailerIds.map(retailerName)} total={option.total} km={option.km} branches={option.branches} />
              {option.total > available && <p className="section-note">Vượt khoản lên món {formatVnd(option.total - available)}.</p>}
              <button type="button" className="button" disabled={busy || !usable} onClick={() => void apply(option.proposal)}>
                Chọn phương án
              </button>
              <PlanDetails proposal={option.proposal} branches={option.branches} />
            </article>
          ))}
        </div>
        {canLocate && <label className="meal-field shopping-area"><span>Tính khoảng cách từ</span>
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Chọn khu vực (không bắt buộc)</option>
            {shoppingAreas.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>}
      </> : (prices.state !== 'loading') && (
        <div className="panel shopping-empty">
          <p><strong>{needs.missingMeals ? 'Có bữa cần chọn lại món.' : shortages.length ? 'Chưa đủ giá để lập giỏ.' :
            needs.mealCount ? 'Tủ thực phẩm đã có đủ nguyên liệu.' : 'Chọn món để xem nơi mua.'}</strong></p>
          {missing.length > 0 && <ul className="shopping-missing" aria-label="Nguyên liệu chưa có giá">
            {missing.map(({ ingredientId, shortage }) => <li key={ingredientId}>
              {ingredientLabels[ingredientId]} · {ingredientQuantity(ingredientId, shortage)}
            </li>)}
          </ul>}
          <a className="button button-secondary" href={!shortages.length && needs.mealCount && !needs.missingMeals ? '#pantry' : '#meals'}>
            {!shortages.length && needs.mealCount && !needs.missingMeals ? 'Xem tủ thực phẩm' : 'Về món ăn'}
          </a>
        </div>
      )}
    </section>
  )
}

function OptionSummary({ title, stores, total, km, branches }: {
  title: string; stores: string[]; total?: number; km?: number; branches: ShoppingBranch[]
}) {
  const distance = km === undefined ? '' : km < .1 ? 'Dưới 0,1 km' : `Khoảng ${distanceFormat.format(km)} km`
  return (
    <span className="shopping-option-content">
      <span className="shopping-option-tag">{title}</span>
      <strong className="shopping-option-stores">{stores.join(' + ')}</strong>
      <span className="shopping-option-meta">{stores.length} cửa hàng{distance && <> · {distance} {stores.length > 1 ? 'tổng đường chim bay' : 'đường chim bay'}</>}
        {branches.length > 0 && <span className="shopping-option-branches">{branches.map(({ name }) => name).join(' · ')}</span>}
      </span>
      {total !== undefined && <span className="shopping-option-price"><strong>{formatVnd(total)}</strong> <small>Ước tính</small></span>}
    </span>
  )
}
