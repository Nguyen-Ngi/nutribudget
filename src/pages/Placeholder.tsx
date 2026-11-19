import { Icon } from '../components/Icon'
import type { WorkspaceSection } from '../types/navigation'

export function Placeholder({ section }: { section: WorkspaceSection }) {
  return (
    <section className="placeholder" aria-labelledby="section-heading">
      <span className="section-icon"><Icon name={section.id} /></span>
      <h1 id="section-heading">{section.label}</h1>
      <p>{section.description}</p>
      <p className="placeholder-status">Tính năng sẽ có ở phiên bản sau.</p>
      <a className="back-link" href="#overview">Về trang chủ</a>
    </section>
  )
}
