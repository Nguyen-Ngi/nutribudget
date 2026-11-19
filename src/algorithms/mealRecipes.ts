import { ingredientLabels } from '../data/meals/ingredientLabelsVi.ts'
import { ingredients } from '../data/meals/ingredients.ts'
import type { IngredientId } from '../data/meals/ingredients.ts'
import { illustrativeNutrition } from '../data/meals/nutrition.ts'
import { illustrativePrices } from '../data/meals/prices.ts'
import { recipeById, legacyRecipes } from '../data/meals/recipes.ts'
import type { CatalogRecipe } from '../data/meals/recipes.ts'
import type { Ingredient, MealPreferences, MealSlot, Nutrition, Requirement } from '../types/meals.ts'

export const defaultPreferences: MealPreferences = {
  savings: 3, nutrition: 2, variety: 2, allergens: [], diet: 'any', equipment: null,
}

export type MealRequirements = Requirement<IngredientId>[]
export type RecipeCosts = Partial<Record<IngredientId, number>>

export function ingredientRequirements(dishes: readonly CatalogRecipe[], servings: number): MealRequirements {
  const quantities = new Map<IngredientId, number>()
  for (const dish of dishes) {
    for (const { ingredientId, quantity } of dish.ingredients) {
      quantities.set(ingredientId, (quantities.get(ingredientId) ?? 0) + quantity * servings)
    }
  }
  return Array.from(quantities, ([ingredientId, quantity]) => ({ ingredientId, quantity }))
}

function referencePrice(id: IngredientId) {
  const price = illustrativePrices[id]
  return price && Number.isSafeInteger(price.packQuantity) && price.packQuantity > 0 &&
    Number.isSafeInteger(price.packPriceVnd) && price.packPriceVnd >= 0 ? price : null
}

export function ingredientValue(requirements: readonly Requirement<IngredientId>[]) {
  let total = 0
  for (const { ingredientId, quantity } of requirements) {
    const price = referencePrice(ingredientId)
    if (!price) return null
    total += quantity * price.packPriceVnd / price.packQuantity
  }
  return Math.round(total)
}

export function extraPackCost(requirements: MealRequirements, planned: RecipeCosts) {
  let total = 0
  for (const { ingredientId, quantity } of requirements) {
    const price = referencePrice(ingredientId)
    if (!price) return null
    const base = planned[ingredientId] ?? 0
    const { packQuantity, packPriceVnd } = price
    total += (Math.ceil((base + quantity) / packQuantity) - Math.ceil(base / packQuantity)) * packPriceVnd
  }
  return total
}

export function reusablePackValue(requirements: MealRequirements, planned: RecipeCosts) {
  const reusable: MealRequirements = []
  for (const { ingredientId, quantity } of requirements) {
    const price = referencePrice(ingredientId)
    if (!price) return null
    const base = planned[ingredientId] ?? 0
    const { packQuantity } = price
    reusable.push({ ingredientId, quantity: Math.min(quantity, Math.ceil(base / packQuantity) * packQuantity - base) })
  }
  return ingredientValue(reusable)
}

export function recipeTags(dishes: readonly CatalogRecipe[]) {
  const used: Ingredient[] = dishes.flatMap((dish) => dish.ingredients.map(({ ingredientId }) => ingredients[ingredientId]))
  return {
    allergens: [...new Set(used.flatMap(({ allergens }) => allergens ?? []))],
    groups: [...new Set(used.map(({ group }) => group))],
    animalSources: [...new Set(used.flatMap(({ animal }) => animal ? [animal] : []))],
  }
}

export function allowsRecipe(dish: CatalogRecipe, preferences: MealPreferences) {
  const { allergens, animalSources } = recipeTags([dish])
  if (allergens.some((item) => preferences.allergens.includes(item))) return false
  if (preferences.equipment !== null && dish.equipment.some((item) => !preferences.equipment?.includes(item))) return false

  switch (preferences.diet) {
    case 'vegan': return animalSources.length === 0
    case 'vegetarian': return animalSources.every((animal) => animal === 'egg')
    case 'no pork': return !animalSources.includes('pork')
    case 'no beef': return !animalSources.includes('beef')
    default: return true
  }
}

export function resolveDishes(ids: readonly string[]): CatalogRecipe[] | null {
  const dishes = ids.map((id) => recipeById.get(id))
  return dishes.every((dish) => dish !== undefined) ? dishes : null
}

export function mealName(ids: readonly string[]) {
  const dishes = resolveDishes(ids)
  return dishes?.map(({ name }) => name).join(' + ') ?? 'Công thức không còn trong danh mục'
}

export function mealMetrics(dishes: readonly CatalogRecipe[], servings: number) {
  const requirements = ingredientRequirements(dishes, servings)
  const facts = dishes.map(({ id }) => illustrativeNutrition[id])
  const nutrition = facts.every((fact) => fact !== undefined)
    ? facts.reduce<Nutrition>((sum, fact) => ({
      calories: sum.calories + fact.calories,
      protein: sum.protein + fact.protein,
      carbs: sum.carbs + fact.carbs,
      fat: sum.fat + fact.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
    : null

  return {
    requirements,
    cost: ingredientValue(requirements),
    minutes: dishes.reduce((total, dish) => total + dish.minutes, 0),
    nutrition,
  }
}

export function combinations(slot: MealSlot, preferences: MealPreferences) {
  const eligible = legacyRecipes.filter((dish) => dish.mealTypes.includes(slot) && allowsRecipe(dish, preferences))
  if (slot === 'breakfast') return eligible.map((dish) => [dish])

  const starches = eligible.filter(({ role }) => role === 'starch')
  const mains = eligible.filter(({ role }) => role === 'main')
  const vegetables = eligible.filter(({ role }) => role === 'vegetable')
  return starches.flatMap((starch) => mains.flatMap((main) => vegetables.map((vegetable) => [starch, main, vegetable])))
}

export function combinationKey(dishes: readonly CatalogRecipe[]) {
  return dishes.map(({ id }) => id).join('+')
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
}

export function matchesMealSearch(dishes: readonly CatalogRecipe[], query: string) {
  const terms = normalizeSearch(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const text = normalizeSearch(dishes.flatMap((dish) => [
    dish.name,
    ...dish.ingredients.flatMap(({ ingredientId }) => [ingredientLabels[ingredientId], ingredients[ingredientId].name]),
  ]).join(' '))
  const words = text.split(/[^\p{L}\p{N}]+/u)
  return terms.every((term) => words.some((word) => word.startsWith(term)))
}
