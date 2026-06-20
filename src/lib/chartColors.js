/**
 * Палитра графиков в темной теме YouTube Studio.
 */

const BLUE = '#39cfc2'
const BLUE_DARK = '#2aa79b'
const BLUE_LIGHT = '#7edfd7'
const PURPLE = '#a970ff'
const PURPLE_LIGHT = '#c4a7ff'
const GREEN = '#39cfc2'
const GREEN_DARK = '#2aa79b'
const GREEN_LIGHT = '#7edfd7'
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
  grid: '#2a2a2a',
  gridSoft: 'rgba(255, 255, 255, 0.08)',
  axis: '#5a5a5a',
  text: '#f1f1f1',
  textMuted: '#aaaaaa',
  textSubtle: '#8d8d8d',
}

export const PALETTE_5 = [
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  PURPLE,
  GREEN,
]

export const PALETTE_6 = [
  BLUE,
  BLUE_DARK,
  BLUE_LIGHT,
  PURPLE,
  GREEN,
  AMBER,
]

export const TRAFFIC_PALETTE = {
  search: BLUE,
  playlists: BLUE_DARK,
  suggested: BLUE_LIGHT,
  external: PURPLE,
  direct: PURPLE_LIGHT,
  other: CHART_COLORS.textSubtle,
}

export const REVENUE_SOURCE_PALETTE = {
  ads: GREEN,
  premium: GREEN_DARK,
  memberships: GREEN_LIGHT,
  supers: AMBER,
  shopping: BLUE_LIGHT,
}

export const HEATMAP_RAMP = [
  'rgba(169, 112, 255, 0.06)',
  'rgba(169, 112, 255, 0.18)',
  'rgba(169, 112, 255, 0.34)',
  'rgba(169, 112, 255, 0.52)',
  'rgba(169, 112, 255, 0.72)',
  'rgba(169, 112, 255, 0.92)',
]
