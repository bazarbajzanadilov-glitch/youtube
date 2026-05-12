import s from '../analytics/AnalyticsTabs.module.css'
import sx from './MonetizationExtras.module.css'
import KPICard from '../../components/ui/KPICard.jsx'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import StackedBarChart from '../../components/charts/StackedBarChart.jsx'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.jsx'
import { formatCompactNumber, formatMoneyShort, formatPercent } from '../../lib/analyticsFormat.js'
import { CHART_COLORS, REVENUE_SOURCE_PALETTE } from '../../lib/chartColors.js'

export default function MonetizationIncomeTab({ data, onOpenAdmin }) {
  const { monetization } = data
  if (monetization.enabled === false) {
    return (
      <EmptyState
        title="Монетизация отключена"
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }

  const stackedBars = [
    { key: 'ads', name: 'Реклама', color: REVENUE_SOURCE_PALETTE.ads },
    { key: 'premium', name: 'Premium', color: REVENUE_SOURCE_PALETTE.premium },
    { key: 'memberships', name: 'Спонсорства', color: REVENUE_SOURCE_PALETTE.memberships },
    { key: 'supers', name: 'Supers', color: REVENUE_SOURCE_PALETTE.supers },
    { key: 'shopping', name: 'Покупки', color: REVENUE_SOURCE_PALETTE.shopping },
  ]

  const sourceRows = monetization.sources.map((s) => ({
    label: s.label,
    share: s.share,
    amount: s.value,
    color: REVENUE_SOURCE_PALETTE[s.key] || CHART_COLORS.primary,
  }))

  return (
    <div className={s.layoutSingle}>
      <div className={s.kpiGrid}>
        <KPICard
          label="Доход"
          value={monetization.kpis.revenue.value}
          delta={data.range.kind === 'lifetime' ? undefined : monetization.kpis.revenue.delta}
          format={formatMoneyShort}
          highlighted
        />
        <KPICard label="Показы рекламы" value={monetization.kpis.adImpressions.value} format={formatCompactNumber} />
        <KPICard label="Монетизированные показы" value={monetization.kpis.monetizedPlaybacks.value} format={formatCompactNumber} />
      </div>

      <Card padding="lg" depth="lg">
        <div className={s.cardTitle}>Доход по источникам</div>
        <div className={s.cardSub}>Стэк по дням периода</div>
        <div className={s.spacer16}/>
        <StackedBarChart
          data={monetization.stackedSeries}
          xKey="date"
          bars={stackedBars}
          height={220}
          formatY={formatMoneyShort}
          formatTooltipValue={formatMoneyShort}
        />
      </Card>

      <div className={s.twoCol}>
        <Card padding="lg" depth="md">
          <div className={s.cardTitle}>Доли источников</div>
          <div className={s.cardSub}>За период</div>
          <div className={s.spacer16}/>
          <HorizontalBarChart
            data={sourceRows}
            formatValue={(v) => formatPercent(v * 100, 1)}
            showAmount
            formatAmount={formatMoneyShort}
          />
        </Card>

        <Card padding="lg" depth="md">
          <div className={s.cardTitle}>Источники по сумме</div>
          <ul className={sx.detailList}>
            {monetization.sources.map((src) => (
              <li key={src.key} className={sx.detailItem}>
                <span className={sx.dot} style={{ background: REVENUE_SOURCE_PALETTE[src.key] || CHART_COLORS.primary }}/>
                <span className={sx.detailLabel}>{src.label}</span>
                <span className={sx.detailShare}>{formatPercent(src.share * 100, 1)}</span>
                <span className={sx.detailValue}>{formatMoneyShort(src.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
