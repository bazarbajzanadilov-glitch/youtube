import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { useDeferredMount } from './useDeferredMount.js'
import { CHART_ANIMATION_SECONDS } from './chartAnimation.js'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'

const RU_MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

function formatXTick(value) {
  if (typeof value !== 'string') return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return value
  const day = parseInt(m[3], 10)
  const month = parseInt(m[2], 10) - 1
  return `${day} ${RU_MONTHS_SHORT[month]}`
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
}) {
  const gradientId = useId()
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
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
  const chartMargin = {
    top: 16,
    right: yAxisOrientation === 'right' ? 56 : 16,
    left: 8,
    bottom: markerIndexes.length > 0 ? 30 : 4,
  }

  return (
    <div className={s.wrap} style={{ height }}>
      {ready ? (
      <motion.div
        style={{ width: '100%', height: '100%' }}
        initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: CHART_ANIMATION_SECONDS, ease: 'easeOut' }}
      >
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.areaFill} stopOpacity={1} />
              <stop offset="100%" stopColor={CHART_COLORS.areaFill} stopOpacity={1} />
            </linearGradient>
          </defs>
          {showGrid ? (
            <CartesianGrid stroke={CHART_COLORS.gridSoft} vertical={false} />
          ) : null}
          <XAxis
            dataKey={xKey}
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatXTick}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation={yAxisOrientation}
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            width={48}
            domain={yDomain || [0, 'auto']}
          />
          <Tooltip
            cursor={{ stroke: color, strokeDasharray: '3 5', strokeOpacity: 0.55 }}
            content={<ChartTooltip formatLabel={formatTooltipLabel} formatValue={tooltipFormatValue} />}
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
            strokeWidth={2.8}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            isAnimationActive={false}
            animationDuration={0}
            animationEasing="ease-out"
            activeDot={{ r: 6, stroke: color, strokeWidth: 2.5, fill: '#0f0f0f' }}
            dot={data.length <= 14 ? { r: 3, stroke: color, strokeWidth: 1.5, fill: color } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
      </motion.div>
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
