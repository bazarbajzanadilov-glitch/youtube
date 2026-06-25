import { useId, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, usePlotArea, useXAxisScale,
  useYAxisScale, useYAxisTicks,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'
import { formatDateLong } from '../../lib/analyticsFormat.js'
import { buildPeakAxisTicks, maxByDataKey, projectValueToPeakAxis } from './chartAxis.js'

function defaultXTickFormatter(value) {
  if (typeof value !== 'string') return value
  return formatDateLong(value)
}

function defaultLabelFormatter(label) {
  return formatChartDateLabel(label)
}

const GRID_LINE_COLOR = '#717171'
const GRID_LINE_WIDTH = 1
const GRID_OVER_WATER_OPACITY = 1
const GRID_UNDER_WATER_OPACITY = 0.6
const GRID_PIXEL_EPSILON = 0.5
const CHART_LEFT_MARGIN = 22
const CHART_RIGHT_MARGIN = CHART_LEFT_MARGIN * 2

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function alignGridCoordinate(value) {
  return Math.round(value) + 0.5
}

function pointSide(pointY, gridY) {
  const diff = pointY - gridY
  if (Math.abs(diff) <= GRID_PIXEL_EPSILON) return 0
  return diff > 0 ? 1 : -1
}

function addUniqueCut(cuts, x, left, right) {
  if (!Number.isFinite(x)) return
  const clamped = Math.max(left, Math.min(right, x))
  if (!cuts.some((cut) => Math.abs(cut - clamped) <= GRID_PIXEL_EPSILON)) {
    cuts.push(clamped)
  }
}

function getLineYAtX(points, x) {
  if (points.length === 0) return null
  if (x <= points[0].x) return points[0].y
  const lastPoint = points[points.length - 1]
  if (x >= lastPoint.x) return lastPoint.y

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    const minX = Math.min(start.x, end.x)
    const maxX = Math.max(start.x, end.x)
    if (x < minX - GRID_PIXEL_EPSILON || x > maxX + GRID_PIXEL_EPSILON) continue
    if (Math.abs(end.x - start.x) <= GRID_PIXEL_EPSILON) return start.y
    const ratio = (x - start.x) / (end.x - start.x)
    return start.y + ratio * (end.y - start.y)
  }

  return lastPoint.y
}

function collectLineCuts(points, gridY, left, right) {
  const cuts = [left, right]

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    if (Math.max(start.x, end.x) < left || Math.min(start.x, end.x) > right) continue

    const startSide = pointSide(start.y, gridY)
    const endSide = pointSide(end.y, gridY)

    if (startSide === 0 && endSide === 0) continue

    if (startSide === 0) {
      const prevSide = i > 0 ? pointSide(points[i - 1].y, gridY) : 0
      if (prevSide !== 0 && endSide !== 0 && prevSide !== endSide) {
        addUniqueCut(cuts, start.x, left, right)
      }
      continue
    }

    if (endSide === 0) {
      const nextSide = i < points.length - 2 ? pointSide(points[i + 2].y, gridY) : 0
      if (nextSide !== 0 && startSide !== 0 && nextSide !== startSide) {
        addUniqueCut(cuts, end.x, left, right)
      }
      continue
    }

    if (startSide !== endSide && Math.abs(end.y - start.y) > GRID_PIXEL_EPSILON) {
      const ratio = (gridY - start.y) / (end.y - start.y)
      addUniqueCut(cuts, start.x + ratio * (end.x - start.x), left, right)
    }
  }

  return cuts.sort((a, b) => a - b)
}

