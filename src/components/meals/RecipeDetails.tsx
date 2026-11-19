import { ingredientRequirements, recipeTags } from '../../algorithms/mealRecipes'
import { illustrativeNutrition } from '../../data/meals/nutrition'
import type { CatalogRecipe } from '../../data/meals/recipes'
import type { Nutrition } from '../../types/meals'
import { allergenLabels, animalLabels, equipmentLabels, foodGroupLabels, formatQuantity, ingredientLabels, ingredientQuantity } from './labelsVi'

function NutritionLine({ facts }: { facts: Nutrition | null | undefined }) {
  if (!facts) return <p className="meal-nutrition">Chưa có dữ liệu dinh dưỡng</p>
  return (
    <p className="meal-nutrition">
      <span>{formatQuantity(facts.calories)} kcal</span><span>{formatQuantity(facts.protein)} g đạm</span>
      <span>{formatQuantity(facts.carbs)} g tinh bột</span><span>{formatQuantity(facts.fat)} g chất béo</span>
    </p>
  )
}

export function RecipeDetails({ dishes, servings, dishPortions, standalone }: {
  dishes: CatalogRecipe[]; servings: number; dishPortions?: number[]; standalone?: boolean
}) {
  const SectionHeading = standalone ? 'h3' : 'h5'
  const content = (
    <div className="recipe-detail-body">
      {dishes.map((dish, index) => {
        const portion = dishPortions?.[index] ?? servings
        const tags = recipeTags([dish])
        return (
          <section key={dish.id} className="recipe-method">
            {!standalone && <h4>{dish.name}</h4>}
            <p>{dish.minutes} phút · {dish.difficulty === 'easy' ? 'Dễ' : 'Vừa'} · {dish.equipment.map((item) => equipmentLabels[item]).join(', ')}</p>
            <SectionHeading>Nguyên liệu cho {formatQuantity(portion)} phần</SectionHeading>
            <ul className="recipe-ingredient-list">
              {ingredientRequirements([dish], portion).map(({ ingredientId, quantity }) => (
                <li key={ingredientId}><span>{ingredientLabels[ingredientId]}</span><span>{ingredientQuantity(ingredientId, quantity)}</span></li>
              ))}
            </ul>
            <SectionHeading>Cách nấu</SectionHeading>
            <ol>{dish.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
            <SectionHeading>Thông tin dinh dưỡng</SectionHeading>
            <p>Ước tính cho một phần</p>
            <NutritionLine facts={illustrativeNutrition[dish.id]} />
            <p>Nhóm thực phẩm · {tags.groups.map((group) => foodGroupLabels[group]).join(', ')}</p>
            <p>{tags.animalSources.length ? 'Nguồn động vật · ' + tags.animalSources.map((source) => animalLabels[source]).join(', ') : 'Nguyên liệu có nguồn gốc thực vật'}</p>
            <p>{tags.allergens.length ? 'Có thành phần gây dị ứng · ' + tags.allergens.map((allergen) => allergenLabels[allergen]).join(', ') :
              'Danh mục chưa ghi nhận thành phần gây dị ứng'}</p>
          </section>
        )
      })}
    </div>
  )
  return standalone ? content : (
    <details className="recipe-details" lang="vi">
      <summary>Xem công thức</summary>
      {content}
    </details>
  )
}
