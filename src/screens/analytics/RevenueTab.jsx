import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { formatDateLong, formatNumberRu } from '../../lib/analyticsFormat.js'
import clockIcon from '../../assets/clock.svg'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'
import s from './AnalyticsTabs.module.css'
import {
  formatTenge,
  formatTengeAxis,
} from './studioAnalyticsHelpers.js'

const REVENUE_LINE_COLOR = '#56b0aa'
const REVENUE_FILL_COLOR = '#132121'

const REVENUE_FILTERS = [
  'Все',
  'Реклама на странице просмотра',
  'Реклама в ленте Shorts',
  'Спонсорство',
  'Суперфункции и подарки',
  'Партнерская программа',
]

const SOURCE_LABELS = {
  ads: 'Реклама на странице просмотра',
  premium: 'YouTube Premium',
  memberships: 'Спонсорство',
  supers: 'Суперфункции и подарки',
  shopping: 'Партнерская программа',
}

const MINI_BAR_WIDTH = 150

function monthName(dateIso, isLast) {
  const date = new Date(dateIso)
  const month = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][date.getMonth()]
  return isLast ? `${month} (данные неполные)` : month
}

function buildMonthlyRows(series) {
  const buckets = new Map()
  series.forEach((row) => {
    const key = row.date.slice(0, 7)
    buckets.set(key, (buckets.get(key) || 0) + (Number(row.revenue) || 0))
  })
  const latestDate = series.length > 0 ? new Date(series[series.length - 1].date) : new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(latestDate.getFullYear(), latestDate.getMonth() - index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      key,
      label: monthName(`${key}-01`, index === 0),
      value: buckets.get(key) || 0,
    }
  })
}

function formatRevenueTooltipLabel(dateIso) {
  return formatChartDateLabel(dateIso)
}

function metricSpark(value, maxValue) {
  if (!(value > 0) || !(maxValue > 0)) return null
  const ratio = value / maxValue
  if (ratio < 0.08) return { kind: 'dot', width: 10 }
  return { kind: 'bar', width: Math.max(32, Math.round(MINI_BAR_WIDTH * ratio)) }
}

