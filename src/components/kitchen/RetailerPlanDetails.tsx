import { linePrice } from '../../algorithms/shopping'
import { retailerName } from '../../data/kitchen/retailers'
import type { ShoppingBranch, ShoppingLine, ShoppingProposal } from '../../types/kitchen'
import { formatDate, formatVnd } from '../budget/format'
import { ingredientLabels, ingredientQuantity } from '../meals/labelsVi'

const reviewTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
})

function sourceLabel(line: ShoppingLine) {
  const source = line.priceSource
  return !source ? 'Bản ghi mô phỏng cũ' : source.kind === 'manual' ? 'Giá bạn nhập' :
    source.kind === 'unpriced' ? 'Chưa có giá' : source.verification === 'product' ? 'Giá trên trang sản phẩm' : 'Giá trong danh mục cửa hàng'
}

export function ProductLine({ line, sourceDetails = true }: { line: ShoppingLine; sourceDetails?: boolean }) {
  const { priceSource: source, ingredientId: id, packs, packQuantity } = line
  const product = source?.product || ingredientLabels[id]
  return (
    <div>
      <strong>{sourceDetails && source?.kind === 'observed' ? <a href={source.url}>{product}</a> : product}</strong>
      <p>{source?.kind === 'observed' ?
        `${packs} × ${source.packDescription ?? ingredientQuantity(id, packQuantity)}` :
        ingredientQuantity(id, packs * packQuantity)}{(sourceDetails || source?.kind === 'unpriced') && <> · {sourceLabel(line)}</>}</p>
      {sourceDetails && source?.kind === 'observed' && <p>{source.reviewedAt ? reviewTime.format(new Date(source.reviewedAt)) : formatDate(source.observedOn)} · {formatVnd(line.packPrice)}/gói
        {source.priceUrl && <> · <a href={source.priceUrl}>Nguồn giá</a></>}</p>}
    </div>
  )
}

export function PlanDetails({ proposal, branches }: { proposal: ShoppingProposal; branches: readonly ShoppingBranch[] }) {
  return (
    <details className="kitchen-disclosure">
      <summary>Chi tiết giỏ</summary>
      <p className="section-note">Tổng tiền hàng theo gói. Giá tại quầy, phí và tồn kho có thể thay đổi.</p>
      {!!proposal?.lines.length && <ul className="kitchen-rows">{proposal.lines.map((line) => (
        <li key={line.ingredientId}>
          <div><p>{retailerName(line.retailerId)}</p><ProductLine line={line} /></div>
          {line.packPrice > 0 && <strong>{formatVnd(linePrice(line))}</strong>}
        </li>
      ))}</ul>}
      {branches.length > 0 && <ul className="kitchen-rows">{branches.map((branch) => (
        <li key={branch.id}><div><a href={branch.source}>{retailerName(branch.retailerId)} · {branch.name}</a>
          <p>{branch.address} · {formatDate(branch.reviewedOn)}{branch.coordinateSource &&
            <> · <a href={branch.coordinateSource}>Vị trí trên bản đồ</a></>}</p></div></li>
      ))}</ul>}
    </details>
  )
}
