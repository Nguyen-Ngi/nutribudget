import type { BudgetData } from '../../types/budget'

export type KitchenCommit = (update: (data: BudgetData) => BudgetData) => Promise<void>
