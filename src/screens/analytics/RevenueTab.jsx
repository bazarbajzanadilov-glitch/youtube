import s from './AnalyticsTabs.module.css'
import Card from '../../components/ui/Card.jsx'
import AnimatedCounter from '../../components/ui/AnimatedCounter.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { formatMoneyFixed, formatMoneyShort } from '../../lib/analyticsFormat.js'
import { CHART_COLORS } from '../../lib/chartColors.js'
import clockIcon from '../../assets/clock.svg'

export default function RevenueTab({ data }) {
  const { monetization } = data
  const revenue = monetization?.kpis?.revenue?.value || 0
  const series = monetization?.series || []

  return (
    <div className={s.layoutSingle}>
      <Card padding="lg" depth="lg" className={s.revenueHeroCard}>
        <div className={s.revenueSummary}>
          <span className={`${s.revenueSummaryLabel} ${s.revenueSummaryLabelWithIcon}`}>
            <span>Расчетный доход</span>
            <img className={s.inlineKpiLabelIcon} src={clockIcon} alt="" aria-hidden="true" />
          </span>
          <span className={s.revenueSummaryValue}>
            <AnimatedCounter value={revenue} format={(n) => formatMoneyFixed(n)} />
          </span>
        </div>

        <div className={s.revenueChartOffset}>
          <AreaLineChart
            data={series}
            dataKey="revenue"
            xKey="date"
            color={CHART_COLORS.primary}
            height={260}
            name="Доход"
            formatY={(n) => formatMoneyShort(n)}
            formatTooltipValue={(v) => formatMoneyFixed(v)}
            yAxisOrientation="right"
          />
        </div>
      </Card>
    </div>
  )
}
