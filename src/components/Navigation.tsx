import { useEffect, useRef } from 'react'
import type { PageId } from '../types/navigation'
import { Icon } from './Icon'

const primary = [
  { id: 'overview', label: 'Trang chủ' },
  { id: 'meals', label: 'Món ăn' },
  { id: 'shopping', label: 'Mua sắm' },
] as const

export function Navigation({ page }: { page: PageId }) {
  const manage = useRef<HTMLDetailsElement>(null)
  const managing = page === 'budget' || page === 'pantry'

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !manage.current?.contains(event.target) && manage.current) {
        manage.current.open = false
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <header className="shell-header">
      <div className="shell-header-inner">
        <a className="brand" href="#overview" aria-label="Trang chủ NutriBudget">
          <span className="brand-mark"><Icon name="brand" /></span>NutriBudget
        </a>
        <div className="shell-navigation">
          <nav aria-label="Điều hướng chính">
            <ul className="navigation">
              {primary.map(({ id, label }) => (
                <li key={id}><a href={`#${id}`} aria-current={page === id ? 'page' : undefined}>{label}</a></li>
              ))}
            </ul>
          </nav>
          <details ref={manage} className="manage-nav" onKeyDown={(event) => {
            if (event.key === 'Escape' && manage.current?.open) {
              manage.current.open = false
              manage.current.querySelector('summary')?.focus()
            }
          }}>
            <summary aria-current={managing ? 'true' : undefined}>Quản lý<span aria-hidden="true" /></summary>
            <ul onClick={() => { if (manage.current) manage.current.open = false }}>
              <li><a href="#budget" aria-current={page === 'budget' ? 'page' : undefined}>Ngân sách</a></li>
              <li><a href="#pantry" aria-current={page === 'pantry' ? 'page' : undefined}>Tủ thực phẩm</a></li>
            </ul>
          </details>
        </div>
      </div>
    </header>
  )
}
