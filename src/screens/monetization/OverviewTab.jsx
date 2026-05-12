import { motion } from 'framer-motion'
import s from '../analytics/AnalyticsTabs.module.css'
import sx from './MonetizationExtras.module.css'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AnimatedCounter from '../../components/ui/AnimatedCounter.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import StackedBarChart from '../../components/charts/StackedBarChart.jsx'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.jsx'
import {
  formatNumberRu, formatMoneyFixed, formatMoneyShort, formatDateLong, formatPercent,
} from '../../lib/analyticsFormat.js'
import { CHART_COLORS, REVENUE_SOURCE_PALETTE } from '../../lib/chartColors.js'
import { KpiArrowUpIcon } from '../icons.jsx'
import clockIcon from '../../assets/clock.svg'
import { useState } from 'react'

const inlineKpiVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function buildPublishedMarkers(videos, series) {
  const dates = new Set(series.map((row) => row.date))
  const seen = new Set()
  const markers = []
  for (const video of videos) {
    if (!video.date || !dates.has(video.date) || seen.has(video.date)) continue
    seen.add(video.date)
    markers.push({ date: video.date, label: video.title })
    if (markers.length >= 8) break
  }
  return markers
}

function rangeMessage(range) {
  switch (range.kind) {
    case 'lifetime': return 'За всё время вы заработали'
    case '7d': return 'За последние 7 дней вы заработали'
    case '28d': return 'За последние 28 дней вы заработали'
    case '90d': return 'За последние 90 дней вы заработали'
    case '365d': return 'За последний год вы заработали'
    case 'custom': return 'За выбранный период вы заработали'
    default: return 'За выбранный период вы заработали'
  }
}

