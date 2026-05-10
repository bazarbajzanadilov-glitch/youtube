import { createRoot } from 'react-dom/client'
import './studio-tokens.css'
import './index.css'
import App from './App.jsx'
import { bootstrapFromFile } from './storage/videoStore.js'

bootstrapFromFile()

/**
 * Recharts ResponsiveContainer первый раз рендерит c containerWidth=-1 до
 * измерения через ResizeObserver, и пишет в console.warn. Чарт после этого
 * корректно перерендеривается с правильными размерами. Прячем именно этот шум,
 * чтобы не путать пользователя — все остальные warning'и остаются видимыми.
 */
const RECHARTS_NOISE_RE = /width\(-1\) and height\(-1\) of chart/i
const _origWarn = console.warn.bind(console)
console.warn = (...args) => {
  const first = typeof args[0] === 'string' ? args[0] : ''
  if (RECHARTS_NOISE_RE.test(first)) return
  _origWarn(...args)
}

createRoot(document.getElementById('root')).render(<App />)
