export const ANALYTICS_CHART_GEOMETRY = {
  gridLineColor: 'var(--studio-chart-grid-line)',
  gridLineWidth: 1,
  gridPixelEpsilon: 0.5,
  chartLeftMargin: 22,
  chartRightMargin: 44,
  timelineAxisHeight: 54,
  timelineRailOffset: 30,
  timelineRailTick: 4,
  timelineTooltipOffset: 40,
  timelineLabelOffset: 23,
  timelineMarkerOffset: 8,
  timelineLabelGap: 18,
  timelineTickCount: 7,
  timelineLabelHeight: 18,
  timelineEdgeLabelWidth: 54,
  markerBadgeHeight: 16,
  markerBadgeMinWidth: 16,
  markerBadgeGap: 3,
  markerBadgeFontWidth: 7,
  markerBadgeHPadding: 6,
  markerBadgeTextY: 12,
  markerTooltipMaxWidth: 524,
  markerTooltipMinWidth: 300,
  markerTooltipEdgeGap: 0,
}

export const ANALYTICS_AREA_CHART_DEFAULT_PROPS = {
  height: 174,
  yAxisOrientation: 'right',
  margin: {
    top: 16,
    right: ANALYTICS_CHART_GEOMETRY.chartRightMargin,
    left: ANALYTICS_CHART_GEOMETRY.chartLeftMargin,
    bottom: 4,
  },
  yTickCount: 4,
  xTickFontSize: 11,
  yTickFontSize: 11,
  yAxisWidth: 62,
  fillTopOpacity: 0.1,
  fillBottomOpacity: 0,
  gridLineColor: ANALYTICS_CHART_GEOMETRY.gridLineColor,
}

const ANALYTICS_HERO_FILL_OPACITY = 0.08

const ANALYTICS_HERO_TOOLTIP_CURSOR = {
  stroke: '#6c6c6c',
  strokeOpacity: 0.8,
  strokeWidth: 1,
}

const ANALYTICS_HERO_ACTIVE_DOT = {
  r: 5,
  stroke: '#282828',
  strokeWidth: 2,
}

export function analyticsAreaChartProps(overrides = {}) {
  const { margin, ...rest } = overrides
  return {
    ...ANALYTICS_AREA_CHART_DEFAULT_PROPS,
    ...rest,
    margin: margin
      ? { ...ANALYTICS_AREA_CHART_DEFAULT_PROPS.margin, ...margin }
      : ANALYTICS_AREA_CHART_DEFAULT_PROPS.margin,
  }
}

export function analyticsHeroChartProps(styles, overrides = {}) {
  const {
    activeDotProps,
    color,
    fillTopOpacity = ANALYTICS_HERO_FILL_OPACITY,
    fillBottomOpacity = ANALYTICS_HERO_FILL_OPACITY,
    margin,
    ...rest
  } = overrides
  const resolvedActiveDot = activeDotProps || (color
    ? { ...ANALYTICS_HERO_ACTIVE_DOT, fill: color }
    : ANALYTICS_HERO_ACTIVE_DOT)

  return analyticsAreaChartProps({
    ...rest,
    margin,
    fillTopOpacity,
    fillBottomOpacity,
    tooltipClassName: styles.analyticsHeroTooltip,
    tooltipLabelClassName: styles.analyticsHeroTooltipLabel,
    tooltipValueClassName: styles.analyticsHeroTooltipValue,
    tooltipCursor: ANALYTICS_HERO_TOOLTIP_CURSOR,
    activeDotProps: resolvedActiveDot,
  })
}
