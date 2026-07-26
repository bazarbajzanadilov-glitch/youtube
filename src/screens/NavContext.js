import { createContext } from 'react'

export const NavContext = createContext({
  go: () => {},
  showToast: () => {},
  route: 'dashboard',
  current: null,
  sidebarExpanded: false,
  toggleSidebar: () => {},
  themePreference: 'dark',
  resolvedTheme: 'dark',
  setThemePreference: () => {},
})
