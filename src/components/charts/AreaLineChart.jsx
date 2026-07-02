import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, usePlotArea, useXAxisScale,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'
import { formatDateLong } from '../../lib/analyticsFormat.js'
import { buildNiceAxisTicks, maxByDataKey, projectValueToPeakAxis } from './chartAxis.js'
import { ANALYTICS_AREA_CHART_DEFAULT_PROPS, ANALYTICS_CHART_GEOMETRY } from './analyticsChartDefaults.js'

function defaultXTickFormatter(value) {
  if (typeof value !== 'string') return value
  return formatDateLong(value)
}

function defaultLabelFormatter(label) {
  return formatChartDateLabel(label)
}

const {
  gridLineColor: GRID_LINE_COLOR,
  gridLineWidth: GRID_LINE_WIDTH,
  gridPixelEpsilon: GRID_PIXEL_EPSILON,
  chartLeftMargin: CHART_LEFT_MARGIN,
  chartRightMargin: CHART_RIGHT_MARGIN,
  timelineAxisHeight: TIMELINE_AXIS_HEIGHT,
  timelineRailOffset: TIMELINE_RAIL_OFFSET,
  timelineRailTick: TIMELINE_RAIL_TICK,
  timelineTooltipOffset: TIMELINE_TOOLTIP_OFFSET,
  timelineLabelOffset: TIMELINE_LABEL_OFFSET,
  timelineMarkerOffset: TIMELINE_MARKER_OFFSET,
  timelineLabelGap: TIMELINE_LABEL_GAP,
  timelineTickCount: TIMELINE_TICK_COUNT,
  timelineLabelHeight: TIMELINE_LABEL_HEIGHT,
  timelineEdgeLabelWidth: TIMELINE_EDGE_LABEL_WIDTH,
  markerBadgeHeight: MARKER_BADGE_HEIGHT,
  markerBadgeMinWidth: MARKER_BADGE_MIN_WIDTH,
  markerBadgeGap: MARKER_BADGE_GAP,
  markerBadgeFontWidth: MARKER_BADGE_FONT_WIDTH,
  markerBadgeHPadding: MARKER_BADGE_H_PADDING,
  markerBadgeTextY: MARKER_BADGE_TEXT_Y,
  markerTooltipMaxWidth: MARKER_TOOLTIP_MAX_WIDTH,
  markerTooltipMinWidth: MARKER_TOOLTIP_MIN_WIDTH,
  markerTooltipEdgeGap: MARKER_TOOLTIP_EDGE_GAP,
} = ANALYTICS_CHART_GEOMETRY

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function alignGridCoordinate(value) {
  return Math.round(value) + 0.5
}

