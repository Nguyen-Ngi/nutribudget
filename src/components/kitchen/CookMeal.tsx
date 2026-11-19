import { cookingRequirements, cookingShortages } from '../../algorithms/kitchen'
import { mealName, resolveDishes } from '../../algorithms/mealRecipes'
import { formatDate } from '../budget/format'
import { RecipeDetails } from '../meals/RecipeDetails'
import { ingredientLabels, ingredientQuantity } from '../meals/labelsVi'
import type { CookingEvent, KitchenData } from '../../types/kitchen'
import type { PlannedSlot } from '../../types/meals'

export function CookingCard({ meal, kitchen, cooked, canCook, pending, onCook }: {
  meal: PlannedSlot; kitchen: KitchenData; cooked?: CookingEvent; canCook: boolean; pending: boolean; onCook: () => void
}) {
  if (cooked) {
    const dishes = resolveDishes(cooked.meal.recipeIds)
    return (
      <section className="panel kitchen-panel cooking-card" id="meal-cooking" tabIndex={-1}>
        <h2>Đã nấu</h2>
        <p lang="vi"><strong>{mealName(cooked.meal.recipeIds)}</strong></p>
        <p className="section-note">{formatDate(cooked.date)} · {cooked.meal.dishPortions ? `${cooked.meal.recipeIds.length} món` : `${cooked.meal.servings} phần`} · Đã trừ nguyên liệu</p>
        <p className="section-note">Bữa đã nấu không thể chỉnh sửa.</p>
        {dishes && <RecipeDetails dishes={dishes} servings={cooked.meal.servings} dishPortions={cooked.meal.dishPortions} />}
        <a href="#pantry" className="button button-secondary">Xem lịch sử tủ thực phẩm</a>
      </section>
    )
  }
  const required = cookingRequirements(meal)
  if (!meal.active || !required) return null
  const missing = cookingShortages(required, kitchen)
  return (
    <section className="panel kitchen-panel cooking-card" id="meal-cooking" tabIndex={-1}>
      <h2>Nấu ăn</h2>
      {!canCook ? <p className="section-note">Có thể xác nhận nấu từ ngày bắt đầu kỳ ngân sách.</p> :
        missing.length ? (
          <>
            <p className="section-note">Cần bổ sung nguyên liệu</p>
            <ul className="cooking-shortages">
              {missing.map(({ ingredientId, quantity }) => (
                <li key={ingredientId}><span>{ingredientLabels[ingredientId]}</span><strong>{ingredientQuantity(ingredientId, quantity)}</strong></li>
              ))}
            </ul>
            <div className="action-row">
              <a className="button button-secondary" href="#shopping">Mua sắm</a>
              <a className="button button-secondary" href="#pantry">Cập nhật tủ thực phẩm</a>
            </div>
          </>
        ) : (
          <>
            <button className="button button-secondary" type="button" onClick={onCook} disabled={pending}>Xác nhận đã nấu</button>
          </>
        )}
    </section>
  )
}
