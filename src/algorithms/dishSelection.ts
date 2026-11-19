import { ingredientValue, resolveDishes } from './mealRecipes.ts'
import type { MealRequirements } from './mealRecipes.ts'
import type { IngredientId } from '../data/meals/ingredients.ts'
import type { PlannedSlot } from '../types/meals.ts'

export const maxServings = 12
export const maxDishes = 70
export type DishEntry = { recipeId: string; servings: number }

export function dishEntries(meal: PlannedSlot): DishEntry[] {
  return meal.recipeIds.map((recipeId, index) => ({ recipeId, servings: meal.dishPortions?.[index] ?? meal.servings }))
}

export function validDishSelection(ids: unknown, portions: unknown) {
  return Array.isArray(ids) && ids.length <= maxDishes &&
    ids.every((id) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) &&
    new Set(ids).size === ids.length && (portions === undefined ||
      (Array.isArray(portions) && portions.length === ids.length && portions.every((portion) =>
        typeof portion === 'number' && Number.isInteger(portion * 2) && portion >= .5 && portion <= maxServings)))
}

export function sameDishes(a: PlannedSlot, b: PlannedSlot) {
  return JSON.stringify(dishEntries(a)) === JSON.stringify(dishEntries(b))
}

export function selectedRequirements(meal: PlannedSlot): MealRequirements | null {
  const dishes = resolveDishes(meal.recipeIds)
  if (!dishes) return null
  const totals = new Map<IngredientId, number>()
  dishes.forEach((dish, index) => {
    const servings = meal.dishPortions?.[index] ?? meal.servings
    for (const { ingredientId, quantity } of dish.ingredients) {
      totals.set(ingredientId, (totals.get(ingredientId) ?? 0) + quantity * servings)
    }
  })
  // Pantry uses whole grams, milliliters and pieces. Round once per ingredient per meal.
  return [...totals].map(([ingredientId, quantity]) => ({ ingredientId, quantity: Math.ceil(quantity) }))
}

export function selectedValue(meal: PlannedSlot) {
  const requirements = selectedRequirements(meal)
  return requirements ? ingredientValue(requirements) : null
}

export function applyDishEntries(slot: PlannedSlot, entries: readonly DishEntry[]): PlannedSlot {
  return { ...slot, recipeIds: entries.map(({ recipeId }) => recipeId), dishPortions: entries.map(({ servings }) => servings) }
}