function UniformGrid({ lineCount = 4, gridLineColor = GRID_LINE_COLOR }) {
  const plotArea = usePlotArea()

  if (!plotArea) return null

  const count = Math.max(2, Number(lineCount) || 4)
  const left = alignGridCoordinate(plotArea.x)
  const right = alignGridCoordinate(plotArea.x + plotArea.width)
  const points = Array.from({ length: count }, (_, index) => (
    alignGridCoordinate(plotArea.y + ((plotArea.height * index) / (count - 1)))
  ))

  return (
    <g className="recharts-custom-uniform-grid" aria-hidden="true">
      {points.map((y) => (
        <line
          key={y}
          className={s.uniformGridLine}
          x1={left}
          y1={y}
          x2={right}
          y2={y}
          stroke={gridLineColor}
          strokeWidth={GRID_LINE_WIDTH}
          strokeOpacity={1}
          strokeLinecap="butt"
          shapeRendering="crispEdges"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

function ProcessingWindowOverlay({
  processingWindow,
  interactive = false,
  onHover,
  onLeave,
}) {
  const plotArea = usePlotArea()
  const xScale = useXAxisScale()

  if (!plotArea || !xScale || !processingWindow) return null

  const startX = finiteNumber(xScale(processingWindow.startDate))
  const endX = finiteNumber(xScale(processingWindow.endDate))
  if (startX == null || endX == null) return null

  const left = Math.max(plotArea.x, Math.min(startX, endX))
  const right = plotArea.x + plotArea.width
  const width = Math.max(0, right - left)
  if (width <= GRID_PIXEL_EPSILON) return null

  const setTooltip = (event) => {
    event.stopPropagation()
    if (!interactive || !onHover) return
    const tooltipWidth = 286
    const x = Math.max(
      tooltipWidth / 2 + 8,
      Math.min(plotArea.x + plotArea.width - tooltipWidth / 2, left + width / 2),
    )
    onHover({
      x,
      y: plotArea.y + plotArea.height * 0.48,
      label: processingWindow.label,
      statusText: processingWindow.statusText,
    })
  }

  if (interactive) {
    return (
      <rect
        className={s.processingWindowHit}
        x={left}
        y={plotArea.y}
        width={width}
        height={plotArea.height}
        onMouseEnter={setTooltip}
        onMouseMove={setTooltip}
        onMouseLeave={(event) => {
          event.stopPropagation()
          onLeave?.()
        }}
      />
    )
  }

  return (
    <rect
      className={s.processingWindow}
      x={left}
      y={plotArea.y}
      width={width}
      height={plotArea.height}
      shapeRendering="crispEdges"
    />
  )
}

function TimelineMarkersOverlay({ markers, onHover, onLeave }) {
  const plotArea = usePlotArea()
  const xScale = useXAxisScale()

  if (!plotArea || !xScale || !markers?.length) return null

  const setTooltip = (marker, markerX) => {
    const viewportWidth = typeof document === 'undefined' ? MARKER_TOOLTIP_MAX_WIDTH : document.documentElement.clientWidth
    const viewportGap = viewportWidth <= 720 ? 8 : 32
    const maxViewportWidth = Math.max(240, viewportWidth - (viewportGap * 2))
    const preferredWidth = Math.round(plotArea.width / 2)
    const maxPlotWidth = Math.max(240, plotArea.width - MARKER_TOOLTIP_EDGE_GAP)
    const tooltipWidth = Math.min(
      MARKER_TOOLTIP_MAX_WIDTH,
      maxViewportWidth,
      maxPlotWidth,
      Math.max(MARKER_TOOLTIP_MIN_WIDTH, preferredWidth),
    )
    const minLeft = viewportGap
    const maxLeft = Math.max(minLeft, viewportWidth - tooltipWidth - viewportGap)
    const preferredLeft = markerX - (tooltipWidth / 2)
    const safeX = Math.max(minLeft, Math.min(maxLeft, preferredLeft))
    const railY = alignGridCoordinate(plotArea.y + plotArea.height + TIMELINE_RAIL_OFFSET)
    onHover?.({
      x: safeX,
      y: railY + TIMELINE_TOOLTIP_OFFSET,
      width: tooltipWidth,
      guideX: markerX,
      guideTop: plotArea.y,
      guideHeight: plotArea.height,
      marker,
    })
  }

  const minX = plotArea.x + (MARKER_BADGE_MIN_WIDTH / 2)
  const maxX = plotArea.x + plotArea.width - (MARKER_BADGE_MIN_WIDTH / 2)
  const items = markers
    .map((marker, index) => {
      const rawX = finiteNumber(xScale(marker.date))
      if (rawX == null) return null
      const count = Number(marker.count) || 0
      const label = count > 9 ? '9+' : String(count || marker.label || '')
      if (!label) return null
      const width = Math.max(MARKER_BADGE_MIN_WIDTH, label.length * MARKER_BADGE_FONT_WIDTH + MARKER_BADGE_H_PADDING)
      return {
        marker,
        index,
        label,
        width,
        x: Math.max(minX, Math.min(maxX, rawX)),
      }
    })
    .filter(Boolean)

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1]
    const item = items[index]
    const minPosition = previous.x + (previous.width / 2) + (item.width / 2) + MARKER_BADGE_GAP
    if (item.x < minPosition) item.x = minPosition
  }

  const last = items[items.length - 1]
  const overflowRight = last ? (last.x + (last.width / 2)) - (plotArea.x + plotArea.width) : 0
  if (overflowRight > 0) {
    items.forEach((item) => { item.x -= overflowRight })
  }

  const first = items[0]
  const overflowLeft = first ? plotArea.x - (first.x - (first.width / 2)) : 0
  if (overflowLeft > 0) {
    items.forEach((item) => { item.x += overflowLeft })
  }

  return (
    <g className={s.processingMarkerGroup} aria-hidden="true">
      {items.map(({ marker, index, label, width, x }) => {
        const y = plotArea.y + plotArea.height + TIMELINE_MARKER_OFFSET

        return (
          <g
            key={`${marker.date}-${index}`}
            transform={`translate(${x}, ${y})`}
            onPointerLeave={() => onLeave?.()}
            onPointerOut={() => onLeave?.()}
            onPointerCancel={() => onLeave?.()}
            onMouseLeave={() => onLeave?.()}
          >
            <rect
              className={s.processingMarkerBadge}
              x={-width / 2}
              y={0}
              width={width}
              height={MARKER_BADGE_HEIGHT}
              rx={3}
              onPointerEnter={() => setTooltip(marker, x)}
              onPointerMove={() => setTooltip(marker, x)}
              onPointerLeave={() => onLeave?.()}
              onPointerOut={() => onLeave?.()}
              onMouseEnter={() => setTooltip(marker, x)}
              onMouseMove={() => setTooltip(marker, x)}
              onMouseLeave={() => onLeave?.()}
              onClick={() => setTooltip(marker, x)}
            />
            <text
              className={s.processingMarkerText}
              x={0}
              y={MARKER_BADGE_TEXT_Y}
              textAnchor="middle"
              onPointerEnter={() => setTooltip(marker, x)}
              onPointerMove={() => setTooltip(marker, x)}
              onPointerLeave={() => onLeave?.()}
              onPointerOut={() => onLeave?.()}
              onMouseEnter={() => setTooltip(marker, x)}
              onMouseMove={() => setTooltip(marker, x)}
              onMouseLeave={() => onLeave?.()}
              onClick={() => setTooltip(marker, x)}
            >
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function TimelineAxisOverlay({ ticks = [], formatter, fontSize = 11 }) {
  const plotArea = usePlotArea()
  if (!plotArea || ticks.length === 0) return null

  const tickLayouts = buildTimelineTickLayouts(ticks, plotArea, formatter)
  const left = alignGridCoordinate(plotArea.x)
  const right = alignGridCoordinate(plotArea.x + plotArea.width)
  const railY = alignGridCoordinate(plotArea.y + plotArea.height + TIMELINE_RAIL_OFFSET)
  const labelY = railY + TIMELINE_LABEL_OFFSET
  const firstTick = tickLayouts[0]?.tick
  const lastTick = tickLayouts[tickLayouts.length - 1]?.tick

  return (
    <g className={s.timelineAxis} aria-hidden="true">
      <path
        d={`M${left} ${railY}H${right}M${left} ${railY}V${railY + TIMELINE_RAIL_TICK}M${right} ${railY}V${railY + TIMELINE_RAIL_TICK}`}
        className={s.timelineRail}
      />
      {tickLayouts.map(({ tick, label, x, labelX, labelWidth, textAlign }) => {
        const isFirst = tick === firstTick
        const isLast = tick === lastTick

        return (
          <g key={tick}>
            {!isFirst && !isLast ? (
              <line
                className={s.timelineRail}
                x1={x}
                y1={railY}
                x2={x}
                y2={railY + TIMELINE_RAIL_TICK}
              />
            ) : null}
            <foreignObject
              x={labelX}
              y={labelY - (TIMELINE_LABEL_HEIGHT / 2)}
              width={labelWidth}
              height={TIMELINE_LABEL_HEIGHT}
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                className={s.timelineTickLabel}
                style={{ fontSize: `${fontSize}px`, textAlign }}
                title={label}
              >
                {label}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </g>
  )
}

function mergeTimelineMarkers(...groups) {
  const merged = new Map()
  groups.flat().forEach((marker) => {
    const date = String(marker?.date || '').slice(0, 10)
    const count = Number(marker?.count) || 0
    if (!date || count <= 0) return
    const previous = merged.get(date)
    const previousVideos = previous?.videos || []
    const incomingVideos = Array.isArray(marker.videos) ? marker.videos : []
    const videos = [...previousVideos]
    incomingVideos.forEach((video) => {
      if (!video?.id || videos.some((item) => item.id === video.id)) return
      videos.push(video)
    })
    const mergedCount = Math.max(previous?.count || 0, count, videos.length)
    merged.set(date, {
      ...previous,
      ...marker,
      date,
      count: mergedCount,
      label: marker.label || previous?.label || `${mergedCount} ${mergedCount === 1 ? 'опубликованное видео' : 'опубликованных видео'}`,
      videos,
    })
  })
  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function formatTimelineTickLabel(tick, formatter) {
  const label = String(formatter(tick) || '')
  return label.replace(/\s{2,}/g, ' ').trim()
}

function buildTimelineTickLayouts(ticks, plotArea, formatter) {
  if (!Array.isArray(ticks) || ticks.length === 0) return []
  const step = ticks.length > 1 ? plotArea.width / (ticks.length - 1) : plotArea.width
  const middleWidth = Math.max(18, step - TIMELINE_LABEL_GAP)
  const edgeWidth = Math.max(18, Math.min(middleWidth, TIMELINE_EDGE_LABEL_WIDTH))

  return ticks
    .map((tick, index) => {
      const rawX = ticks.length > 1
        ? plotArea.x + ((plotArea.width * index) / (ticks.length - 1))
        : plotArea.x + (plotArea.width / 2)
      const x = alignGridCoordinate(rawX)
      const isFirst = index === 0
      const isLast = index === ticks.length - 1
      const label = formatTimelineTickLabel(tick, formatter)
      const labelWidth = Math.min(plotArea.width, isFirst || isLast ? edgeWidth : middleWidth)
      const labelX = x - (labelWidth / 2)
      return {
        tick,
        label,
        x,
        labelX,
        labelWidth,
        textAlign: 'center',
      }
    })
    .filter(Boolean)
}

function buildEvenTicks(data, key, maxTicks = TIMELINE_TICK_COUNT) {
  if (!Array.isArray(data) || data.length === 0) return undefined
  if (data.length <= maxTicks) return data.map((row) => row[key])
  const lastIndex = data.length - 1
  const ticks = []
  for (let i = 0; i < maxTicks; i += 1) {
    const idx = Math.round((i * lastIndex) / (maxTicks - 1))
    const value = data[idx]?.[key]
    if (value != null && ticks[ticks.length - 1] !== value) ticks.push(value)
  }
  return ticks
}

export default function AreaLineChart({
  data = [],
  dataKey = 'views',
  xKey = 'date',
  color = CHART_COLORS.primary,
  fillColor,
  height = ANALYTICS_AREA_CHART_DEFAULT_PROPS.height,
  name = 'Значение',
  formatY = (n) => Number(n).toLocaleString('ru-RU'),
  formatTooltipValue,
  formatTooltipLabel = defaultLabelFormatter,
  showGrid = true,
  yDomain,
  yAxisOrientation = 'left',
  eventMarkers = [],
  curve = 'linear',
  showAreaFill = true,
  margin,
  yAxisWidth = ANALYTICS_AREA_CHART_DEFAULT_PROPS.yAxisWidth,
  yTicks,
  yTickCount = ANALYTICS_AREA_CHART_DEFAULT_PROPS.yTickCount,
  yValueScale = 1,
  xTickFontSize = ANALYTICS_AREA_CHART_DEFAULT_PROPS.xTickFontSize,
  yTickFontSize = ANALYTICS_AREA_CHART_DEFAULT_PROPS.yTickFontSize,
  xTickFormatter = defaultXTickFormatter,
  xAxisPadding = { left: 0, right: 0 },
  tooltipClassName = '',
  tooltipLabelClassName = '',
  tooltipValueClassName = '',
  tooltipCursor,
  activeDotProps,
  fillTopOpacity = ANALYTICS_AREA_CHART_DEFAULT_PROPS.fillTopOpacity,
  fillBottomOpacity = ANALYTICS_AREA_CHART_DEFAULT_PROPS.fillBottomOpacity,
  gridLineColor = ANALYTICS_AREA_CHART_DEFAULT_PROPS.gridLineColor,
  processingWindow,
}) {
  const [processingTooltip, setProcessingTooltip] = useState(null)
  const [markerTooltip, setMarkerTooltip] = useState(null)
  const wrapRef = useRef(null)
  const markerTooltipRef = useRef(null)
  const markerHideTimer = useRef(null)
  const markerNativeMoveHandler = useRef(null)
  const chartId = useId().replace(/:/g, '')
  const gradientId = `${chartId}-gradient`
  const chartFillColor = fillColor || color
  const hasUniformFill = Math.abs((Number(fillTopOpacity) || 0) - (Number(fillBottomOpacity) || 0)) < 0.0001
  const last = data.length > 0 ? data[data.length - 1] : null
  const tooltipFormatValue = formatTooltipValue || ((val) => formatY(val))
  const hasMarkers = eventMarkers.length > 0 && data.length > 0
  const markerIndexes = hasMarkers
    ? eventMarkers
      .map((marker) => {
        const idx = data.findIndex((row) => row[xKey] === marker.date)
        return idx >= 0 ? { ...marker, idx } : null
      })
      .filter(Boolean)
    : []
  const processingMarkerIndexes = processingWindow?.markers?.length
    ? processingWindow.markers
      .map((marker) => {
        const idx = data.findIndex((row) => row[xKey] === marker.date)
        return idx >= 0 ? { ...marker, idx } : null
      })
      .filter(Boolean)
    : []
  const chartMargin = margin || {
    top: 16,
    right: CHART_RIGHT_MARGIN,
    left: CHART_LEFT_MARGIN,
    bottom: 4,
  }
  const chartActiveDot = activeDotProps || {
    r: 4,
    stroke: color,
    strokeWidth: 2,
    fill: '#282828',
  }
  const chartCursor = tooltipCursor || {
    stroke: color,
    strokeOpacity: 0.32,
    strokeWidth: 1,
  }
  const autoYTicks = buildNiceAxisTicks(maxByDataKey(data, dataKey), {
    scale: yValueScale,
    targetTickCount: yTickCount,
  })
  const resolvedAutoYTicks = Array.isArray(autoYTicks) && autoYTicks.length >= 2
    ? autoYTicks
    : [0, 1]
  const useProjectedYAxis = !yTicks && !yDomain
  const projectedDataKey = useProjectedYAxis ? `${dataKey}__axisPosition` : dataKey
  const chartData = useProjectedYAxis
    ? data.map((row) => ({
      ...row,
      [projectedDataKey]: projectValueToPeakAxis(row?.[dataKey], resolvedAutoYTicks),
    }))
    : data
  const processingStartDate = String(processingWindow?.startDate || '').slice(0, 10)
  const renderedChartData = processingStartDate
    ? chartData.map((row) => {
      const date = String(row?.[xKey] || '').slice(0, 10)
      if (!date || date <= processingStartDate) return row
      return { ...row, [projectedDataKey]: null }
    })
    : chartData
  const chartYTicks = yTicks || (yDomain ? undefined : resolvedAutoYTicks.map((_, index) => index))
  const chartYDomain = yDomain || [0, Math.max(1, resolvedAutoYTicks.length - 1)]
  const chartFormatY = useProjectedYAxis
    ? (tick) => formatY(resolvedAutoYTicks[Math.round(Number(tick) || 0)] ?? 0)
    : formatY
  const gridLineCount = Array.isArray(chartYTicks) && chartYTicks.length >= 2
    ? chartYTicks.length
    : Math.max(2, Number(yTickCount) || ANALYTICS_AREA_CHART_DEFAULT_PROPS.yTickCount)
  const xTicks = buildEvenTicks(data, xKey)
  const timelineMarkers = mergeTimelineMarkers(markerIndexes, processingMarkerIndexes)
  const clearMarkerHideTimer = () => {
    if (markerHideTimer.current != null) {
      window.clearTimeout(markerHideTimer.current)
      markerHideTimer.current = null
    }
  }
  const markerClassName = (node) => (
    typeof node?.className === 'string' ? node.className : node?.className?.baseVal || ''
  )
  const isMarkerElement = (node) => {
    const className = markerClassName(node)
    return className.includes('processingMarker') || className.includes('markerTooltip')
  }
  const isMarkerTooltipTarget = (target, container) => {
    let node = target
    while (node && node !== container) {
      if (isMarkerElement(node)) return true
      node = node.parentNode
    }
    return false
  }
  const stopMarkerNativeMoveWatch = () => {
    if (!markerNativeMoveHandler.current) return
    window.removeEventListener('pointermove', markerNativeMoveHandler.current, true)
    window.removeEventListener('mousemove', markerNativeMoveHandler.current, true)
    markerNativeMoveHandler.current = null
  }
  const closeMarkerTooltip = () => {
    clearMarkerHideTimer()
    stopMarkerNativeMoveWatch()
    markerTooltipRef.current = null
    setMarkerTooltip(null)
  }
  const startMarkerNativeMoveWatch = () => {
    stopMarkerNativeMoveWatch()
    markerNativeMoveHandler.current = (event) => {
      const tooltip = markerTooltipRef.current
      const wrap = wrapRef.current
      if (!tooltip || !wrap || isMarkerTooltipTarget(event.target, wrap)) return
      const rect = wrap.getBoundingClientRect()
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const outsideWrap = localX < 0 || localX > rect.width || localY < 0 || localY > rect.height
      const abovePlot = localY < tooltip.guideTop + tooltip.guideHeight - 1
      if (outsideWrap || abovePlot) closeMarkerTooltip()
    }
    window.addEventListener('pointermove', markerNativeMoveHandler.current, true)
    window.addEventListener('mousemove', markerNativeMoveHandler.current, true)
  }
  const showMarkerTooltip = (tooltip) => {
    clearMarkerHideTimer()
    const wrapRect = wrapRef.current?.getBoundingClientRect()
    const viewportWidth = typeof document === 'undefined' ? 0 : document.documentElement.clientWidth
    const viewportGap = viewportWidth <= 720 ? 8 : 32
    const width = Number(tooltip.width) || MARKER_TOOLTIP_MIN_WIDTH
    const viewportTooltip = wrapRect && viewportWidth
      ? {
        ...tooltip,
        x: (window.scrollX || document.documentElement.scrollLeft || 0)
          + Math.max(viewportGap, Math.min(viewportWidth - width - viewportGap, wrapRect.left + tooltip.guideX - (width / 2))),
        y: (window.scrollY || document.documentElement.scrollTop || 0) + wrapRect.top + tooltip.y,
      }
      : tooltip
    markerTooltipRef.current = viewportTooltip
    setMarkerTooltip(viewportTooltip)
    startMarkerNativeMoveWatch()
  }
  const hideMarkerTooltip = () => {
    clearMarkerHideTimer()
    markerHideTimer.current = window.setTimeout(closeMarkerTooltip, 90)
  }
  const handleWrapPointerMove = (event) => {
    if (!markerTooltip || isMarkerTooltipTarget(event.target, event.currentTarget)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localY = event.clientY - rect.top
    if (localY < markerTooltip.guideTop + markerTooltip.guideHeight - 1) {
      closeMarkerTooltip()
    }
  }
  const handleWrapPointerLeave = (event) => {
    if (isMarkerTooltipTarget(event.relatedTarget, event.currentTarget)) return
    closeMarkerTooltip()
  }

  const markerTooltipNode = markerTooltip ? (
    <div
      className={s.markerTooltip}
      style={{ left: `${markerTooltip.x}px`, top: `${markerTooltip.y}px`, width: `${markerTooltip.width}px` }}
      onPointerEnter={clearMarkerHideTimer}
      onPointerLeave={hideMarkerTooltip}
      onMouseEnter={clearMarkerHideTimer}
      onMouseLeave={hideMarkerTooltip}
    >
      <div className={s.markerTooltipTitle}>{markerTooltip.marker.label}</div>
      <div className={s.markerTooltipList}>
        {(markerTooltip.marker.videos || []).map((video) => (
          <div className={s.markerTooltipItem} key={video.id || `${markerTooltip.marker.date}-${video.title}`}>
            <span className={s.markerTooltipThumb}>
              {video.cover ? <img src={video.cover} alt="" aria-hidden="true" /> : null}
            </span>
            <span className={s.markerTooltipBody}>
              <span className={s.markerTooltipVideoTitle}>{video.title || 'Без названия'}</span>
              <span className={s.markerTooltipDate}>{formatDateLong(video.date || markerTooltip.marker.date)}</span>
            </span>
            <span className={s.markerTooltipViewsIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Zm4 11H7v-5h2v5Zm4 0h-2V8h2v8Zm4 0h-2v-3h2v3Z" />
              </svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      <div
        ref={wrapRef}
        className={s.wrap}
        style={{ height }}
        onPointerMove={handleWrapPointerMove}
        onPointerLeave={handleWrapPointerLeave}
        onMouseMove={handleWrapPointerMove}
        onMouseLeave={handleWrapPointerLeave}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
          <AreaChart data={renderedChartData} margin={chartMargin}>
            <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartFillColor} stopOpacity={showAreaFill ? fillTopOpacity : 0} />
                <stop offset="100%" stopColor={chartFillColor} stopOpacity={showAreaFill ? fillBottomOpacity : 0} />
              </linearGradient>
            </defs>
            {showAreaFill ? (
              <Area
                type={curve}
                dataKey={projectedDataKey}
                name={name}
                stroke="none"
                strokeWidth={0}
                fill={hasUniformFill ? chartFillColor : `url(#${gradientId})`}
                fillOpacity={hasUniformFill ? fillTopOpacity : 1}
                isAnimationActive={false}
                activeDot={false}
                dot={false}
                tooltipType="none"
                legendType="none"
              />
            ) : null}
            <XAxis
              dataKey={xKey}
              stroke={CHART_COLORS.textSubtle}
              tick={false}
              tickLine={false}
              axisLine={false}
              tickFormatter={xTickFormatter}
              ticks={xTicks}
              interval={0}
              padding={xAxisPadding}
              scale="point"
              height={TIMELINE_AXIS_HEIGHT}
            />
            <YAxis
              orientation={yAxisOrientation}
              stroke={CHART_COLORS.textSubtle}
              tick={{ fill: CHART_COLORS.textSubtle, fontSize: yTickFontSize }}
              tickLine={false}
              axisLine={false}
              tickFormatter={chartFormatY}
              width={yAxisWidth}
              domain={chartYDomain}
              ticks={chartYTicks}
            />
            {showGrid ? (
              <UniformGrid
                lineCount={gridLineCount}
                gridLineColor={gridLineColor}
              />
            ) : null}
            <TimelineAxisOverlay
              ticks={xTicks || []}
              formatter={xTickFormatter}
              fontSize={xTickFontSize}
            />
            {processingWindow ? (
              <ProcessingWindowOverlay
                processingWindow={processingWindow}
              />
            ) : null}
            <Tooltip
              cursor={chartCursor}
              content={(
                <ChartTooltip
                  formatLabel={formatTooltipLabel}
                  formatValue={tooltipFormatValue}
                  className={tooltipClassName}
                  labelClassName={tooltipLabelClassName}
                  valueClassName={tooltipValueClassName}
                  rawValueKey={useProjectedYAxis ? dataKey : undefined}
                />
              )}
              wrapperStyle={{ outline: 'none' }}
            />
            {last ? (
              <ReferenceLine x={last[xKey]} stroke={CHART_COLORS.gridSoft} strokeDasharray="2 4" />
            ) : null}
            <Area
              type={curve}
              dataKey={projectedDataKey}
              name={name}
              stroke={color}
              strokeWidth={2}
              fill="transparent"
              fillOpacity={0}
              isAnimationActive={false}
              animationDuration={0}
              animationEasing="ease-out"
              activeDot={chartActiveDot}
              dot={false}
            />
            {processingWindow ? (
              <ProcessingWindowOverlay
                processingWindow={processingWindow}
                interactive
                onHover={setProcessingTooltip}
                onLeave={() => setProcessingTooltip(null)}
              />
            ) : null}
            {timelineMarkers.length > 0 ? (
              <TimelineMarkersOverlay
                markers={timelineMarkers}
                onHover={showMarkerTooltip}
                onLeave={hideMarkerTooltip}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
        {processingTooltip ? (
          <div
            className={s.processingTooltip}
            style={{ left: `${processingTooltip.x}px`, top: `${processingTooltip.y}px` }}
          >
            <div className={s.processingTooltipLabel}>{processingTooltip.label}</div>
            <div className={s.processingTooltipStatus}>
              <span className={s.processingClock} aria-hidden="true" />
              <span>{processingTooltip.statusText}</span>
            </div>
          </div>
        ) : null}
        {markerTooltip ? (
          <span
            className={s.markerHoverGuide}
            style={{
              left: `${markerTooltip.guideX}px`,
              top: `${markerTooltip.guideTop}px`,
              height: `${markerTooltip.guideHeight}px`,
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {markerTooltipNode && typeof document !== 'undefined'
        ? createPortal(markerTooltipNode, document.body)
        : markerTooltipNode}
    </>
  )
}
