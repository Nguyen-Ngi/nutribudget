import type { ReactNode } from 'react'
import type { PageId } from '../types/navigation'

type IconName = PageId | 'brand' | 'arrow'

const artwork: Record<IconName, ReactNode> = {
  brand: <><path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M12 12c0-5 3-8 8-8 0 5-3 8-8 8Zm0 0c0-4-2-6-6-6 0 4 2 6 6 6Z"/></>,
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></>,
  budget: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M21 10h-5a2 2 0 0 0 0 4h5"/></>,
  meals: <><path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18m12 0V3c-3 1-5 5-5 9h5"/></>,
  shopping: <><path d="M4 8h16l-1.5 12h-13L4 8Zm4 0 2-4m6 4-2-4M9 12v4m6-4v4"/></>,
  pantry: <><path d="M8 7h8m-9 5h10m-10-9h10v4l1 3v10H6V10l1-3V3Z"/></>,
  arrow: <path d="M4.5 12h14m-5.5-5.5 5.5 5.5-5.5 5.5"/>,
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {artwork[name]}
    </svg>
  )
}
