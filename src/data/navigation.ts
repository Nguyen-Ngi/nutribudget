import type { WorkspaceSection } from '../types/navigation'

export const workspaceSections: readonly WorkspaceSection[] = [
  {
    id: 'budget',
    label: 'Ngân sách',
    description: 'Đặt ngân sách và theo dõi số tiền còn lại để nấu ăn.',
  },
  {
    id: 'meals',
    label: 'Món ăn',
    description: 'Lên thực đơn theo ngân sách.',
  },
  {
    id: 'shopping',
    label: 'Mua sắm',
    description: 'So sánh các lựa chọn mua nguyên liệu.',
  },
  {
    id: 'pantry',
    label: 'Tủ thực phẩm',
    description: 'Xem nguyên liệu đang có.',
  },
]