function InlineKPI({
  label,
  labelIcon,
  value,
  format,
  hint,
  isFirst,
  mark = true,
  hideMeta = false,
  onClick,
  active = false,
}) {
  const Tag = onClick ? motion.button : motion.div
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${s.inlineKpi} ${onClick ? s.inlineKpiButton : ''} ${active ? s.inlineKpiActive : ''} ${isFirst ? '' : s.inlineKpiBordered}`}
      variants={inlineKpiVariants}
      onClick={onClick}
    >
      <div className={labelIcon ? `${s.inlineKpiLabel} ${s.inlineKpiLabelWithIcon}` : s.inlineKpiLabel}>
        <span>{label}</span>
        {labelIcon ? <img className={s.inlineKpiLabelIcon} src={labelIcon} alt="" aria-hidden="true" /> : null}
      </div>
      <div className={s.inlineKpiValue}>
        <AnimatedCounter value={Number(value) || 0} format={format} />
        {mark ? <span className={s.inlineKpiTrendIcon}><KpiArrowUpIcon /></span> : null}
      </div>
      {hideMeta ? null : (
        <div className={s.inlineKpiHint}>
          <span className={s.inlineKpiHintText}>{hint}</span>
        </div>
      )}
    </Tag>
  )
}

export default function MonetizationOverviewTab({ data, onOpenAdmin }) {
  const { monetization, range } = data
  const [chartMetric, setChartMetric] = useState('revenue')

  if (monetization.enabled === false) {
    return (
      <EmptyState
        title="Монетизация отключена"
        description="Включите партнёрскую программу в админке (раздел «Канал» → флаг «Монетизация»), чтобы видеть доходы и расщепление по источникам."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }
  if (monetization.kpis.revenue.value === 0) {
    return (
      <EmptyState
        title="Нет данных о доходе"
        description="Добавьте расчетный доход у видео в админке — после этого здесь появятся график и источники монетизации."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }

  const k = monetization.kpis
  const stackedBars = [
    { key: 'ads', name: 'Реклама', color: REVENUE_SOURCE_PALETTE.ads },
    { key: 'premium', name: 'YouTube Premium', color: REVENUE_SOURCE_PALETTE.premium },
    { key: 'memberships', name: 'Спонсорства', color: REVENUE_SOURCE_PALETTE.memberships },
    { key: 'supers', name: 'Supers', color: REVENUE_SOURCE_PALETTE.supers },
    { key: 'shopping', name: 'Покупки', color: REVENUE_SOURCE_PALETTE.shopping },
  ]
  const sourceRows = monetization.sources.map((src) => ({
    label: src.label,
    share: src.share,
    amount: src.value,
    color: REVENUE_SOURCE_PALETTE[src.key] || CHART_COLORS.primary,
  }))
  const topRevenueVideos = [...data.overview.topVideos]
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 5)
  const totalRev = monetization.kpis.revenue.value
  const sourceMap = Object.fromEntries(monetization.sources.map((src) => [src.key, src]))
  const publishedMarkers = buildPublishedMarkers(data.overview.topVideos, monetization.series)
  const maxRevenuePoint = Math.max(1, ...monetization.series.map((row) => Number(row.revenue) || 0))
  const chartConfigs = {
    ads: {
      data: monetization.stackedSeries,
      dataKey: 'ads',
      name: 'Реклама',
      formatY: (n) => formatMoneyShort(n),
      formatTooltipValue: (v) => formatMoneyFixed(v),
    },
    premium: {
      data: monetization.stackedSeries,
      dataKey: 'premium',
      name: 'YouTube Premium',
      formatY: (n) => formatMoneyShort(n),
      formatTooltipValue: (v) => formatMoneyFixed(v),
    },
    shopping: {
      data: monetization.stackedSeries,
      dataKey: 'shopping',
      name: 'Покупки и товары',
      formatY: (n) => formatMoneyShort(n),
      formatTooltipValue: (v) => formatMoneyFixed(v),
    },
    revenue: {
      data: monetization.series,
      dataKey: 'revenue',
      name: 'Доход',
      formatY: (n) => formatMoneyShort(n),
      formatTooltipValue: (v) => formatMoneyFixed(v),
    },
  }
  const chartConfig = chartConfigs[chartMetric] || chartConfigs.revenue

  return (
    <div className={s.overviewLayout}>
      <div className={s.overviewMain}>
        {/* HERO CARD per PDF style — same pattern as Analytics overview */}
        <Card padding="lg" depth="lg" className={s.heroCardPdf}>
          <h2 className={s.heroPdfTitle}>
            <span>{rangeMessage(range)}</span>
            <strong>
              <AnimatedCounter value={totalRev} format={(n) => formatMoneyShort(n)} />
            </strong>
          </h2>

          <motion.div
            className={`${s.inlineKpiRow} ${sx.revenueKpiRow}`}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden"
            animate="show"
          >
            <InlineKPI
              label="Реклама"
              value={sourceMap.ads?.value || 0}
              format={(n) => formatMoneyShort(n)}
              hint={sourceMap.ads ? formatPercent(sourceMap.ads.share * 100, 1) : 'нет данных'}
              isFirst
              onClick={() => setChartMetric('ads')}
              active={chartMetric === 'ads'}
            />
            <InlineKPI
              label="YouTube Premium"
              value={sourceMap.premium?.value || 0}
              format={(n) => formatMoneyShort(n)}
              hint={sourceMap.premium ? formatPercent(sourceMap.premium.share * 100, 1) : 'нет данных'}
              onClick={() => setChartMetric('premium')}
              active={chartMetric === 'premium'}
            />
            <InlineKPI
              label="Покупки и товары"
              value={sourceMap.shopping?.value || 0}
              format={(n) => formatMoneyShort(n)}
              hint={sourceMap.shopping ? formatPercent(sourceMap.shopping.share * 100, 1) : 'нет данных'}
              onClick={() => setChartMetric('shopping')}
              active={chartMetric === 'shopping'}
            />
            <InlineKPI
              label="Расчетный доход"
              labelIcon={clockIcon}
              value={k.revenue.value}
              format={(n) => formatMoneyFixed(n)}
              hideMeta
              mark={false}
              onClick={() => setChartMetric('revenue')}
              active={chartMetric === 'revenue'}
            />
          </motion.div>

          <div className={s.heroChartWrap}>
            <AreaLineChart
              key={chartMetric}
              data={chartConfig.data}
              dataKey={chartConfig.dataKey}
              xKey="date"
              color={CHART_COLORS.primary}
              height={210}
              name={chartConfig.name}
              formatY={chartConfig.formatY}
              formatTooltipValue={chartConfig.formatTooltipValue}
              yAxisOrientation="right"
              yDomain={[0, maxRevenuePoint]}
              eventMarkers={chartMetric === 'revenue' ? publishedMarkers : []}
            />
          </div>

          <div className={s.heroPdfFooter}>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </div>
        </Card>

        {/* Sources breakdown — 2-col like Analytics Content tab */}
        <div className={s.contentGrid}>
          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Источники дохода</div>
            <div className={s.cardSub}>Разбивка по дням периода</div>
            <div className={s.spacer16}/>
            <StackedBarChart
              data={monetization.stackedSeries}
              xKey="date"
              bars={stackedBars}
              height={240}
              formatY={formatMoneyShort}
              formatTooltipValue={formatMoneyFixed}
            />
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Доли источников</div>
            <div className={s.cardSub}>За {range.label.toLowerCase()}</div>
            <div className={s.spacer16}/>
            <HorizontalBarChart
              data={sourceRows}
              formatValue={(v) => formatPercent(v * 100, 1)}
              showAmount
              formatAmount={formatMoneyShort}
            />
          </Card>
        </div>

        <h2 className={s.popularPdfTitle}>Самый прибыльный контент</h2>
        <Card padding="none" depth="md">
          <table className={s.popularPdfTable}>
            <thead>
              <tr>
                <th className={s.first}>Видео</th>
                <th className={s.right}>Просмотры</th>
                <th className={s.right}>Доход</th>
              </tr>
            </thead>
            <tbody>
              {topRevenueVideos.map((v, i) => (
                <tr key={v.id}>
                  <td className={s.first}>
                    <div className={s.popContent}>
                      <span className={s.rank}>{i + 1}</span>
                      <div className={s.popThumb}>
                        {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                      </div>
                      <div>
                        <div className={s.popName}>{v.title}</div>
                        <div className={s.popDate}>{formatDateLong(v.date)}</div>
                      </div>
                    </div>
                  </td>
                  <td className={s.right}>{formatNumberRu(v.views)}</td>
                  <td className={s.right}>{formatMoneyShort(v.revenue || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Right side — same structure as Analytics overview side card */}
      <div className={s.overviewSide}>
        <Card padding="lg" depth="md" className={s.sidePdfCard}>
          <div className={s.sidePdfTitle}>Партнёрская программа</div>
          <div className={sx.programStatusRow}>
            <span className={sx.programStatusDot} />
            <span>Активна</span>
          </div>
          <div className={s.sidePdfBigStat}>
            <AnimatedCounter value={totalRev} format={(n) => formatMoneyShort(n)} />
          </div>
          <div className={s.sidePdfStatLabel}>Общий доход за период</div>
          <button type="button" className={s.sidePdfDetailsBtn}>История платежей</button>

          <div className={s.sidePdfDivider} />
          <div className={s.sidePdfTitle}>До следующего платежа</div>
          <div className={sx.payoutBar}>
            <div
              className={sx.payoutFill}
              style={{ width: `${Math.min(100, (totalRev / 100) * 100)}%` }}
            />
          </div>
          <div className={s.sidePdfStatLabel}>
            {formatMoneyShort(Math.max(0, 100 - totalRev))} до выплаты ($100)
          </div>

          <div className={s.sidePdfDivider} />
          <div className={s.sidePdfTitle}>Подключённые программы</div>
          <ul className={sx.programList}>
            {monetization.sources.map((src) => (
              <li key={src.key} className={sx.programRow}>
                <span className={sx.programDot} style={{ background: REVENUE_SOURCE_PALETTE[src.key] || CHART_COLORS.primary }}/>
                <span className={sx.programLabel}>{src.label}</span>
                <span className={sx.programVal}>{formatMoneyShort(src.value)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="md" depth="md" className={s.sidePdfCard}>
          <div className={s.sidePdfTitle}>Полезные ссылки</div>
          <button type="button" className={sx.linkRow}>
            Правила монетизации <span className={sx.linkArrow}>→</span>
          </button>
          <button type="button" className={sx.linkRow}>
            Налоговая информация <span className={sx.linkArrow}>→</span>
          </button>
          <button type="button" className={sx.linkRow}>
            Платёжный профиль <span className={sx.linkArrow}>→</span>
          </button>
          <button type="button" className={sx.linkRow}>
            Обратная связь <span className={sx.linkArrow}>→</span>
          </button>
        </Card>
      </div>
    </div>
  )
}
