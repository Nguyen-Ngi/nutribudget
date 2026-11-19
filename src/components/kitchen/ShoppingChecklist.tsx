import { dayDifference } from '../../algorithms/calendar'
import { priceMaxAge } from '../../algorithms/retailerShopping'
import { linePrice, purchaseKey, tripKey } from '../../algorithms/shopping'
import { retailerName } from '../../data/kitchen/retailers'
import type { ApprovedShop, PurchaseEvent, ShoppingLine } from '../../types/kitchen'
import { formatVnd } from '../budget/format'
import { ingredientLabels } from '../meals/labelsVi'
import { ProductLine } from './RetailerPlanDetails'

export function ShoppingChecklist({ approved, purchases, today, paid, active, disabled, needsUpdate,
  isCurrent, onUpdate, onBuy }: {
  approved: ApprovedShop
  purchases: ReadonlyMap<string, PurchaseEvent>
  today: string
  paid: ReadonlySet<string>
  active: boolean
  disabled: boolean
  needsUpdate: boolean
  isCurrent: (line: ShoppingLine) => boolean
  onUpdate: () => void
  onBuy: (line: ShoppingLine) => void
}) {
  const { lines, periodId, branches } = approved
  const retailers = [...new Set(lines.map(({ retailerId }) => retailerId))]
  const bought = lines.filter((line) => purchases.has(purchaseKey(approved.id, line.ingredientId))).length
  const complete = bought === lines.length
  const partial = approved.uncovered.length > 0

  return (
    <section className="shopping-checklist" aria-labelledby="pending-shopping">
      <header className="shopping-stage-header">
        <div>
          <h2 id="pending-shopping" tabIndex={-1}>Danh sách cần mua</h2>
          <p className="section-note" role="status">{bought}/{lines.length} mặt hàng đã mua</p>
        </div>
        <button type="button" className="button button-secondary" onClick={onUpdate} disabled={disabled}>Cập nhật danh sách</button>
      </header>
      {(needsUpdate || !active) && <p className="shopping-notice" role="status">
        {needsUpdate ? 'Danh sách có thay đổi. Cập nhật để xem những món còn cần mua.' :
          'Bạn có thể đánh dấu đã mua khi kỳ ngân sách bắt đầu.'}
      </p>}
      {complete && <p className="shopping-done" role="status">{partial || needsUpdate ? 'Đã mua xong các món trong danh sách.' : 'Đã mua đủ nguyên liệu trong danh sách.'}</p>}
      {retailers.map((id) => {
        const branch = branches?.find((item) => item.retailerId === id)
        return <section className="panel shopping-store" key={id}>
          <h3>{retailerName(id)}{branch && <> · {branch.name}</>}</h3>
          {branch && <p className="section-note"><a href={branch.source}>{branch.address}</a></p>}
          <ul className="shopping-items">{lines.filter(({ retailerId }) => retailerId === id).map((line) => {
            const key = purchaseKey(approved.id, line.ingredientId)
            return <PurchaseItem key={key} line={line} today={today} purchase={purchases.get(key)}
              fee={paid.has(tripKey(line, periodId)) ? 0 : line.tripFee}
              disabled={disabled || !active || !isCurrent(line)} onBuy={() => onBuy(line)} />
          })}</ul>
        </section>
      })}
      {partial && <p className="section-note">Chưa có trong danh sách: {approved.uncovered.map((id) => ingredientLabels[id]).join(', ')}.</p>}
    </section>
  )
}

function PurchaseItem({ line, purchase, fee, today, disabled, onBuy }: {
  line: ShoppingLine; purchase?: PurchaseEvent; fee: number; today: string; disabled: boolean
  onBuy: () => void
}) {
  const source = line.priceSource
  const expired = source?.kind === 'observed' && (dayDifference(source.observedOn, today) > priceMaxAge || source.observedOn > today)
  const needsPrice = !purchase && (source?.kind === 'unpriced' || expired)
  const name = ingredientLabels[line.ingredientId]
  const price = purchase ? linePrice(purchase.line) + purchase.fee : linePrice(line)

  return (
    <li className="shopping-item" data-purchased={!!purchase}>
      <label className="shopping-item-check">
        <input type="checkbox" checked={!!purchase} disabled={!!purchase || disabled || needsPrice}
          aria-label={`Đã mua ${name}`} onChange={onBuy} />
        <ProductLine line={purchase?.line ?? line} sourceDetails={false} />
      </label>
      {needsPrice ? <small>{expired ? 'Giá đã hết hạn' : 'Chưa có giá'}</small> : <span className="kitchen-money"><strong>{formatVnd(price)}</strong><small>Ước tính</small></span>}
      {!purchase && fee > 0 && <small className="shopping-item-fee">Phí chuyến mua đã lưu: {formatVnd(fee)}, tính một lần.</small>}
    </li>
  )
}
