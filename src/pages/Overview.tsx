import { resolveHome } from '../algorithms/home'
import { Icon } from '../components/Icon'
import { formatVnd } from '../components/budget/format'
import { useMealPlans } from '../hooks/useMealPlans'
import type { BudgetData } from '../types/budget'

export function Overview({ data, today, budgetWarning }: { data: BudgetData; today: string; budgetWarning?: string }) {
  const meals = useMealPlans()
  const next = resolveHome(data, meals.data, today)
  const budget = 'budget' in next ? next.budget : null
  const expired = next.kind === 'expired'

  const [label, href] = budgetWarning ? ['Mở ngân sách', '#budget'] :
    !budget ? expired ? ['Mở kỳ mới', '#budget/new'] : ['Thiết lập ngân sách', '#budget'] :
    meals.warning ? ['Xem lại món ăn', '#meals'] :
    next.kind === 'review' ? ['Xem lại món ăn', next.href] :
    !budget.selectedDishes ? ['Chọn món ăn', '#meals'] :
    budget.hasShoppingPlan ? ['Tiếp tục mua sắm', '#shopping'] :
    ['Xem phương án mua', '#shopping/compare']

  return (
    <div className="home">
      {meals.warning && <p role="status" className="storage-warning">{meals.warning}</p>}
      <section className="home-feature" aria-labelledby="home-title">
        <div className="home-copy">
          <p className="home-eyebrow">NutriBudget</p>
          <h1 id="home-title">Ăn ngon mỗi ngày, chi tiêu nhẹ nhàng.</h1>
          <p className="home-intro">Lên thực đơn theo ngân sách và lựa chọn nơi mua nguyên liệu phù hợp.</p>
          <a className="button home-action" href={href}>{label}<Icon name="arrow" /></a>
        </div>
        <figure className="home-art">
          <img src={import.meta.env.BASE_URL + 'home/pho-nam-phong-bui.jpg'} width="1400" height="933"
            fetchPriority="high" alt="Tô phở với rau thơm và đũa tre trên bàn gỗ sáng" />
          <figcaption>Ảnh của <a href="https://www.pexels.com/photo/pho-soup-noodles-in-white-ceramic-bowl-4153908/">Nam Phong Bùi</a> · Pexels</figcaption>
        </figure>
      </section>

      {budget ? (
        <section className="home-summary" aria-labelledby="home-summary-title">
          <h2 id="home-summary-title">Kế hoạch của bạn</h2>
          <dl className="home-summary-values">
            <div>
              <dt>Ngân sách còn lại{budget.totals.balanceEstimated ? ' · Ước tính' : ''}</dt>
              <dd className={budget.totals.remaining < 0 ? 'negative' : undefined}>{formatVnd(budget.totals.remaining)}</dd>
            </div>
            <div>
              <dt>Món đã chọn</dt>
              <dd>{meals.warning ? 'Chưa đọc được' : budget.selectedDishes}</dd>
            </div>
            <div>
              <dt>Bước tiếp theo</dt>
              <dd>{label}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="home-summary home-onboarding" aria-labelledby="home-summary-title">
          <h2 id="home-summary-title">{budgetWarning ? 'Kiểm tra ngân sách' : expired ? 'Kỳ ngân sách đã kết thúc' : 'Bắt đầu với ngân sách'}</h2>
          <p>{budgetWarning ? 'Mở trang Ngân sách để xem dữ liệu đã lưu.' :
            expired ? 'Mở kỳ mới để tiếp tục lên thực đơn và theo dõi chi phí.' :
            'Đặt số tiền và thời gian bạn muốn dành cho các bữa nấu tại nhà.'}</p>
        </section>
      )}
    </div>
  )
}
