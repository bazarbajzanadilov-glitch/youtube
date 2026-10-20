/**
 * Фирменные акценты остаются постоянными, а нейтральные цвета берутся
 * из CSS variables и автоматически следуют за темой документа.
 */

const BLUE = '#39cfc2'
const BLUE_LIGHT = '#7edfd7'
const PURPLE = '#a970ff'
const PURPLE_LIGHT = '#c4a7ff'
const GREEN = '#39cfc2'
const AMBER = '#f9ab00'
const RED = '#ff6d6d'

export const CHART_COLORS = {
  primary: BLUE,
  primarySoft: 'rgba(57, 207, 194, 0.32)',
  primaryGhost: 'rgba(57, 207, 194, 0.08)',
  areaFill: 'rgba(57, 207, 194, 0.12)',
  secondary: BLUE_LIGHT,
  purple: PURPLE,
  purpleSoft: 'rgba(169, 112, 255, 0.32)',
  purpleGhost: 'rgba(169, 112, 255, 0.08)',
  green: GREEN,
  greenSoft: 'rgba(57, 207, 194, 0.28)',
  revenue: GREEN,
  revenueSoft: 'rgba(57, 207, 194, 0.18)',
  red: RED,
  redSoft: 'rgba(255, 109, 109, 0.26)',
  amber: AMBER,
  amberSoft: 'rgba(249, 171, 0, 0.28)',
  pink: PURPLE_LIGHT,
  cyan: BLUE_LIGHT,
  grid: 'var(--studio-chart-grid-line)',
  gridSoft: 'var(--studio-border-strong)',
  axis: 'var(--studio-text-subtle)',
  text: 'var(--studio-text)',
  textMuted: 'var(--studio-text-muted)',
  textSubtle: 'var(--studio-text-subtle)',
}

export const HEATMAP_RAMP = [
  'rgba(169, 112, 255, 0.06)',
  'rgba(169, 112, 255, 0.18)',
  'rgba(169, 112, 255, 0.34)',
  'rgba(169, 112, 255, 0.52)',
  'rgba(169, 112, 255, 0.72)',
  'rgba(169, 112, 255, 0.92)',
]
