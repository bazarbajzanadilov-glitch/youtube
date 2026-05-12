/**
 * Палитра графиков. Все оттенки — производные от основного синего
 * `--studio-chart-stroke` (#41B3D8), чтобы все чарты в приложении
 * выглядели единым синим цветом.
 */

const BLUE = '#41B3D8'
const BLUE_DARK = '#3296b6'
const BLUE_DEEP = '#287a96'
const BLUE_LIGHT = '#70c7e2'
const BLUE_LIGHTER = '#9edbef'
const BLUE_PALE = '#c9eef7'

export const CHART_COLORS = {
  primary: BLUE,
  primarySoft: 'rgba(65, 179, 216, 0.32)',
  primaryGhost: 'rgba(65, 179, 216, 0.08)',
  areaFill: '#2B363A',
  secondary: BLUE_LIGHT,
  purple: BLUE_DEEP,
  purpleSoft: 'rgba(65, 179, 216, 0.32)',
  purpleGhost: 'rgba(65, 179, 216, 0.08)',
  green: BLUE,
  greenSoft: 'rgba(65, 179, 216, 0.32)',
  red: BLUE_DARK,
  redSoft: 'rgba(65, 179, 216, 0.32)',
  amber: BLUE_LIGHT,
  amberSoft: 'rgba(65, 179, 216, 0.32)',
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
  'rgba(65, 179, 216, 0.04)',
  'rgba(65, 179, 216, 0.18)',
  'rgba(65, 179, 216, 0.36)',
  'rgba(65, 179, 216, 0.54)',
  'rgba(65, 179, 216, 0.72)',
  'rgba(65, 179, 216, 0.92)',
]
