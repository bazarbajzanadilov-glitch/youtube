import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import styles from './App.module.css'
import { NavContext } from './screens/NavContext.js'
import Screen1Dashboard from './screens/Screen1Dashboard.jsx'
import Screen2Content from './screens/Screen2Content.jsx'
import Screen3Analytics from './screens/Screen3Analytics.jsx'
import Screen4Community from './screens/Screen4Community.jsx'
import Screen5Subtitles from './screens/Screen5Subtitles.jsx'
import Screen6Copyright from './screens/Screen6Copyright.jsx'
import Screen7Monetization from './screens/Screen7Monetization.jsx'
import Screen8aProfile from './screens/Screen8aProfile.jsx'
import Screen8bHomeTab from './screens/Screen8bHomeTab.jsx'
import Screen9AudioLibrary from './screens/Screen9AudioLibrary.jsx'
import Screen10Settings from './screens/Screen10Settings.jsx'
import Screen11Admin from './screens/Screen11Admin.jsx'
import { continueDoubleHardResetIfNeeded } from './lib/hardResetSite.js'

const SCREENS = [
  { key: 'home', route: 'dashboard', name: 'Панель управления каналом', Component: Screen1Dashboard },
  { key: 'content', route: 'content', name: 'Контент', Component: Screen2Content },
  { key: 'analytics', route: 'analytics', name: 'Аналитика', Component: Screen3Analytics },
  { key: 'community', route: 'community', name: 'Сообщество', Component: Screen4Community },
  { key: 'subtitles', route: 'subtitles', name: 'Субтитры', Component: Screen5Subtitles },
  { key: 'copyright', route: 'copyright', name: 'Обнаружение контента', Component: Screen6Copyright },
  { key: 'monetize', route: 'monetization', name: 'Монетизация', Component: Screen7Monetization },
  { key: 'channel', route: 'channel-profile', name: 'Настройка канала: профиль', Component: Screen8aProfile },
  { key: 'channel-home', route: 'channel-home', name: 'Настройка канала: главная', Component: Screen8bHomeTab },
  { key: 'audio', route: 'audio-library', name: 'Фонотека', Component: Screen9AudioLibrary },
  { key: 'settings', route: 'settings', name: 'Настройки', Component: Screen10Settings },
  { key: 'admin', route: 'admin', name: 'Админка', Component: Screen11Admin },
]

const ROUTE_ALIASES = {
  dashboard: 'dashboard',
  home: 'dashboard',
  monetize: 'monetization',
  monetization: 'monetization',
  'channel-profile': 'channel-profile',
  channel: 'channel-profile',
  'channel-home': 'channel-home',
  audio: 'audio-library',
  'audio-library': 'audio-library',
  settings: 'settings',
  admin: 'admin',
}

function normalizeHashRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard'
  return ROUTE_ALIASES[raw] || raw
}

function getScreenByRoute(route) {
  return SCREENS.find((screen) => screen.route === route) || SCREENS[0]
}

export default function App() {
  const [route, setRoute] = useState(() => normalizeHashRoute())
  const [toast, setToast] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const toastTimer = useRef(null)
  const current = getScreenByRoute(route)
  const Current = current.Component

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  const toggleSidebar = useCallback(() => setSidebarExpanded((v) => !v), [])

  const go = useCallback((keyOrRoute) => {
    const target = SCREENS.find((screen) => screen.key === keyOrRoute || screen.route === keyOrRoute)
    const nextRoute = target?.route || ROUTE_ALIASES[keyOrRoute]
    if (!nextRoute) return
    if (window.location.hash !== `#/${nextRoute}`) {
      window.location.hash = `#/${nextRoute}`
    } else {
      setRoute(nextRoute)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const onHashChange = () => setRoute(normalizeHashRoute())
    continueDoubleHardResetIfNeeded().catch(() => false).then((isResetting) => {
      if (cancelled || isResetting) return
      if (!window.location.hash) {
        window.location.replace('#/dashboard')
      }
      window.addEventListener('hashchange', onHashChange)
    })
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHashChange)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const contextValue = useMemo(() => ({ go, showToast, route, current, sidebarExpanded, toggleSidebar }), [go, showToast, route, current, sidebarExpanded, toggleSidebar])

  const sidebarWidth = sidebarExpanded ? 'var(--studio-sidebar-expanded-width)' : 'var(--studio-sidebar-compact-width)'

  return (
    <NavContext.Provider value={contextValue}>
      <div className={styles.app} style={{ '--studio-current-sidebar-width': sidebarWidth }}>
        {toast ? <div className={styles.toast} role="status">{toast}</div> : null}
        <Current />
      </div>
    </NavContext.Provider>
  )
}
