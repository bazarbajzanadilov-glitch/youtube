import { useId } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'
import { formatDateLong } from '../../lib/analyticsFormat.js'
import { buildNiceAxisTicks, maxByDataKey } from './chartAxis.js'

function defaultXTickFormatter(value) {
  if (typeof value !== 'string') return value
  return formatDateLong(value)
}

function defaultLabelFormatter(label) {
  return formatChartDateLabel(label)
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
}) {
  const gradientId = useId()
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
  const chartMargin = margin || {
    top: 16,
    right: yAxisOrientation === 'right' ? 56 : 16,
    left: 0,
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
  const autoYTicks = buildNiceAxisTicks(maxByDataKey(data, dataKey), {
    scale: yValueScale,
    targetTickCount: yTickCount,
  })
  const chartYTicks = yTicks || (yDomain ? undefined : autoYTicks)
  const chartYDomain = yDomain || [0, chartYTicks?.[chartYTicks.length - 1] || 1]
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
        <AreaChart data={data} margin={chartMargin}>
          <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartFillColor} stopOpacity={showAreaFill ? fillTopOpacity : 0} />
              <stop offset="100%" stopColor={chartFillColor} stopOpacity={showAreaFill ? fillBottomOpacity : 0} />
            </linearGradient>
          </defs>
          {showGrid ? (
            <CartesianGrid stroke={CHART_COLORS.gridSoft} vertical={false} />
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
            tickFormatter={formatY}
            width={yAxisWidth}
            domain={chartYDomain}
            ticks={chartYTicks}
          />
          <Tooltip
            cursor={chartCursor}
            content={(
              <ChartTooltip
                formatLabel={formatTooltipLabel}
                formatValue={tooltipFormatValue}
                className={tooltipClassName}
                labelClassName={tooltipLabelClassName}
                valueClassName={tooltipValueClassName}
              />
            )}
            wrapperStyle={{ outline: 'none' }}
          />
          {last ? (
            <ReferenceLine x={last[xKey]} stroke={CHART_COLORS.gridSoft} strokeDasharray="2 4" />
          ) : null}
          <Area
            type={curve}
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={showAreaFill ? `url(#${gradientId})` : 'transparent'}
            fillOpacity={showAreaFill ? 1 : 0}
            isAnimationActive={false}
            animationDuration={0}
            animationEasing="ease-out"
            activeDot={chartActiveDot}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
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
