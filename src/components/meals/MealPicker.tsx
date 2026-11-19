import { useEffect, useRef, useState } from 'react'
import { browseDishes, categories, dishCategory } from '../../algorithms/dishCatalog'
import type { DishCategory } from '../../algorithms/dishCatalog'
import { applyDishEntries, dishEntries, maxServings, sameDishes, selectedValue } from '../../algorithms/dishSelection'
import type { DishEntry } from '../../algorithms/dishSelection'
import { allowsRecipe, mealMetrics } from '../../algorithms/mealRecipes'
import dishArt from '../../data/meals/dishArt.json'
import { recipeById } from '../../data/meals/recipes'
import type { CatalogRecipe } from '../../data/meals/recipes'
import type { MealPreferences, PlannedSlot } from '../../types/meals'
import { Icon } from '../Icon'
import { formatVnd } from '../budget/format'
import { formatQuantity, slotLabels } from './labelsVi'
import { RecipeDetails } from './RecipeDetails'

const portionOptions = Array.from({ length: maxServings * 2 }, (_, index) => (index + 1) / 2)
const pageSize = 12
function DishCard({ recipe, selected, pending, onToggle, onDetails }: {
  recipe: CatalogRecipe; selected: boolean; pending: boolean; onToggle: () => void; onDetails: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const amount = mealMetrics([recipe], 1).cost
  const art = (dishArt as Partial<Record<string, { file: string; kind: string }>>)[recipe.id]
  return (
    <li className="dish-card">
      <h3>
        <button className="dish-detail-trigger" type="button" aria-haspopup="dialog" onClick={onDetails}>
          <span className="dish-card-art" data-category={dishCategory(recipe)}>
            {art && !imageFailed ? <>
              <img src={import.meta.env.BASE_URL + art.file} alt="" width="640" height="400" loading="lazy"
                decoding="async" onError={() => setImageFailed(true)} />
              {art.kind === 'illustration' && <span className="dish-art-label">Minh họa</span>}
            </> : <>
              <span className="dish-plate" aria-hidden="true"><Icon name="brand" /></span>
              <span className="dish-art-label">Ảnh chưa có</span>
            </>}
          </span>
          <span className="dish-card-name">{recipe.name}</span>
        </button>
      </h3>
      <div className="dish-card-content">
        <p>{amount === null ? 'Chưa có giá' : `${formatVnd(amount)} ước tính`}</p>
        <button type="button" className="button button-secondary dish-add" disabled={pending} aria-pressed={selected}
          aria-label={selected ? `Bỏ ${recipe.name}` : `Thêm ${recipe.name}`} onClick={onToggle}>{selected ? 'Bỏ' : 'Thêm'}</button>
      </div>
    </li>
  )
}

function DishDetails({ recipe, close }: { recipe: CatalogRecipe; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog lang="vi" className="dish-dialog" aria-labelledby="dish-dialog-name" onClose={close} ref={dialog}>
      <div className="dish-dialog-header">
        <h2 id="dish-dialog-name">{recipe.name}</h2>
        <button type="button" autoFocus className="button button-secondary" onClick={() => dialog.current?.close()}>Đóng</button>
      </div>
      <RecipeDetails dishes={[recipe]} servings={1} standalone />
    </dialog>
  )
}

export function SlotMealPicker({ slot, allowance, preferences, pending, opensShopping, onSave }: {
  slot: PlannedSlot; allowance: number; preferences: MealPreferences; pending: boolean
  opensShopping: boolean
  onSave: (next: PlannedSlot) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<{ base: PlannedSlot; entries: DishEntry[] }>()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<DishCategory | 'all'>('all')
  const [limit, setLimit] = useState(pageSize)
  const [detail, setDetail] = useState<CatalogRecipe>()
  const entries = draft?.entries ?? dishEntries(slot)
  const next = applyDishEntries({ ...slot, active: entries.length > 0 || slot.active }, entries)
  const total = selectedValue(next)
  const stale = !!draft && (!sameDishes(draft.base, slot) || draft.base.active !== slot.active)
  const dirty = !sameDishes(next, slot) || next.active !== slot.active
  const unfit = entries.some(({ recipeId }) => {
    const recipe = recipeById.get(recipeId)
    return !recipe || !allowsRecipe(recipe, preferences)
  })
  const matches = browseDishes(query, category, preferences)
  const list = query || category !== 'all' ? matches : [...matches].sort((a, b) =>
    Number(b.id === 'bun-rieu') - Number(a.id === 'bun-rieu') ||
    Number(dishArt[b.id as keyof typeof dishArt]?.kind === 'photo') - Number(dishArt[a.id as keyof typeof dishArt]?.kind === 'photo'))

  function change(updated: DishEntry[]) {
    setDraft({ base: draft?.base ?? slot, entries: updated })
  }

  return (
    <div className="dish-builder">
      {detail && <DishDetails recipe={detail} close={() => setDetail(undefined)} />}
      <section className="panel dish-summary" data-empty={!entries.length && !slot.recipeIds.length} aria-labelledby="dish-summary">
        <div className="meal-selection-summary">
          <h2 id="dish-summary">{slotLabels[slot.slot]}</h2>
          <p aria-live="polite">{entries.length} món{entries.length > 0 && ` · ${total === null ? 'Chưa đủ giá' : formatVnd(total) + ' ước tính'}`}</p>
        </div>
        {!!entries.length && <details className="meal-portion-settings">
          <summary>Khẩu phần đã chọn</summary>
          <ul className="dish-selected">{entries.map((entry) => {
            const name = recipeById.get(entry.recipeId)?.name ?? 'Món đã ngừng phục vụ'
            return (
              <li key={entry.recipeId}>
                <strong>{name}</strong>
                <div className="dish-portion">
                  <label className="meal-field">
                    <select aria-label={`Khẩu phần cho ${name}`} value={entry.servings} disabled={pending}
                      onChange={(event) => change(entries.map((item) => item === entry ? { ...entry, servings: Number(event.target.value) } : item))}>
                      {portionOptions.map((number) => <option key={number} value={number}>{formatQuantity(number)} phần</option>)}
                    </select>
                  </label>
                  <button type="button" className="meal-text-button" aria-label={`Bỏ ${name} khỏi bữa`} disabled={pending}
                    onClick={() => change(entries.filter((item) => item !== entry))}>Bỏ</button>
                </div>
              </li>
            )
          })}</ul>
        </details>}
        {!slot.active && slot.recipeIds.length > 0 && <p className="section-note">Bữa này đang tạm dừng.</p>}
        {total !== null && entries.length > 0 && total > allowance && <p className="meal-warning">Vượt khoản dành để lên món.</p>}
        {stale && <p className="meal-warning" role="alert">Bữa đã đổi ở thẻ khác.</p>}
        {dirty && unfit && <p className="meal-warning">Bỏ món đã ngừng phục vụ hoặc không phù hợp bộ lọc trước khi lưu.</p>}
        {(dirty || stale) && <div className="action-row dish-save">
          <button className="button" type="button" disabled={pending || stale || unfit}
            onClick={async () => {
              if (await onSave(next)) setDraft(undefined)
            }}>{!entries.length ? 'Xóa bữa' : opensShopping ? 'Lưu và xem chỗ mua' : !slot.active && slot.recipeIds.length > 0 ? 'Lưu và dùng bữa' : 'Lưu bữa ăn'}</button>
          {stale && <button className="meal-text-button" type="button" onClick={() => setDraft(undefined)}>Xem bữa đã lưu</button>}
        </div>}
      </section>
      <section className="dish-catalog" aria-label="Danh sách món ăn">
        <div className="dish-search">
          <label className="meal-field"><span>Tìm món</span>
            <input type="search" placeholder="Ví dụ bún riêu" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(pageSize) }} />
          </label>
          <label className="meal-field"><span>Nhóm món</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value as typeof category); setLimit(pageSize) }}>
              <option value="all">Tất cả</option>
              {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        {list.length ? <ul className="dish-grid">{list.slice(0, limit).map((recipe) => {
          const entry = entries.find(({ recipeId }) => recipeId === recipe.id)
          return <DishCard key={recipe.id} recipe={recipe} onDetails={() => setDetail(recipe)} pending={pending} selected={!!entry}
            onToggle={() => change(entry ? entries.filter((item) => item !== entry) : [...entries, { recipeId: recipe.id, servings: 1 }])} />
        })}</ul> : <p className="section-note dish-empty">Không tìm thấy món phù hợp.</p>}
        {list.length > limit && <button type="button" className="button button-secondary" onClick={() => setLimit(limit + pageSize)}>Xem thêm món</button>}
        <p className="dish-credits"><a href={import.meta.env.BASE_URL + 'dish-photos/credits.html'}>Nguồn ảnh</a></p>
      </section>
    </div>
  )
}
