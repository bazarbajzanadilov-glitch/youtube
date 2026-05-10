import { useReducedMotion } from 'framer-motion'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import s from './AreaLineChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { useDeferredMount } from './useDeferredMount.js'

export default function RetentionLineChart({
  data = [],
  color = CHART_COLORS.purple,
  height = 220,
  formatValue = (v) => `${Math.round(v * 100)}%`,
}) {
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
  return (
    <div className={s.wrap} style={{ height }}>
      {ready ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.gridSoft} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="pct"
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
            type="number"
          />
          <YAxis
            stroke={CHART_COLORS.textSubtle}
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            domain={[0, 1.05]}
            width={42}
          />
          <Tooltip
            cursor={{ stroke: color, strokeDasharray: '3 5', strokeOpacity: 0.5 }}
            content={
              <ChartTooltip
                formatLabel={(pct) => `${pct}% длительности`}
                formatValue={(v) => `Удержание ${formatValue(v)}`}
              />
            }
            wrapperStyle={{ outline: 'none' }}
          />
          <Line
            type="monotone"
            dataKey="retained"
            name="Удержание"
            stroke={color}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#0f0f0f' }}
            isAnimationActive={!reduced}
            animationDuration={780}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  )
}
