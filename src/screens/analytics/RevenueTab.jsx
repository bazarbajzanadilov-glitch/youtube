import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { formatDateLong, formatNumberRu } from '../../lib/analyticsFormat.js'
import clockIcon from '../../assets/clock.svg'
import { formatChartDateLabel } from '../../lib/chartDateFormat.js'
import s from './AnalyticsTabs.module.css'
import {
  ANALYTICS_TEAL,
  formatTenge,
  formatTengeAxis,
} from './studioAnalyticsHelpers.js'

const REVENUE_LINE_COLOR = ANALYTICS_TEAL

const REVENUE_FILTERS = [
  'Все',
  'Реклама на странице просмотра',
  'Реклама в ленте Shorts',
  'Спонсорство',
  'Суперфункции и подарки',
  'Партнерская программа',
]

const SOURCE_TABS = [
  { key: 'all', label: 'Все' },
  { key: 'video', label: 'Видео' },
  { key: 'short', label: 'Shorts' },
  { key: 'live', label: 'Трансляции' },
]

const PERFORMANCE_TABS = SOURCE_TABS.slice(1)

const MINI_BAR_WIDTH = 150
const PROCESSING_STATUS_TEXT = 'Выполняется обработка данных...'
const MONTH_SHORT = ['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.']

function parseISODateLocal(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!match) return new Date(iso)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function isoDateLocal(date) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysLocal(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function formatProcessingRange(start, end) {
  const startMonth = MONTH_SHORT[start.getMonth()]
  const endMonth = MONTH_SHORT[end.getMonth()]
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return `${start.getDate()}–${end.getDate()} ${endMonth} ${endYear}г.`
  }

  if (startYear === endYear) {
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${endYear}г.`
  }

  return `${start.getDate()} ${startMonth} ${startYear}г. – ${end.getDate()} ${endMonth} ${endYear}г.`
}

function buildRevenueProcessingWindow({ videos = [], range, series = [] }) {
  const lastSeriesDate = series.length > 0 ? parseISODateLocal(series[series.length - 1].date) : null
  const rangeEnd = range?.to instanceof Date ? range.to : null
  const end = rangeEnd || lastSeriesDate
  if (!end || Number.isNaN(end.getTime())) return null

  const start = addDaysLocal(end, -1)
  const markerStart = addDaysLocal(end, -2)
  const startDate = isoDateLocal(start)
  const endDate = isoDateLocal(end)
  const markerDates = [markerStart, start, end].map(isoDateLocal)
  const counts = new Map(markerDates.map((date) => [date, 0]))

  videos.forEach((video) => {
    const date = String(video?.date || '').slice(0, 10)
    if (counts.has(date)) counts.set(date, counts.get(date) + 1)
  })

  const markers = markerDates
    .map((date) => ({ date, count: counts.get(date) || 0 }))
    .filter((marker) => marker.count > 0)

  const hasProcessingVideos = markers.some((marker) => marker.date === startDate || marker.date === endDate)
  if (!hasProcessingVideos) return null

  return {
    startDate,
    endDate,
    label: formatProcessingRange(start, end),
    statusText: PROCESSING_STATUS_TEXT,
    markers,
  }
}

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

function sumSeriesRevenue(series = []) {
  return series.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
}

function sumSeriesViews(series = []) {
  return series.reduce((sum, row) => sum + (Number(row.views) || 0), 0)
}

function buildPerformanceMetrics(seriesByType = {}, activeTab) {
  const series = seriesByType[activeTab] || []
  const views = Math.round(sumSeriesViews(series))
  const revenue = +sumSeriesRevenue(series).toFixed(2)
  const hasData = views > 0 || revenue > 0
  return {
    hasData,
    revenue,
    views,
    rpm: hasData && views > 0 ? +((revenue / views) * 1000).toFixed(2) : 0,
  }
}

function sortSourceRows(rows) {
  return rows.sort((a, b) => b.amount - a.amount)
}

function buildRevenueSourceRows(seriesByType = {}, activeTab) {
  const videoRevenue = sumSeriesRevenue(seriesByType.video)
  const shortRevenue = sumSeriesRevenue(seriesByType.short)
  const liveRevenue = sumSeriesRevenue(seriesByType.live)
  const rows = []

  if (activeTab === 'all' || activeTab === 'short') {
    if (shortRevenue > 0) {
      rows.push({
        key: 'short-feed-ads',
        label: 'Реклама в ленте Shorts',
        amount: +shortRevenue.toFixed(2),
      })
    }
  }

  if (activeTab === 'all') {
    const watchPageRevenue = videoRevenue + liveRevenue
    if (watchPageRevenue > 0) {
      rows.push({
        key: 'watch-page-ads',
        label: 'Реклама на странице просмотра',
        amount: +watchPageRevenue.toFixed(2),
      })
    }
    return sortSourceRows(rows)
  }

  if (activeTab === 'video' && videoRevenue > 0) {
    rows.push({
      key: 'video-watch-page-ads',
      label: 'Реклама на странице просмотра',
      amount: +videoRevenue.toFixed(2),
    })
  }

  if (activeTab === 'live' && liveRevenue > 0) {
    rows.push({
      key: 'live-watch-page-ads',
      label: 'Реклама на странице просмотра',
      amount: +liveRevenue.toFixed(2),
    })
  }

  return sortSourceRows(rows)
}

export default function RevenueTab({ data }) {
  const { content, monetization, range } = data
  const [activeFilter, setActiveFilter] = useState(0)
  const [activePerformanceTab, setActivePerformanceTab] = useState('video')
  const [activeSourceTab, setActiveSourceTab] = useState('all')
  const revenue = monetization?.kpis?.revenue?.value || 0
  const monthlyRows = useMemo(() => buildMonthlyRows(monetization?.series || []), [monetization?.series])
  const monthlyMax = Math.max(0, ...monthlyRows.map((row) => row.value))
  const performanceMetrics = useMemo(() => (
    buildPerformanceMetrics(content?.seriesByType, activePerformanceTab)
  ), [activePerformanceTab, content?.seriesByType])
  const sourceRows = useMemo(() => (
    buildRevenueSourceRows(content?.seriesByType, activeSourceTab)
  ), [activeSourceTab, content?.seriesByType])
  const processingWindow = useMemo(() => (
    buildRevenueProcessingWindow({
      videos: content?.allVideos || [],
      range,
      series: monetization?.series || [],
    })
  ), [content?.allVideos, range, monetization?.series])
  const sourcesMax = Math.max(0, ...sourceRows.map((item) => item.amount || 0))

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
            fillColor={REVENUE_LINE_COLOR}
            height={168}
            name="Расчетный доход"
            formatY={formatTengeAxis}
            xTickFormatter={formatDateLong}
            formatTooltipValue={formatTenge}
            formatTooltipLabel={formatRevenueTooltipLabel}
            yAxisOrientation="right"
            yValueScale={512}
            yAxisWidth={88}
            margin={{ top: 22, right: 44, left: 22, bottom: 6 }}
            xTickFontSize={12}
            yTickFontSize={12}
            tooltipClassName={s.revenueHeroTooltip}
            tooltipLabelClassName={s.revenueHeroTooltipLabel}
            tooltipValueClassName={s.revenueHeroTooltipValue}
            tooltipCursor={{ stroke: '#6c6c6c', strokeOpacity: 0.8, strokeWidth: 1 }}
            fillTopOpacity={0.16}
            fillBottomOpacity={0.03}
            activeDotProps={{ r: 5, stroke: '#282828', strokeWidth: 2, fill: REVENUE_LINE_COLOR }}
            processingWindow={processingWindow}
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

        <Card padding="none" depth="md" className={`${s.tableCard} ${s.revenuePerformanceCard}`}>
          <div className={s.tableHeader}>
            <div>
              <div className={`${s.cardTitle} ${s.cardTitleInline}`}>
                <span>Эффективность контента</span>
                <img className={s.clockBadgeSmall} src={clockIcon} alt="" aria-hidden="true" />
              </div>
              <div className={s.cardSub}>{range.label}</div>
            </div>
          </div>
          <div className={s.innerTabs}>
            {PERFORMANCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${s.innerTab} ${activePerformanceTab === tab.key ? s.innerTabActive : ''}`}
                onClick={() => setActivePerformanceTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={s.revenuePerformanceStats}>
            <div className={s.revenuePerformancePrimary}>
              <strong>{performanceMetrics.hasData ? formatTenge(performanceMetrics.revenue) : '–'}</strong>
              <span>Расчетный доход</span>
            </div>
            <div className={s.revenuePerformanceMetricRows}>
              <div className={s.revenuePerformanceMetricLine}>
                <span>Количество просмотров</span>
                <strong>{performanceMetrics.hasData ? formatNumberRu(performanceMetrics.views) : '–'}</strong>
              </div>
              <div className={s.revenuePerformanceMetricLine}>
                <span>Доход на тысячу просмотров</span>
                <strong>{performanceMetrics.hasData ? formatTenge(performanceMetrics.rpm) : '–'}</strong>
              </div>
            </div>
          </div>
          <div className={`${s.tableFooter} ${s.revenueCardFooter}`}>
            <button type="button" className={s.ytPillBtn}>Подробнее</button>
          </div>
        </Card>
      </div>

      <div className={s.twoColumnGrid}>
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
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${s.innerTab} ${activeSourceTab === tab.key ? s.innerTabActive : ''}`}
                onClick={() => setActiveSourceTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={s.revenueSourceList}>
            {sourceRows.length > 0 ? sourceRows.map((source) => {
              const spark = metricSpark(source.amount, sourcesMax)
              return (
                <div className={s.revenueSourceRow} key={source.key}>
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
            }) : <div className={s.revenueSourceEmpty}>–</div>}
          </div>
          <div className={`${s.tableFooter} ${s.revenueCardFooter}`}>
            <button type="button" className={s.ytPillBtn}>Подробнее</button>
          </div>
        </Card>
      </div>
    </div>
  )
}
