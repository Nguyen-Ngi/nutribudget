import type { KitchenData } from './kitchen.ts'

export interface CarryOver {
  fromPeriodId: string
  amount: number
  estimated: boolean
}

export interface BudgetSettings {
  startingAmount: number
  duration: number
  startDate: string
  buffer: { percentage: number } | null
}

export interface BudgetPeriod extends BudgetSettings {
  id: string
  status: 'open' | 'closed'
  closedOn?: string
  carryOver: CarryOver | null
}

export interface ExpenseTransaction {
  id: string
  budgetPeriodId: string
  amount: number
  date: string
  category: 'groceries'
  priceStatus: 'estimated' | 'verified'
  source: { type: 'manual'; reference?: string } | { type: 'shopping-purchase'; reference: string }
}

export interface BudgetData {
  version: 1
  periods: BudgetPeriod[]
  transactions: ExpenseTransaction[]
  kitchen?: KitchenData
}
