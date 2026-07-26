export const THEME_STORAGE_KEY = 'youtube-studio-theme-v1'
export const THEME_PREFERENCES = ['system', 'dark', 'light']

export function isThemePreference(value) {
  return THEME_PREFERENCES.includes(value)
}

export function getStoredThemePreference() {
  if (typeof window === 'undefined') return 'dark'

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference, systemTheme = getSystemTheme()) {
  return preference === 'system' ? systemTheme : preference
}

export function persistThemePreference(preference) {
  if (typeof window === 'undefined' || !isThemePreference(preference)) return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The theme still changes for the current page when storage is unavailable.
  }
}

export function applyResolvedTheme(theme) {
  if (typeof document === 'undefined') return
  const resolved = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}
