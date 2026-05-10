import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { useDeferredMount } from './useDeferredMount.js'

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
  if (typeof label !== 'string') return label
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label)
  if (!m) return label
  const d = new Date(label)
  const w = ['вс','пн','вт','ср','чт','пт','сб'][d.getDay()]
  return `${w}, ${parseInt(m[3], 10)} ${RU_MONTHS_SHORT[parseInt(m[2], 10) - 1]} ${m[1]}`
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
  curve = 'linear',
}) {
  const gradientId = useId()
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
  const last = data.length > 0 ? data[data.length - 1] : null
  const tooltipFormatValue = formatTooltipValue || ((val) => formatY(val))

  return (
    <div className={s.wrap} style={{ height }}>
      {ready ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="55%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {showGrid ? (
            <CartesianGrid stroke={CHART_COLORS.gridSoft} strokeDasharray="3 6" vertical={false} />
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
            isAnimationActive={!reduced}
            animationDuration={780}
            animationEasing="ease-out"
            activeDot={{ r: 6, stroke: color, strokeWidth: 2.5, fill: '#0f0f0f' }}
            dot={data.length <= 14 ? { r: 3, stroke: color, strokeWidth: 1.5, fill: color } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  )
}
