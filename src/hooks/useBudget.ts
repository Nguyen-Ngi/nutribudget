import { useEffect, useState } from 'react'
import { localDate } from '../algorithms/calendar'
import { budgetStorageKey, readBudget, updateBudget } from '../data/budgetStorage'
import type { BudgetData } from '../types/budget'

export function useBudget() {
  const [snapshot, setSnapshot] = useState(readBudget)
  const [today, setToday] = useState(() => localDate())

  useEffect(() => {
    function syncStorage(event: StorageEvent) {
      if (event.key === budgetStorageKey || event.key === null) setSnapshot(readBudget())
    }
    function syncDate() {
      setToday(localDate())
    }
    const timer = window.setInterval(syncDate, 30_000)
    window.addEventListener('storage', syncStorage)
    window.addEventListener('focus', syncDate)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', syncStorage)
      window.removeEventListener('focus', syncDate)
    }
  }, [])

  async function commit(update: (data: BudgetData) => BudgetData) {
    try {
      await updateBudget(update)
    } finally {
      setSnapshot(readBudget())
    }
  }

  return { ...snapshot, today, commit }
}
