import type { PageId } from './types/navigation'
import { useEffect, useRef } from 'react'
import { Navigation } from './components/Navigation'
import { useBudget } from './hooks/useBudget'
import { usePage } from './hooks/usePage'
import { Budget } from './pages/Budget'
import { Meals } from './pages/Meals'
import { Overview } from './pages/Overview'
import { Pantry } from './pages/Pantry'
import { Shopping } from './pages/Shopping'

export function App() {
  const route = usePage()
  const page = route === 'budget/new' ? 'budget' : route === 'shopping/compare' ? 'shopping' : route.startsWith('meals?') ? 'meals' : route as PageId
  const { data, today, warning, commit } = useBudget()
  const main = useRef<HTMLElement>(null)
  const previousRoute = useRef(route)

  useEffect(() => {
    if (previousRoute.current === route) return
    previousRoute.current = route
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [route])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        main.current?.focus()
      }}>
        Bỏ qua điều hướng
      </a>
      <Navigation page={page} />
      <main className="main-content" id="main-content" ref={main} tabIndex={-1}>
        <div className="content-frame">
          {warning && (page === 'overview' || page === 'budget') && <p className="storage-warning" role="status">{warning}</p>}
          {page === 'budget' ? <Budget key={route} data={data} today={today} startNew={route === 'budget/new'} commit={commit} /> :
            page === 'meals' ? <Meals key={route} target={route.startsWith('meals?') ? route.slice(6) : undefined} data={data} today={today} budgetWarning={warning} commitBudget={commit} /> :
            page === 'shopping' ? <Shopping key={route} startInComparison={route === 'shopping/compare'} data={data} today={today} warning={warning} commit={commit} /> :
            page === 'pantry' ? <Pantry data={data} warning={warning} commit={commit} /> : <Overview data={data} today={today} budgetWarning={warning} />}
        </div>
      </main>
    </div>
  )
}
