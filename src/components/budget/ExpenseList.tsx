import type { ExpenseTransaction } from '../../types/budget'
import { formatDate, formatVnd } from './format'

export function ExpenseList({ expenses }: { expenses: ExpenseTransaction[] }) {
  if (!expenses.length) return <p className="section-note">Kỳ này chưa có khoản chi mua nguyên liệu.</p>

  return (
    <ul className="expense-list" aria-label="Các khoản chi mua nguyên liệu">
      {[...expenses].reverse().map((expense) => (
        <li key={expense.id}>
          <div>
            <strong>{expense.source.type === 'shopping-purchase' ? 'Mua theo danh sách' : 'Mua nguyên liệu'}</strong>
            <span><time dateTime={expense.date}>{formatDate(expense.date)}</time> · {expense.priceStatus === 'estimated' ? 'Ước tính' : 'Số tiền thực trả'}</span>
          </div>
          <strong>{formatVnd(expense.amount)}</strong>
        </li>
      ))}
    </ul>
  )
}
