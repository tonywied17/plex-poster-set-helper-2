import { createContext, useContext } from 'react'
import type { NavTab } from './App'

interface AppContextValue {
  navigate: (tab: NavTab) => void
  plexConnected: boolean
}

export const AppContext = createContext<AppContextValue>({
  navigate: () => {},
  plexConnected: false,
})

/** Accesses the shared app context. */
export function useAppContext() {
  return useContext(AppContext)
}
