import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { useDeferredMount } from './useDeferredMount.js'
import { CHART_ANIMATION_MS } from './chartAnimation.js'

export default function SparklineChart({
  values = [],
  color = CHART_COLORS.primary,
  height = 36,
  animationDuration = CHART_ANIMATION_MS,
}) {
  const id = useId()
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
  const data = values.map((v, i) => ({ i, v }))
  if (data.length === 0) return <div style={{ height }} />
  return (
    <div style={{ width: '100%', height, pointerEvents: 'none' }}>
      {ready ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={data} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.areaFill} stopOpacity={1} />
              <stop offset="100%" stopColor={CHART_COLORS.areaFill} stopOpacity={1} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={!reduced}
            animationDuration={animationDuration}
          />
        </AreaChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  )
}
