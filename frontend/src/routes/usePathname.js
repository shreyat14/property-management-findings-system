import { useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function getSnapshot() {
  return window.location.pathname
}

export function usePathname() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
