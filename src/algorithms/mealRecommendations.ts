import { combinationKey, combinations, defaultPreferences, extraPackCost, mealMetrics, recipeTags, reusablePackValue } from './mealRecipes.ts'
import type { CatalogRecipe } from '../data/meals/recipes.ts'
import type { RecipeCosts } from './mealRecipes.ts'
import type { MealPreferences, MealSlot } from '../types/meals.ts'

export function typicalMealCost(slot: MealSlot, eligible: CatalogRecipe[][]) {
  const estimates = (pool: CatalogRecipe[][]) => pool.map((dishes) => mealMetrics(dishes, 1).cost)
    .filter((cost) => cost !== null).sort((a, b) => a - b)
  const filtered = estimates(eligible)
  const costs = filtered.length ? filtered : estimates(combinations(slot, defaultPreferences))
  if (!costs.length) return 0
  return (costs[Math.floor((costs.length - 1) / 2)] + costs[Math.floor(costs.length / 2)]) / 2
}

export function rankMeals(
  candidates: CatalogRecipe[][],
  { slot, servings, allowance, otherIngredients, recentDishes, preferences }: {
    slot: MealSlot
    servings: number
    allowance: number | null
    otherIngredients: RecipeCosts
    recentDishes: readonly string[]
    preferences: MealPreferences
  },
) {
  const estimated = candidates.flatMap((dishes) => {
    const metrics = mealMetrics(dishes, servings)
    return metrics.cost === null ? [] : [{ dishes, ...metrics, cost: metrics.cost }]
  })
  const ceiling = Math.max(1, ...estimated.map(({ cost }) => cost))
  const frequency = new Map<string, number>()
  for (const id of recentDishes) frequency.set(id, (frequency.get(id) ?? 0) + 1)

  return estimated.map((meal) => {
    const leadingDish = meal.dishes.find(({ role }) => role === 'main' || role === 'breakfast') ?? meal.dishes[0]
    const repeats = frequency.get(leadingDish.id) ?? 0
    const savings = 1 - meal.cost / ceiling
    const coverage = meal.nutrition
      ? Math.min(1, meal.nutrition.protein / (slot === 'breakfast' ? 18 : 26)) * .65 +
        (recipeTags(meal.dishes).groups.includes('vegetables') ? .35 : 0)
      : 0
    const reuse = (reusablePackValue(meal.requirements, otherIngredients) ?? 0) / Math.max(1, meal.cost)

    return {
      ...meal,
      key: combinationKey(meal.dishes),
      leadingDish: leadingDish.id,
      extraPacks: extraPackCost(meal.requirements, otherIngredients),
      exceedsAllowance: allowance !== null && meal.cost > allowance,
      score: preferences.savings * savings + preferences.nutrition * coverage +
        preferences.variety / (1 + repeats) + reuse +
        (meal.dishes.length === 1 && leadingDish.mealTypes.includes(slot) ? .55 : 0),
    }
  }).sort((a, b) =>
    Number(a.exceedsAllowance) - Number(b.exceedsAllowance) ||
    b.score - a.score || a.cost - b.cost || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

export type RankedMeal = ReturnType<typeof rankMeals>[number]

export function recommendationShortlist(ranked: RankedMeal[]) {
  const shortlist: RankedMeal[] = []
  const mains = new Set<string>()
  // Keep within-allowance meals first while offering distinct main dishes where possible.
  for (const exceeds of [false, true]) {
    const group = ranked.filter((meal) => meal.exceedsAllowance === exceeds)
    for (const meal of group) {
      if (shortlist.length === 5) return shortlist
      if (mains.has(meal.leadingDish)) continue
      mains.add(meal.leadingDish)
      shortlist.push(meal)
    }
    for (const meal of group) {
      if (shortlist.length === 5) return shortlist
      if (!shortlist.includes(meal)) shortlist.push(meal)
    }
  }
  return shortlist
}
