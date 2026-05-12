import s from '../analytics/AnalyticsTabs.module.css'
import sx from './MonetizationExtras.module.css'
import KPICard from '../../components/ui/KPICard.jsx'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import DonutChart from '../../components/charts/DonutChart.jsx'
import { formatCompactNumber, formatPercent, formatNumberRu } from '../../lib/analyticsFormat.js'
import { CHART_COLORS } from '../../lib/chartColors.js'

const AD_FORMATS = [
  { label: 'Видео в начале', share: 0.42, color: CHART_COLORS.primary },
  { label: 'Поверх плеера', share: 0.18, color: CHART_COLORS.purple },
  { label: 'Skippable', share: 0.22, color: CHART_COLORS.green },
  { label: 'Non-skippable', share: 0.10, color: CHART_COLORS.amber },
  { label: 'Баннер', share: 0.08, color: CHART_COLORS.cyan },
]

export default function MonetizationAdsTab({ data, onOpenAdmin }) {
  const { monetization } = data
  if (monetization.enabled === false) {
    return (
      <EmptyState
        title="Реклама недоступна"
        description="Включите монетизацию в админке."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }

  const fillRate = 0.84
  const formatData = AD_FORMATS.map((f) => ({
    label: f.label,
    value: monetization.kpis.adImpressions.value * f.share,
    color: f.color,
  }))

  return (
    <div className={s.layoutSingle}>
      <div className={s.kpiGrid}>
        <KPICard label="Показы рекламы" value={monetization.kpis.adImpressions.value} format={formatCompactNumber} highlighted />
        <KPICard label="Fill rate" value={fillRate * 100} format={(n) => formatPercent(n, 0)} hint="доля заполненных мест" />
        <KPICard label="Монетизированные просмотры" value={monetization.kpis.monetizedPlaybacks.value} format={formatCompactNumber} />
      </div>

      <Card padding="lg" depth="lg">
        <div className={s.cardTitle}>Динамика показов рекламы</div>
        <div className={s.cardSub}>За период</div>
        <div className={s.spacer16}/>
        <AreaLineChart
          data={monetization.series.map((d) => ({ ...d, ads: Math.round(d.views * 1.4 * fillRate) }))}
          dataKey="ads"
          xKey="date"
          color={CHART_COLORS.primary}
          height={210}
          name="Показы"
          formatY={formatCompactNumber}
          formatTooltipValue={formatNumberRu}
        />
      </Card>

      <div className={s.twoCol}>
        <Card padding="lg" depth="md">
          <div className={s.cardTitle}>Форматы рекламы</div>
          <div className={s.cardSub}>Распределение показов</div>
          <div className={s.spacer16}/>
          <DonutChart
            data={formatData}
            height={240}
            innerRadius={54}
            outerRadius={84}
            centerLabel="Показы"
            centerValue={formatCompactNumber(monetization.kpis.adImpressions.value)}
            formatValue={(v) => formatCompactNumber(v)}
          />
          <ul className={sx.detailList}>
            {AD_FORMATS.map((f) => (
              <li key={f.label} className={sx.detailItem}>
                <span className={sx.dot} style={{ background: f.color }} />
                <span className={sx.detailLabel}>{f.label}</span>
                <span className={sx.detailShare}>{formatPercent(f.share * 100, 0)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg" depth="md">
          <div className={s.cardTitle}>Заполняемость и стоимость</div>
          <div className={s.cardSub}>Параметры рекламного блока</div>
          <ul className={sx.detailList}>
            <li className={sx.detailItem}>
              <span className={sx.dot} style={{ background: CHART_COLORS.green }} />
              <span className={sx.detailLabel}>Fill rate</span>
              <span className={sx.detailShare}>{formatPercent(fillRate * 100, 0)}</span>
              <span className={sx.detailValue}>лучше нормы</span>
            </li>
            <li className={sx.detailItem}>
              <span className={sx.dot} style={{ background: CHART_COLORS.amber }} />
              <span className={sx.detailLabel}>Просмотры с рекламой</span>
              <span className={sx.detailShare} />
              <span className={sx.detailValue}>{formatNumberRu(monetization.kpis.monetizedPlaybacks.value)}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
