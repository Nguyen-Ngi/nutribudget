import { recipes } from '../data/meals/recipes.ts'
import type { CatalogRecipe } from '../data/meals/recipes.ts'
import { allowsRecipe, matchesMealSearch } from './mealRecipes.ts'
import type { MealPreferences } from '../types/meals.ts'

export const categories = {
  noodles: 'Bún, phở và mì', rice: 'Cơm và món tinh bột', main: 'Món chính',
  vegetable: 'Rau và canh', breakfast: 'Bữa sáng',
} as const
export type DishCategory = keyof typeof categories

export function dishCategory(recipe: CatalogRecipe): DishCategory {
  if (recipe.category) return recipe.category
  return recipe.role === 'starch' ? 'rice' : recipe.role
}

export function browseDishes(query: string, category: DishCategory | 'all', preferences: MealPreferences) {
  return recipes.filter((recipe) => (category === 'all' || dishCategory(recipe) === category) &&
    allowsRecipe(recipe, preferences) && matchesMealSearch([recipe], query))
}
