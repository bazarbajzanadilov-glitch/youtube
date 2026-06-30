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
