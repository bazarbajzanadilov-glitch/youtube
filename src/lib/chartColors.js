/**
 * Палитра графиков. Все оттенки — производные от основного синего
 * `--studio-chart-stroke` (#5891b0), чтобы все чарты в приложении
 * выглядели единым синим цветом.
 */

const BLUE = '#5891b0'
const BLUE_DARK = '#3d7794'
const BLUE_DEEP = '#285c78'
const BLUE_LIGHT = '#7eb1cb'
const BLUE_LIGHTER = '#a4cce0'
const BLUE_PALE = '#cfe4ee'

export const CHART_COLORS = {
  primary: BLUE,
  primarySoft: 'rgba(88, 145, 176, 0.32)',
  primaryGhost: 'rgba(88, 145, 176, 0.08)',
  secondary: BLUE_LIGHT,
  purple: BLUE_DEEP,
  purpleSoft: 'rgba(88, 145, 176, 0.32)',
  purpleGhost: 'rgba(88, 145, 176, 0.08)',
  green: BLUE,
  greenSoft: 'rgba(88, 145, 176, 0.32)',
  red: BLUE_DARK,
  redSoft: 'rgba(88, 145, 176, 0.32)',
  amber: BLUE_LIGHT,
  amberSoft: 'rgba(88, 145, 176, 0.32)',
  pink: BLUE_LIGHTER,
  cyan: BLUE_LIGHT,
  grid: '#2a2a2a',
  gridSoft: 'rgba(255, 255, 255, 0.04)',
  axis: '#5a5a5a',
  text: '#f1f1f1',
  textMuted: '#aaaaaa',
  textSubtle: '#8d8d8d',
}

export const PALETTE_5 = [
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  BLUE_DEEP,
  BLUE_LIGHTER,
]

export const PALETTE_6 = [
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  BLUE_DEEP,
  BLUE_LIGHTER,
  BLUE_PALE,
]

export const TRAFFIC_PALETTE = {
  search: BLUE,
  playlists: BLUE_DARK,
  suggested: BLUE_LIGHT,
  external: BLUE_DEEP,
  direct: BLUE_LIGHTER,
  other: CHART_COLORS.textSubtle,
}

export const REVENUE_SOURCE_PALETTE = {
  ads: BLUE,
  premium: BLUE_DARK,
  memberships: BLUE_LIGHT,
  supers: BLUE_DEEP,
  shopping: BLUE_LIGHTER,
}

export const HEATMAP_RAMP = [
  'rgba(88, 145, 176, 0.04)',
  'rgba(88, 145, 176, 0.18)',
  'rgba(88, 145, 176, 0.36)',
  'rgba(88, 145, 176, 0.54)',
  'rgba(88, 145, 176, 0.72)',
  'rgba(88, 145, 176, 0.92)',
]