export default function RevenueTab({ data }) {
  const { monetization, overview, range } = data
  const [activeFilter, setActiveFilter] = useState(0)
  const revenue = monetization?.kpis?.revenue?.value || 0
  const sources = useMemo(() => (
    (monetization?.sources || []).map((source) => ({
      label: SOURCE_LABELS[source.key] || source.label,
      amount: source.value,
    }))
  ), [monetization?.sources])
  const monthlyRows = useMemo(() => buildMonthlyRows(monetization?.series || []), [monetization?.series])
  const monthlyMax = Math.max(0, ...monthlyRows.map((row) => row.value))
  const totalViews = overview?.kpis?.views?.value || 0
  const topRevenueVideos = (overview?.topVideos || [])
    .map((video) => {
      const share = totalViews > 0 ? (Number(video.views) || 0) / totalViews : 0
      return { ...video, estRevenue: revenue * share }
    })
    .sort((a, b) => (b.estRevenue || 0) - (a.estRevenue || 0))
    .slice(0, 5)
  const performanceRevenue = topRevenueVideos.reduce((sum, video) => sum + (video.estRevenue || 0), 0)
  const interestedViews = Math.round(topRevenueVideos.reduce((sum, video) => sum + Math.round((video.views || 0) * 0.74), 0))
  const revenuePerThousandInterested = interestedViews > 0
    ? (performanceRevenue / interestedViews) * 1000
    : 0
  const sourcesMax = Math.max(0, ...sources.map((item) => item.amount || 0))
  const performanceMax = Math.max(0, ...topRevenueVideos.map((item) => item.estRevenue || 0))

  return (
    <div className={`${s.tabStack} ${s.revenueRail}`}>
      <div className={s.filterChips}>
        {REVENUE_FILTERS.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`${s.filterChip} ${activeFilter === index ? s.filterChipActive : ''}`}
            onClick={() => setActiveFilter(index)}
          >
            {item}
          </button>
        ))}
      </div>

      <Card padding="none" depth="lg" className={s.ytHeroCard}>
        <div className={`${s.ytKpiStrip} ${s.ytKpiStripOne}`}>
          <div className={`${s.ytKpiCell} ${s.ytKpiCellActive}`}>
            <div className={s.ytKpiLabel}>Расчетный доход <img className={s.clockBadge} src={clockIcon} alt="" aria-hidden="true" /></div>
            <div className={s.ytKpiValue}>{formatTenge(revenue)}</div>
          </div>
        </div>
        <div className={s.ytHeroChart}>
          <AreaLineChart
            data={monetization?.series || []}
            dataKey="revenue"
            xKey="date"
            color={REVENUE_LINE_COLOR}
            fillColor={REVENUE_FILL_COLOR}
            height={168}
            name="Расчетный доход"
            formatY={formatTengeAxis}
            xTickFormatter={formatDateLong}
            formatTooltipValue={formatTenge}
            formatTooltipLabel={formatRevenueTooltipLabel}
            yAxisOrientation="right"
            yValueScale={512}
            yAxisWidth={88}
            margin={{ top: 22, right: 86, left: 0, bottom: 6 }}
            xTickFontSize={12}
            yTickFontSize={12}
            tooltipClassName={s.revenueHeroTooltip}
            tooltipLabelClassName={s.revenueHeroTooltipLabel}
            tooltipValueClassName={s.revenueHeroTooltipValue}
            tooltipCursor={{ stroke: '#6c6c6c', strokeOpacity: 0.8, strokeWidth: 1 }}
            fillTopOpacity={1}
            fillBottomOpacity={0.65}
            activeDotProps={{ r: 5, stroke: '#282828', strokeWidth: 2, fill: REVENUE_LINE_COLOR }}
          />
        </div>
        <div className={s.ytHeroFooter}>
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </div>
      </Card>

      <div className={s.twoColumnGrid}>
        <Card padding="none" depth="md" className={`${s.tableCard} ${s.revenueBreakdownCard}`}>
          <div className={s.tableHeader}>
            <div>
              <div className={`${s.cardTitle} ${s.cardTitleInline}`}>
                <span>Ваш доход</span>
                <img className={s.clockBadgeSmall} src={clockIcon} alt="" aria-hidden="true" />
              </div>
              <div className={s.cardSub}>Примерно · Последние 6 месяцев</div>
            </div>
          </div>
          <div className={s.revenueMetricRows}>
            {monthlyRows.map((row) => {
              const spark = metricSpark(row.value, monthlyMax)
              return (
                <div key={row.key} className={s.revenueMetricRow}>
                  <div className={s.revenueMetricLabel}>{row.label}</div>
                  <div className={s.revenueMetricSparkArea}>
                    {spark ? (
                      <span
                        className={spark.kind === 'dot' ? s.revenueMetricDot : s.revenueMetricBar}
                        style={spark.kind === 'bar' ? { width: `${spark.width}px` } : undefined}
                      />
                    ) : null}
                  </div>
                  <div className={s.revenueMetricValue}>{formatTenge(row.value)}</div>
                </div>
              )
            })}
          </div>
          <div className={`${s.tableFooter} ${s.revenueCardFooter}`}>
            <button type="button" className={s.ytPillBtn}>Подробнее</button>
          </div>
        </Card>

        <Card padding="none" depth="md" className={`${s.tableCard} ${s.revenueSourcesCard}`}>
          <div className={s.tableHeader}>
            <div>
              <div className={`${s.cardTitle} ${s.cardTitleInline}`}>
                <span>Ваши источники дохода</span>
                <img className={s.clockBadgeSmall} src={clockIcon} alt="" aria-hidden="true" />
              </div>
              <div className={s.cardSub}>Примерно · {range.label}</div>
            </div>
          </div>
          <div className={s.innerTabs}>
            {['Все', 'Shorts', 'Трансляции'].map((tab, index) => (
              <button key={tab} type="button" className={`${s.innerTab} ${index === 0 ? s.innerTabActive : ''}`}>{tab}</button>
            ))}
          </div>
          <div className={s.revenueSourceList}>
            {sources.map((source) => {
              const spark = metricSpark(source.amount, sourcesMax)
              return (
                <div className={s.revenueSourceRow} key={source.label}>
                  <span className={s.revenueSourceLabel}>{source.label}</span>
                  <div className={s.revenueSourceSparkArea}>
                    {spark ? (
                      <span
                        className={spark.kind === 'dot' ? s.revenueMetricDot : s.revenueMetricBar}
                        style={spark.kind === 'bar' ? { width: `${spark.width}px` } : undefined}
                      />
                    ) : null}
                  </div>
                  <strong>{formatTenge(source.amount)}</strong>
                </div>
              )
            })}
          </div>
          <div className={`${s.tableFooter} ${s.revenueCardFooter}`}>
            <button type="button" className={s.ytPillBtn}>Подробнее</button>
          </div>
        </Card>
      </div>

      <Card padding="none" depth="md" className={`${s.tableCard} ${s.revenuePerformanceCard}`}>
        <div className={s.tableHeader}>
          <div>
            <div className={`${s.cardTitle} ${s.cardTitleInline}`}>
              <span>Эффективность контента</span>
              <img className={s.clockBadgeSmall} src={clockIcon} alt="" aria-hidden="true" />
            </div>
            <div className={s.cardSub}>{range.label}</div>
          </div>
          <div className={s.innerTabs}>
            <button type="button" className={`${s.innerTab} ${s.innerTabActive}`}>Shorts</button>
            <button type="button" className={s.innerTab}>Трансляции</button>
          </div>
        </div>
        <div className={s.revenuePerformanceLead}>
          <strong>{formatTenge(performanceRevenue)}</strong>
          <span>Расчетный доход</span>
        </div>
        <div className={s.revenuePerformanceSummaryCompact}>
          <div className={s.performanceMetricCompact}>
            <strong>{formatNumberRu(interestedViews)}</strong>
            <span>Заинтересованные просмотры</span>
          </div>
          <div className={s.performanceMetricCompact}>
            <strong>{formatTenge(revenuePerThousandInterested)}</strong>
            <span>Доход на тысячу заинтересованных просмотров</span>
          </div>
        </div>
        <div className={s.revenuePerformanceList}>
          {topRevenueVideos.map((video) => {
            const spark = metricSpark(video.estRevenue, performanceMax)
            return (
              <div key={video.id} className={s.revenuePerformanceRow}>
                <div className={s.revenuePerformanceVideo}>
                  <div className={s.revenuePerformanceThumb}>
                    {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                  </div>
                  <div className={s.revenuePerformanceMeta}>
                    <div className={s.revenuePerformanceTitle}>{video.title}</div>
                  </div>
                </div>
                <div className={s.revenueSourceSparkArea}>
                  {spark ? (
                    <span
                      className={spark.kind === 'dot' ? s.revenueMetricDot : s.revenueMetricBar}
                      style={spark.kind === 'bar' ? { width: `${spark.width}px` } : undefined}
                    />
                  ) : null}
                </div>
                <div className={s.revenueMetricValue}>{formatTenge(video.estRevenue)}</div>
              </div>
            )
          })}
        </div>
        <div className={`${s.tableFooter} ${s.revenueCardFooter}`}>
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </div>
      </Card>
    </div>
  )
}
