import { resolveHome } from '../algorithms/home'
import { mealName } from '../algorithms/mealRecipes'
import { Icon } from '../components/Icon'
import { formatDate, formatVnd } from '../components/budget/format'
import dishArt from '../data/meals/dishArt.json'
import { useMealPlans } from '../hooks/useMealPlans'
import type { BudgetData } from '../types/budget'

export function Overview({ data, today, budgetWarning }: { data: BudgetData; today: string; budgetWarning?: string }) {
  const meals = useMealPlans()
  const next = resolveHome(data, meals.data, today)
  const budget = 'budget' in next ? next.budget : null
  const meal = 'meal' in next ? next.meal : null
  const actions = {
    setup: ['Hôm nay nấu gì?', '', 'Thiết lập ngân sách', '#budget'],
    expired: ['Đã hết kỳ ngân sách', '', 'Mở kỳ mới', '#budget/new'],
    plan: ['Hôm nay nấu gì?', '', 'Chọn món', '#meals'],
    cooked: ['Bữa sau nấu gì?', '', 'Chọn món', '#meals'],
    review: ['Xem lại bữa sắp tới', 'Có công thức không còn trong danh mục.', 'Xem bữa ăn', 'href' in next ? next.href : '#meals'],
    shop: ['Mua nguyên liệu', '', 'So sánh giá', '#shopping'],
    scheduled: ['Đã đủ nguyên liệu', 'Bạn có thể xác nhận đã nấu khi kỳ ngân sách bắt đầu.', 'Xem bữa đã lưu', 'href' in next ? next.href : '#meals'],
    cook: ['Có thể nấu ngay', '', 'Xem bữa ăn', 'href' in next ? next.href : '#meals'],
  }
  const [title, description, label, href] = budgetWarning ? ['Kiểm tra dữ liệu đã lưu', '', 'Mở ngân sách', '#budget'] :
    meals.warning && budget ? ['Kiểm tra thực đơn', '', 'Mở thực đơn', '#meals'] : actions[next.kind]
  const shownMeal = budgetWarning || meals.warning ? null : meal
  const featuredId = shownMeal?.recipeIds[0] as keyof typeof dishArt | undefined
  const cover = (featuredId && dishArt[featuredId]) || dishArt['bun-rieu']

  return (
    <div className="home">
      {meals.warning && <p role="status" className="storage-warning">{meals.warning}</p>}
      <section className="home-feature" data-budget={!!budget}>
        <div className="home-copy">
          <h1>{title}</h1>
          {budget && <div className="home-budget" aria-label="Ngân sách nấu ăn">
            <p>{budget.totals.balanceEstimated ? 'Còn lại · Ước tính' : 'Còn lại'}</p>
            <strong className={budget.totals.remaining < 0 ? 'negative' : undefined}>{formatVnd(budget.totals.remaining)}</strong>
          </div>}
          {shownMeal && <p className="home-meal">{mealName(shownMeal.recipeIds)} · {formatDate(shownMeal.date)}</p>}
          {description && <p>{description}</p>}
          <a className="button home-action" href={href}>{label}<Icon name="arrow" /></a>
        </div>
        <div className="home-art">
          <img src={import.meta.env.BASE_URL + cover.file} width="640" height="400" alt="" />
          {cover.kind === 'illustration' && <span className="dish-art-label">Minh họa</span>}
        </div>
      </section>
    </div>
  )
}
