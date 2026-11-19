import { useSyncExternalStore } from 'react'
import { workspaceSections } from '../data/navigation'
import type { PageId } from '../types/navigation'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getPage(): PageId | 'budget/new' | 'shopping/compare' | `meals?${string}` {
  const fragment = window.location.hash.slice(1)
  if (fragment === 'budget/new' || fragment === 'shopping/compare') return fragment
  if (fragment.startsWith('meals?')) return fragment as `meals?${string}`
  return workspaceSections.find(({ id }) => id === fragment)?.id ?? 'overview'
}

export function usePage() {
  return useSyncExternalStore(subscribe, getPage)
}