function buildGridSegments(gridY, linePoints, left, right) {
  if (linePoints.length < 2) {
    return [{ x1: left, x2: right, underWater: false }]
  }

  const segments = collectLineCuts(linePoints, gridY, left, right)
    .map((cut, index, cuts) => {
      const nextCut = cuts[index + 1]
      if (nextCut == null || nextCut - cut <= GRID_PIXEL_EPSILON) return null
      const midpointX = (cut + nextCut) / 2
      const lineY = getLineYAtX(linePoints, midpointX)
      const underWater = lineY != null && gridY > lineY + GRID_PIXEL_EPSILON
      return { x1: cut, x2: nextCut, underWater }
    })
    .filter(Boolean)

  return segments.reduce((merged, segment) => {
    const previous = merged[merged.length - 1]
    if (previous && previous.underWater === segment.underWater && Math.abs(previous.x2 - segment.x1) <= GRID_PIXEL_EPSILON) {
      previous.x2 = segment.x2
    } else {
      merged.push({ ...segment })
    }
    return merged
  }, [])
}

function WaterlineGrid({
  data,
  xKey,
  yKey,
  gridLineColor = GRID_LINE_COLOR,
  gridUnderWaterColor = gridLineColor,
  gridOverWaterOpacity = GRID_OVER_WATER_OPACITY,
  gridUnderWaterOpacity = GRID_UNDER_WATER_OPACITY,
}) {
  const plotArea = usePlotArea()
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  const yTicks = useYAxisTicks()

  if (!plotArea || !xScale || !yScale || !Array.isArray(yTicks) || yTicks.length === 0) {
    return null
  }

  const left = plotArea.x
  const right = plotArea.x + plotArea.width
  const top = plotArea.y
  const bottom = plotArea.y + plotArea.height
  const horizontalPoints = Array.from(new Set(yTicks
    .map((tick) => finiteNumber(tick.coordinate))
    .map((point) => (point == null ? null : alignGridCoordinate(point)))
    .filter((point) => point != null && point >= top - 0.5 && point <= bottom + 0.5)
    .map((point) => point.toFixed(1))))
    .map(Number)
    .sort((a, b) => b - a)

  if (horizontalPoints.length === 0) return null

  const linePoints = data
    .map((row) => {
      const x = finiteNumber(xScale(row?.[xKey]))
      const y = finiteNumber(yScale(row?.[yKey]))
      return x == null || y == null ? null : { x, y }
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x)

  return (
    <g className="recharts-custom-waterline-grid" aria-hidden="true">
      {horizontalPoints.flatMap((y, lineIndex) => (
        buildGridSegments(y, linePoints, left, right).map((segment, segmentIndex) => (
          <line
            key={`${lineIndex}-${segmentIndex}`}
            x1={segment.x1}
            y1={y}
            x2={segment.x2}
            y2={y}
            stroke={segment.underWater ? gridUnderWaterColor : gridLineColor}
            strokeWidth={GRID_LINE_WIDTH}
            strokeOpacity={segment.underWater ? gridUnderWaterOpacity : gridOverWaterOpacity}
            strokeLinecap="butt"
            shapeRendering="crispEdges"
          />
        ))
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

function ProcessingMarkersOverlay({ markers }) {
  const plotArea = usePlotArea()
  const xScale = useXAxisScale()

  if (!plotArea || !xScale || !markers?.length) return null

  return (
    <g className={s.processingMarkerGroup} aria-hidden="true">
      {markers.map((marker, index) => {
        const rawX = finiteNumber(xScale(marker.date))
        if (rawX == null) return null
        const x = Math.max(plotArea.x + 10, Math.min(plotArea.x + plotArea.width, rawX))
        const y = plotArea.y + plotArea.height + 10
        const label = String(marker.count)
        const width = Math.max(20, label.length * 8 + 10)

        return (
          <g key={`${marker.date}-${index}`} transform={`translate(${x}, ${y})`}>
            <rect
              className={s.processingMarkerBadge}
              x={-width / 2}
              y={0}
              width={width}
              height={20}
              rx={3}
            />
            <text
              className={s.processingMarkerText}
              x={0}
              y={14}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function buildEvenTicks(data, key, maxTicks = 7) {
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
  height = 220,
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
  yAxisWidth = 48,
  yTicks,
  yTickCount = 5,
  yValueScale = 1,
  xTickFontSize = 11,
  yTickFontSize = 11,
  xTickFormatter = defaultXTickFormatter,
  xAxisPadding = { left: 0, right: 0 },
  tooltipClassName = '',
  tooltipLabelClassName = '',
  tooltipValueClassName = '',
  tooltipCursor,
  activeDotProps,
  fillTopOpacity = 0.1,
  fillBottomOpacity = 0,
  gridLineColor = GRID_LINE_COLOR,
  gridUnderWaterColor,
  gridOverWaterOpacity = GRID_OVER_WATER_OPACITY,
  gridUnderWaterOpacity = GRID_UNDER_WATER_OPACITY,
  processingWindow,
}) {
  const [processingTooltip, setProcessingTooltip] = useState(null)
  const chartId = useId().replace(/:/g, '')
  const gradientId = `${chartId}-gradient`
  const chartFillColor = fillColor || color
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
    bottom: markerIndexes.length > 0 ? 30 : 4,
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
  const autoYTicks = buildPeakAxisTicks(maxByDataKey(data, dataKey), {
    scale: yValueScale,
    targetTickCount: yTickCount,
  })
  const useProjectedYAxis = !yTicks && !yDomain
  const projectedDataKey = useProjectedYAxis ? `${dataKey}__axisPosition` : dataKey
  const chartData = useProjectedYAxis
    ? data.map((row) => ({
      ...row,
      [projectedDataKey]: projectValueToPeakAxis(row?.[dataKey], autoYTicks),
    }))
    : data
  const chartYTicks = yTicks || (yDomain ? undefined : autoYTicks?.map((_, index) => index))
  const chartYDomain = yDomain || [0, Math.max(1, (autoYTicks?.length || 2) - 1)]
  const chartFormatY = useProjectedYAxis
    ? (tick) => formatY(autoYTicks?.[Math.round(Number(tick) || 0)] ?? 0)
    : formatY
  const xTicks = buildEvenTicks(data, xKey)
  const firstXTick = xTicks?.[0]
  const lastXTick = xTicks?.[xTicks.length - 1]
  const renderXAxisTick = ({ x, y, payload }) => {
    const value = payload?.value
    const anchor = value === firstXTick ? 'start' : value === lastXTick ? 'end' : 'middle'
    return (
      <text
        x={x}
        y={y}
        dy={16}
        textAnchor={anchor}
        fill={CHART_COLORS.textSubtle}
        fontSize={xTickFontSize}
      >
        {xTickFormatter(value)}
      </text>
    )
  }

  return (
    <div className={s.wrap} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={chartData} margin={chartMargin}>
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
              fill={`url(#${gradientId})`}
              fillOpacity={1}
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
            tick={renderXAxisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={xTickFormatter}
            ticks={xTicks}
            interval={0}
            padding={xAxisPadding}
            scale="point"
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
            <WaterlineGrid
              data={chartData}
              xKey={xKey}
              yKey={projectedDataKey}
              gridLineColor={gridLineColor}
              gridUnderWaterColor={gridUnderWaterColor}
              gridOverWaterOpacity={gridOverWaterOpacity}
              gridUnderWaterOpacity={gridUnderWaterOpacity}
            />
          ) : null}
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
          {processingMarkerIndexes.length > 0 ? (
            <ProcessingMarkersOverlay markers={processingMarkerIndexes} />
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
      {markerIndexes.length > 0 ? (
        <div
          className={s.markerRail}
          style={{ '--chart-left': `${chartMargin.left}px`, '--chart-right': `${chartMargin.right}px` }}
          aria-hidden="true"
        >
          {markerIndexes.map((marker, i) => {
            const pct = data.length <= 1 ? 0 : (marker.idx / (data.length - 1)) * 100
            return (
              <span
                key={`${marker.date}-${i}`}
                className={s.eventMarker}
                style={{ left: `${pct}%` }}
                title={marker.label || marker.date}
              >
                <span className={s.playGlyph} />
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
