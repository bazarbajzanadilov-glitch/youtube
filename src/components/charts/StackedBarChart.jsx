import { motion, useReducedMotion } from 'framer-motion'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
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
  return `${parseInt(m[3], 10)} ${RU_MONTHS_SHORT[parseInt(m[2], 10) - 1]}`
}
function defaultLabelFormatter(label) {
  return formatChartDateLabel(label)
}

export default function StackedBarChart({
  data = [],
  xKey = 'date',
  bars = [],
  height = 280,
  formatY = (n) => Number(n).toLocaleString('ru-RU'),
  formatTooltipValue,
  formatTooltipLabel = defaultLabelFormatter,
  showGrid = true,
  barRadius = 3,
}) {
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
  const tooltipFormatValue = formatTooltipValue || ((val) => formatY(val))

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
        <BarChart data={data} margin={{ top: 12, right: 12, left: 8, bottom: 4 }} barCategoryGap="28%">
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
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={<ChartTooltip formatLabel={formatTooltipLabel} formatValue={tooltipFormatValue} />}
            wrapperStyle={{ outline: 'none' }}
          />
          {bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              stackId="stack"
              fill={b.color}
              radius={i === bars.length - 1 ? [barRadius, barRadius, 0, 0] : 0}
              isAnimationActive={false}
              animationDuration={0}
              animationBegin={0}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      </motion.div>
      ) : null}
    </div>
  )
}
