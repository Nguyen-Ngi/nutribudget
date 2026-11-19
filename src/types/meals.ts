export const mealSlots = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = typeof mealSlots[number]
export type DishRole = 'breakfast' | 'starch' | 'main' | 'vegetable'
export type Unit = 'g' | 'ml' | 'each'
export type FoodGroup = 'grains' | 'protein' | 'vegetables' | 'fruit' | 'fats' | 'seasoning'
export type AnimalSource = 'egg' | 'fish' | 'shellfish' | 'pork' | 'chicken' | 'beef'
export const allergens = ['eggs', 'fish', 'shellfish', 'soy', 'wheat', 'peanuts'] as const
export type Allergen = typeof allergens[number]
export const equipment = ['stovetop', 'pot', 'skillet', 'knife', 'rice cooker'] as const
export type Equipment = typeof equipment[number]
export type Diet = 'any' | 'vegetarian' | 'vegan' | 'no pork' | 'no beef'

export interface Ingredient {
  name: string
  unit: Unit
  group: FoodGroup
  allergens?: readonly Allergen[]
  animal?: AnimalSource
}

export interface IngredientPrice {
  packQuantity: number
  packPriceVnd: number
}

export interface Requirement<Id extends string = string> {
  ingredientId: Id
  quantity: number
}

export interface Recipe<Id extends string = string> {
  id: string
  name: string
  role: DishRole
  mealTypes: readonly MealSlot[]
  ingredients: readonly Requirement<Id>[]
  minutes: number
  difficulty: 'easy' | 'moderate'
  equipment: readonly Equipment[]
  instructions: readonly string[]
}

export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MealPreferences {
  savings: number
  nutrition: number
  variety: number
  allergens: Allergen[]
  diet: Diet
  equipment: Equipment[] | null
}

export interface SlotKey {
  date: string
  slot: MealSlot
}

export interface PlannedSlot extends SlotKey {
  active: boolean
  servings: number
  recipeIds: string[]
  dishPortions?: number[]
}

export interface PeriodMealPlan {
  budgetPeriodId: string
  slots: PlannedSlot[]
}

export interface MealPlanData {
  version: 1
  periods: PeriodMealPlan[]
}
