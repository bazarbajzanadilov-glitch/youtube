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
import { useVideos } from './storage/useVideos.js'
import {
  applyResolvedTheme,
  getStoredThemePreference,
  getSystemTheme,
  isThemePreference,
  persistThemePreference,
  resolveTheme,
} from './theme/theme.js'

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
  { key: 'audio', route: 'audio-library', name: 'Creator Music (beta)', Component: Screen9AudioLibrary },
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

const EXPANDED_SIDEBAR_MIN_WIDTH = 1200

function normalizeHashRoute() {
  if (new URLSearchParams(window.location.search).get('adminSetup') === '1') return 'admin'
  const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard'
  return ROUTE_ALIASES[raw] || raw
}

function getScreenByRoute(route) {
  return SCREENS.find((screen) => screen.route === route) || SCREENS[0]
}

function shouldStartExpanded() {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= EXPANDED_SIDEBAR_MIN_WIDTH
}

export default function App() {
  const { loading: projectLoading, error: projectError, refetch } = useVideos()
  const [route, setRoute] = useState(() => normalizeHashRoute())
  const [toast, setToast] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => shouldStartExpanded())
  const [themePreference, setThemePreferenceState] = useState(() => getStoredThemePreference())
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme())
  const toastTimer = useRef(null)
  const current = getScreenByRoute(route)
  const Current = current.Component
  const resolvedTheme = resolveTheme(themePreference, systemTheme)

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  const toggleSidebar = useCallback(() => setSidebarExpanded((v) => !v), [])

  const setThemePreference = useCallback((preference) => {
    if (!isThemePreference(preference)) return
    persistThemePreference(preference)
    setThemePreferenceState(preference)
  }, [])

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

  useEffect(() => {
    const onResize = () => {
      setSidebarExpanded(window.innerWidth >= EXPANDED_SIDEBAR_MIN_WIDTH)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [route])

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener?.('change', handleChange)
    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  const contextValue = useMemo(
    () => ({
      go,
      showToast,
      route,
      current,
      sidebarExpanded,
      toggleSidebar,
      themePreference,
      resolvedTheme,
      setThemePreference,
    }),
    [
      go,
      showToast,
      route,
      current,
      sidebarExpanded,
      toggleSidebar,
      themePreference,
      resolvedTheme,
      setThemePreference,
    ],
  )

  const sidebarWidth = sidebarExpanded ? 'var(--studio-sidebar-expanded-width)' : 'var(--studio-sidebar-compact-width)'

  if (projectLoading || projectError) {
    return (
      <div className={styles.dataState}>
        <div className={styles.dataStateCard}>
          <div className={styles.dataStateMark}>YT</div>
          <h1>{projectLoading ? 'Загружаем данные Studio…' : 'Данные временно недоступны'}</h1>
          <p>
            {projectLoading
              ? 'Получаем канал, видео и аналитику из Supabase.'
              : projectError}
          </p>
          {projectError ? <button type="button" onClick={refetch}>Повторить</button> : null}
        </div>
      </div>
    )
  }

  return (
    <NavContext.Provider value={contextValue}>
      <div className={styles.app} style={{ '--studio-current-sidebar-width': sidebarWidth }}>
        {toast ? <div className={styles.toast} role="status">{toast}</div> : null}
        <Current />
      </div>
    </NavContext.Provider>
  )
}
