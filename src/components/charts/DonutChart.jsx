import { useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Sector, Tooltip } from 'recharts'
import s from './DonutChart.module.css'
import ChartTooltip from '../ui/ChartTooltip.jsx'
import { CHART_COLORS, PALETTE_5 } from '../../lib/chartColors.js'
import { useDeferredMount } from './useDeferredMount.js'

function ActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  )
}

export default function DonutChart({
  data = [],
  height = 220,
  centerLabel,
  centerValue,
  innerRadius = 60,
  outerRadius = 86,
  formatValue = (v) => Number(v).toLocaleString('ru-RU'),
  palette = PALETTE_5,
}) {
  const reduced = useReducedMotion()
  const ready = useDeferredMount()
  const [activeIndex, setActiveIndex] = useState(-1)
  if (data.length === 0) return null

  return (
    <div className={s.wrap} style={{ height }}>
      {ready ? (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <PieChart>
          <Tooltip
            content={<ChartTooltip formatValue={formatValue} />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="label"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
            isAnimationActive={!reduced}
            animationDuration={780}
            animationEasing="ease-out"
            activeIndex={activeIndex}
            activeShape={ActiveShape}
            onMouseEnter={(_, i) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(-1)}
          >
            {data.map((d, i) => (
              <Cell key={`c-${i}`} fill={d.color || palette[i % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      ) : null}
      {(centerLabel || centerValue) && (
        <div className={s.center}>
          {centerValue ? <div className={s.centerValue}>{centerValue}</div> : null}
          {centerLabel ? <div className={s.centerLabel}>{centerLabel}</div> : null}
        </div>
      )}
    </div>
  )
}
