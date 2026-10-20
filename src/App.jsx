import { lazy, Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import styles from './App.module.css'
import { NavContext } from './screens/NavContext.js'
import Screen1Dashboard from './screens/Screen1Dashboard.jsx'
// Тяжёлые экраны грузятся отдельными чанками; после старта догружаются в фоне,
// чтобы переход между разделами был мгновенным.
const SCREEN_LOADERS = {
  Screen2Content: () => import('./screens/Screen2Content.jsx'),
  Screen3Analytics: () => import('./screens/Screen3Analytics.jsx'),
  Screen4Community: () => import('./screens/Screen4Community.jsx'),
  Screen5Subtitles: () => import('./screens/Screen5Subtitles.jsx'),
  Screen6Copyright: () => import('./screens/Screen6Copyright.jsx'),
  Screen7Monetization: () => import('./screens/Screen7Monetization.jsx'),
  Screen8aProfile: () => import('./screens/Screen8aProfile.jsx'),
  Screen8bHomeTab: () => import('./screens/Screen8bHomeTab.jsx'),
  Screen9AudioLibrary: () => import('./screens/Screen9AudioLibrary.jsx'),
  Screen10Settings: () => import('./screens/Screen10Settings.jsx'),
  Screen11Admin: () => import('./screens/Screen11Admin.jsx'),
  Screen12VideoAnalytics: () => import('./screens/Screen12VideoAnalytics.jsx'),
}
const Screen2Content = lazy(SCREEN_LOADERS.Screen2Content)
const Screen3Analytics = lazy(SCREEN_LOADERS.Screen3Analytics)
const Screen4Community = lazy(SCREEN_LOADERS.Screen4Community)
const Screen5Subtitles = lazy(SCREEN_LOADERS.Screen5Subtitles)
const Screen6Copyright = lazy(SCREEN_LOADERS.Screen6Copyright)
const Screen7Monetization = lazy(SCREEN_LOADERS.Screen7Monetization)
const Screen8aProfile = lazy(SCREEN_LOADERS.Screen8aProfile)
const Screen8bHomeTab = lazy(SCREEN_LOADERS.Screen8bHomeTab)
const Screen9AudioLibrary = lazy(SCREEN_LOADERS.Screen9AudioLibrary)
const Screen10Settings = lazy(SCREEN_LOADERS.Screen10Settings)
const Screen11Admin = lazy(SCREEN_LOADERS.Screen11Admin)
const Screen12VideoAnalytics = lazy(SCREEN_LOADERS.Screen12VideoAnalytics)

function preloadScreens() {
  Object.values(SCREEN_LOADERS).forEach((load) => load().catch(() => {}))
}
import { VIDEO_ANALYTICS_ITEM_PREFIX } from './lib/videoPerformanceSection.js'
import { loadRemoteProject } from './data/projectStore.js'
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
  {
    key: 'home',
    route: 'dashboard',
    name: 'Панель управления каналом',
    documentTitle: 'Панель управления каналом - YouTube Studio',
    Component: Screen1Dashboard,
  },
  {
    key: 'content',
    route: 'content',
    name: 'Контент',
    documentTitle: 'Контент на канале - YouTube Studio',
    Component: Screen2Content,
  },
  {
    key: 'analytics',
    route: 'analytics',
    name: 'Аналитика',
    documentTitle: 'Аналитика по каналу - YouTube Studio',
    Component: Screen3Analytics,
  },
  {
    key: 'video-analytics-shorts',
    route: 'video-analytics/shorts',
    name: 'Аналитика видео Shorts',
    documentTitle: 'Аналитика видео - YouTube Studio',
    Component: Screen12VideoAnalytics,
  },
  {
    key: 'video-analytics-video',
    route: 'video-analytics/video',
    name: 'Аналитика видео',
    documentTitle: 'Аналитика видео - YouTube Studio',
    Component: Screen12VideoAnalytics,
  },
  {
    key: 'community',
    route: 'community',
    name: 'Сообщество',
    documentTitle: 'Сообщество - YouTube Studio',
    Component: Screen4Community,
  },
  {
    key: 'subtitles',
    route: 'subtitles',
    name: 'Субтитры',
    documentTitle: 'Субтитры - YouTube Studio',
    Component: Screen5Subtitles,
  },
  {
    key: 'copyright',
    route: 'copyright',
    name: 'Обнаружение контента',
    documentTitle: 'Обнаружение контента - YouTube Studio',
    Component: Screen6Copyright,
  },
  {
    key: 'monetize',
    route: 'monetization',
    name: 'Монетизация',
    documentTitle: 'Зарабатывай на YouTube - YouTube Studio',
    Component: Screen7Monetization,
  },
  {
    key: 'channel',
    route: 'channel-profile',
    name: 'Настройка канала: профиль',
    documentTitle: 'Настройки канала - YouTube Studio',
    Component: Screen8aProfile,
  },
  {
    key: 'channel-home',
    route: 'channel-home',
    name: 'Настройка канала: главная',
    documentTitle: 'Настройки канала - YouTube Studio',
    Component: Screen8bHomeTab,
  },
  {
    key: 'audio',
    route: 'audio-library',
    name: 'Creator Music (beta)',
    documentTitle: 'Creator Music - YouTube Studio',
    Component: Screen9AudioLibrary,
  },
  {
    key: 'settings',
    route: 'settings',
    name: 'Настройки',
    documentTitle: 'Настройки - YouTube Studio',
    Component: Screen10Settings,
  },
  {
    key: 'admin',
    route: 'admin',
    name: 'Админка',
    documentTitle: 'Админка - YouTube Studio',
    Component: Screen11Admin,
  },
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
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') return 'admin'
  const raw = window.location.hash.replace(/^#\/?/, '') || 'dashboard'
  return ROUTE_ALIASES[raw] || raw
}

function getScreenByRoute(route) {
  if (String(route).startsWith(VIDEO_ANALYTICS_ITEM_PREFIX)) {
    return SCREENS.find((screen) => screen.key === 'video-analytics-video')
  }
  return SCREENS.find((screen) => screen.route === route) || SCREENS[0]
}

function shouldStartExpanded() {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= EXPANDED_SIDEBAR_MIN_WIDTH
}

export default function App() {
  const { loading: projectLoading, error: projectError, refetch, revision: projectRevision } = useVideos()
  const [route, setRoute] = useState(() => normalizeHashRoute())
  const [toast, setToast] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => shouldStartExpanded())
  const [themePreference, setThemePreferenceState] = useState(() => getStoredThemePreference())
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme())
  const toastTimer = useRef(null)
  const current = getScreenByRoute(route)
  const Current = current.Component
  const resolvedTheme = resolveTheme(themePreference, systemTheme)
  const directAdminEntry = route === 'admin'
    && window.location.pathname.replace(/\/+$/, '') === '/admin'

  useEffect(() => {
    if (directAdminEntry) return
    loadRemoteProject().catch(() => {})
  }, [directAdminEntry])

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
      || (String(keyOrRoute).startsWith(VIDEO_ANALYTICS_ITEM_PREFIX) ? keyOrRoute : null)
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
      if (!window.location.hash && window.location.pathname.replace(/\/+$/, '') !== '/admin') {
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
    const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 1200))
    idle(preloadScreens)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [route])

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    document.title = current.documentTitle
  }, [current.documentTitle])

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

  // Экран загрузки — только пока данных ещё нет. Повторные загрузки идут
  // в фоне и не прячут открытую страницу.
  if (!directAdminEntry && !projectRevision && (projectLoading || projectError)) {
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
        <Suspense fallback={null}>
          <Current />
        </Suspense>
      </div>
    </NavContext.Provider>
  )
}
