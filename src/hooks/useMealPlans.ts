import { useEffect, useState } from 'react'
import { mealStorageKey, readMealPlans, saveMealPlans } from '../data/meals/mealStorage'
import type { MealPlanData } from '../types/meals'

export function useMealPlans() {
  const [snapshot, setSnapshot] = useState(readMealPlans)

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === mealStorageKey || event.key === null) setSnapshot(readMealPlans())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  async function commit(update: (data: MealPlanData) => MealPlanData) {
    try {
      await saveMealPlans(update)
    } finally {
      setSnapshot(readMealPlans())
    }
  }

  return { ...snapshot, commit }
}
