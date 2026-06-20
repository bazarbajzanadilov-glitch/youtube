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

function defaultXTickFormatter(value) {
  if (typeof value !== 'string') return value
  return formatDateLong(value)
}

function defaultLabelFormatter(label) {
  return formatChartDateLabel(label)
}

export default function AreaLineChart({
  data = [],
  dataKey = 'views',
  xKey = 'date',
  color = CHART_COLORS.primary,
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
  xTickFontSize = 11,
  yTickFontSize = 11,
  xTickFormatter = defaultXTickFormatter,
  tooltipClassName = '',
  tooltipLabelClassName = '',
  tooltipValueClassName = '',
  tooltipCursor,
  activeDotProps,
  fillTopOpacity = 0.1,
  fillBottomOpacity = 0,
}) {
  const gradientId = useId()
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
    left: 8,
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

  return (
    <div className={s.wrap} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={data} margin={chartMargin}>
          <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={showAreaFill ? fillTopOpacity : 0} />
              <stop offset="100%" stopColor={color} stopOpacity={showAreaFill ? fillBottomOpacity : 0} />
            </linearGradient>
          </defs>
          {showGrid ? (
            <CartesianGrid stroke={CHART_COLORS.gridSoft} vertical={false} />
          ) : null}
          <XAxis
            dataKey={xKey}
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: xTickFontSize }}
            tickLine={false}
            axisLine={false}
            tickFormatter={xTickFormatter}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation={yAxisOrientation}
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: yTickFontSize }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            width={yAxisWidth}
            domain={yDomain || [0, 'auto']}
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
