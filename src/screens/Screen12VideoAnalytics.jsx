import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import pageStyles from './Screen3Analytics.module.css'
import tabStyles from './analytics/AnalyticsTabs.module.css'
import pickerStyles from '../components/ui/DateRangePicker.module.css'
import s from './Screen12VideoAnalytics.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { ChevronDown, ChevronLeft } from './icons.jsx'
import TabRow from '../components/ui/TabRow.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Card from '../components/ui/Card.jsx'
import RealtimeIndicator from '../components/ui/RealtimeIndicator.jsx'
import RealtimeMiniChart from '../components/charts/RealtimeMiniChart.jsx'
import { FAST_CHART_ANIMATION_SECONDS } from '../components/charts/chartAnimation.js'
import AnalyticsHeroCard from './analytics/AnalyticsHeroCard.jsx'
import MetricKpiCell from './analytics/MetricKpiCell.jsx'
import AreaLineChart from '../components/charts/AreaLineChart.jsx'
import { analyticsHeroChartProps } from '../components/charts/analyticsChartDefaults.js'
import { useChannel } from '../storage/useChannel.js'
import { useVideos } from '../storage/useVideos.js'
import {
  declineDaysLabel,
  declineTimes,
  formatDateLong,
  formatAxisCompact,
  formatCompactOneDecimal,
  formatNumberRu,
  formatSignedCompactNumber,
} from '../lib/analyticsFormat.js'
import {
  buildPerformanceSectionView,
  buildSincePublicationXAxis,
  buildSincePublicationYTicks,
  buildVideoPerformanceView,
  videoIdFromAnalyticsRoute,
} from '../lib/videoPerformanceSection.js'
import {
  ANALYTICS_BLUE,
  KPI_DESCRIPTIONS,
  absoluteUsualComparison,
  formatTengeAmount,
} from './analytics/studioAnalyticsHelpers.js'

const TABS = ['Обзор', 'Охват', 'Взаимодействие', 'Аудитория', 'Доход']
const COMPARISON_COLOR = '#909090'
const VIDEO_SERIES_LABEL = 'Показатели этого видео'
const CHANNEL_SERIES_LABEL = 'Обычные показатели на канале'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_PREPOSITIONAL = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']

const pad2 = (value) => String(value).padStart(2, '0')

/**
 * Меню периода как на странице видео в YouTube Studio: первые N дней после
 * публикации, годы и последние месяцы жизни ролика, другой диапазон дат.
 */
function buildPeriodGroups(publishedAt, lastDate) {
  const first = [
    { key: 'first-1', kind: 'first', days: 1, label: 'Первые 24 часа', headline: 'За первые 24 часа' },
    { key: 'first-7', kind: 'first', days: 7, label: 'Первые 7 дней', headline: 'За первые 7 дней' },
    { key: 'first-28', kind: 'first', days: 28, label: 'Первые 28 дней', headline: 'За первые 28 дней' },
    { key: 'first-90', kind: 'first', days: 90, label: 'Первые 90 дней', headline: 'За первые 90 дней' },
    { key: 'first-365', kind: 'first', days: 365, label: 'Первые 365 дней', headline: 'За первые 365 дней' },
    { key: 'all', kind: 'all', label: 'С момента публикации', headline: 'С момента публикации' },
  ]
  const [year, month] = String(lastDate).split('-').map(Number)
  const years = []
  for (let y = year; y > year - 2; y -= 1) {
    years.push({ key: `year-${y}`, kind: 'range', from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), headline: `В ${y} году` })
  }
  const months = []
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(year, month - 1 - offset, 1)
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    months.push({
      key: `month-${y}-${m}`,
      kind: 'range',
      from: `${y}-${pad2(m)}-01`,
      to: `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`,
      label: y === year ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`,
      headline: `В ${MONTHS_PREPOSITIONAL[m - 1]}${y === year ? '' : ` ${y} г.`}`,
    })
  }
  return [first, years, months].filter((group) => group.length > 0)
}

const TOOLTIP_DATE = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })

/** Время публикации ролика (Алматы) — из момента добавления, иначе стабильное по id. */
function publicationTime(video, publishedAt) {
  const created = Number(video?.createdAt)
  if (Number.isFinite(created) && created > 0) {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(created))
    const hour = parts.find((part) => part.type === 'hour')?.value
    const minute = parts.find((part) => part.type === 'minute')?.value
    if (hour && minute) return `${Number(hour)}:${minute}`
  }
  const seed = [...String(video?.id || publishedAt || '')].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100000, 7)
  return `${6 + (seed % 16)}:${pad2(seed % 60)}`
}

function formatTooltipDate(iso, time) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const text = TOOLTIP_DATE.format(new Date(y, m - 1, d)).replace(/\.(?=,)/, '')
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}, ${time}`
}

function zeroRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'day' || key === 'date' ? value : 0]))
}

function variantFromRoute(route) {
  return String(route || '').endsWith('/shorts') ? 'shorts' : 'video'
}

function formatWatchHours(value) {
  return formatCompactOneDecimal(value)
}

function compareTrend(value, typical) {
  if (typical == null) return 'neutral'
  if (value > typical) return 'up'
  if (value < typical) return 'down'
  return 'usual'
}

// Число в подсказке графика — с запятыми между разрядами, как в YouTube Studio: 26,315,130.
function formatTooltipNumber(value, maxDigits = 0, minDigits = 0) {
  return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits })
}

const METRIC_CHARTS = {
  views: { formatAxis: formatAxisCompact, formatTooltip: formatTooltipNumber },
  watch: {
    formatAxis: formatAxisCompact,
    formatTooltip: (value) => formatTooltipNumber(value, 1),
  },
  subscribers: { formatAxis: formatAxisCompact, formatTooltip: formatTooltipNumber },
  revenue: { formatAxis: (value) => `${formatAxisCompact(value)}\u00a0₸`, formatTooltip: (value) => `${formatTooltipNumber(value, 2, 2)}\u00a0₸` },
}

export default function Screen12VideoAnalytics() {
  const { go, showToast, route } = useContext(NavContext)
  const { channel } = useChannel()
  const { videos } = useVideos()
  const videoId = videoIdFromAnalyticsRoute(route)
  const video = videoId ? videos.find((item) => String(item.id) === videoId) : null
  const variant = video ? (video.type === 'short' ? 'shorts' : 'video') : variantFromRoute(route)
  const [activeTab, setActiveTab] = useState(0)
  const [requestedMetric, setRequestedMetric] = useState('views')
  const [periodKey, setPeriodKey] = useState('all')
  const [customRange, setCustomRange] = useState(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' })
  const periodRef = useRef(null)
  useEffect(() => {
    if (!periodOpen) return undefined
    const close = () => {
      setPeriodOpen(false)
      setShowCustom(false)
    }
    const onDocClick = (event) => { if (!periodRef.current?.contains(event.target)) close() }
    const onEsc = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [periodOpen])
  const section = channel?.performanceSections?.[variant]
  const view = useMemo(
    () => (video
      ? buildVideoPerformanceView(video, videos, channel)
      : buildPerformanceSectionView({ ...(section || {}), variant })),
    [video, videos, channel, section, variant],
  )
  const { chartData, days: totalDays, realtime } = view
  const publishedAt = view.section.publishedAt
  const publishTime = publicationTime(video, publishedAt)
  const lastDate = chartData[totalDays]?.date || publishedAt
  const periodGroups = buildPeriodGroups(publishedAt, lastDate)
  const periodOptions = periodGroups.flat()
  const period = periodKey === 'custom' && customRange
    ? { key: 'custom', kind: 'range', ...customRange, label: 'Другой диапазон дат', headline: 'За выбранный период' }
    : periodOptions.find((item) => item.key === periodKey) || periodOptions.find((item) => item.kind === 'all')

  // Окно в индексах дней: значения окна = накопленное на end минус накопленное на base.
  let base = 0
  let end = totalDays
  if (period.kind === 'first') end = Math.min(period.days, totalDays)
  if (period.kind === 'range') {
    const inside = chartData.filter((row) => row.day >= 1 && row.day <= totalDays && row.date >= period.from && row.date <= period.to)
    base = inside.length ? inside[0].day - 1 : 0
    end = inside.length ? inside[inside.length - 1].day : 0
  }
  const days = end - base
  const valueAt = (index, key) => (index === 0 && video ? 0 : Number(chartData[index]?.[key]) || 0)
  const windowValue = (key) => valueAt(end, key) - (base > 0 ? valueAt(base, key) : 0)
  const endRow = chartData[end] || {}
  const kpis = period.kind === 'all'
    ? view.kpis
    : {
      views: windowValue('views'),
      typicalViews: period.kind === 'first' ? (endRow.viewsTypical ?? null) : null,
      watchHours: windowValue('watch'),
      typicalWatchHours: period.kind === 'first' ? (endRow.watchTypical ?? null) : null,
      subscribers: windowValue('subscribers'),
      revenueTenge: windowValue('revenue'),
    }
  const byDate = period.kind === 'range'
  const xAxis = period.kind === 'all' ? view.xAxis : buildSincePublicationXAxis(Math.max(1, days))
  const isShorts = variant === 'shorts'
  // У каждого реального ролика (и Shorts тоже) есть время просмотра — 4 карточки.
  // Раздел Shorts из админки — 3 карточки, как на скриншоте клиента.
  const showWatch = Boolean(video) || !isShorts
  const headline = `${period.headline} это видео${isShorts ? ' Shorts' : ''} посмотрели ${formatNumberRu(kpis.views)} ${declineTimes(kpis.views)}`
  // У конкретного видео ось заканчивается на последнем полном дне — линия
  // доходит до правого края. Разделы из админки держат ось 6 × шаг.
  const lastTick = video || byDate ? Math.max(1, days) : xAxis.lastTick
  const periodSub = period.kind === 'all'
    ? `С ${formatDateLong(publishedAt)} по сегодняшний день`
    : period.kind === 'range' && days === 0
      ? `${formatDateLong(period.from)} – ${formatDateLong(period.to)}`
      : period.kind === 'range'
      ? `${formatDateLong(period.from > publishedAt ? period.from : publishedAt)} – ${formatDateLong(period.to < lastDate ? period.to : lastDate)}`
      : `${formatDateLong(publishedAt)} – ${formatDateLong(endRow.date || lastDate)}`
  // Ось X — дни с публикации (0 … N дней), как в YouTube Studio; линия
  // начинается с нуля и идёт до последнего полного дня окна.
  const plotData = Array.from({ length: lastTick + 1 }, (_, day) => {
    const index = base + day
    const row = { ...(chartData[index] || {}), day }
    if (day > days) {
      return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'day' || key === 'date' ? value : null]))
    }
    if (day === 0 && (video || base > 0)) return zeroRow(row)
    if (base === 0) return row
    const shifted = { ...row }
    for (const key of ['views', 'watch', 'subscribers', 'revenue']) {
      shifted[key] = valueAt(index, key) - valueAt(base, key)
      shifted[`${key}Typical`] = null
    }
    return shifted
  })

  // Ровный шаг подписей оси: 0, 2, 4 … или 0, 5, 10 … (не больше 7 отметок).
  const xTickStep = [1, 2, 3, 5, 7, 10, 14, 15, 20, 25, 30, 50, 60, 100, 150, 200, 250, 300, 500]
    .find((step) => Math.floor(lastTick / step) <= 6) || Math.ceil(lastTick / 6)
  // Разделы из админки держат ось YouTube: 7 отметок с шагом ceil(дней / 6).
  const xTicks = video || byDate
    ? Array.from({ length: Math.floor(lastTick / xTickStep) + 1 }, (_, index) => index * xTickStep)
    : xAxis.ticks
  const lastLabeledTick = xTicks[xTicks.length - 1]
  const xTickFormatter = (value) => {
    // Всегда дни с момента публикации, как в YouTube Studio.
    const day = (Number(value) || 0) + base
    return day === lastLabeledTick + base ? declineDaysLabel(day) : String(day)
  }
  // Подсказка как в YouTube Studio: «Чт, 5 февр., 6:18» / «(Первые 64 дня)» / число.
  const tooltipLabel = (label) => {
    const day = (Number(label) || 0) + base
    const row = chartData[day]
    return (
      <>
        <span className={s.tipDate}>{row?.date ? formatTooltipDate(row.date, publishTime) : `День ${day}`}</span>
        <span className={s.tipPeriod}>{day >= 1 ? `(Первые ${declineDaysLabel(day)})` : '(День публикации)'}</span>
      </>
    )
  }
  const metric = !showWatch && requestedMetric === 'watch' ? 'views' : requestedMetric
  const metricChart = METRIC_CHARTS[metric]
  const metricTicks = period.kind === 'all'
    ? view.yTicksByMetric[metric]
    : buildSincePublicationYTicks(Math.max(0, ...plotData.map((row) => Number(row[metric]) || 0)))
  const pickPeriod = (item) => {
    setPeriodKey(item.key)
    setPeriodOpen(false)
    setShowCustom(false)
  }
  const applyCustom = () => {
    if (!customDraft.from || !customDraft.to) return
    const to = customDraft.to > lastDate ? lastDate : customDraft.to
    const from = customDraft.from > to ? to : customDraft.from
    setCustomRange({ from, to })
    setPeriodKey('custom')
    setPeriodOpen(false)
    setShowCustom(false)
  }

  const renderRealtimeCard = () => (
    <Card padding="lg" depth="md" className={`${tabStyles.sideCard} ${tabStyles.overviewSideCard}`} data-testid="since-publication-realtime">
      <div className={tabStyles.sideTitle}>Текущая статистика</div>
      <RealtimeIndicator />
      <div className={tabStyles.sideBig}>{formatNumberRu(realtime.total)}</div>
      <div className={s.realtimeLabel}>
        Просмотры · Последние 48 часов <ChevronDown size={18} />
      </div>
      <RealtimeMiniChart
        bars={realtime.bars}
        color={ANALYTICS_BLUE}
        height={48}
        animationDuration={FAST_CHART_ANIMATION_SECONDS}
      />
      {realtime.sources.length > 0 ? (
        <>
          <div className={s.sourcesHead}>
            <span>Основные источники трафика</span>
            <span>Просмотры</span>
          </div>
          {realtime.sources.map((source) => (
            <div className={s.sourceRow} key={source.label}>
              <span className={s.sourceLabel} title={source.label}>{source.label}</span>
              <span className={s.sourceValue}>{source.percent.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}%</span>
              <span className={s.sourceSpark} aria-hidden="true">
                {source.spark.map((value, index) => (
                  <i key={index} style={{ height: `${Math.max(8, value * 100)}%` }} />
                ))}
              </span>
            </div>
          ))}
        </>
      ) : null}
      <button type="button" className={`${tabStyles.ytPillBtn} ${s.moreBtn}`} onClick={() => showToast('Подробнее')}>Подробнее</button>
    </Card>
  )

  const renderPending = () => (
    <div className={s.emptyWrap}>
      <EmptyState
        title="Статистика обрабатывается"
        description="Данные за первые сутки после публикации появятся завтра."
      />
    </div>
  )

  const renderOverview = () => view.pending ? renderPending() : (
    <div className={s.overviewLayout}>
    <div className={s.overviewStack}>
      <h2 className={s.sinceTitle} data-testid="since-publication-title">{headline}</h2>
      <AnalyticsHeroCard
        className={`${tabStyles.overviewHeroCard} ${tabStyles.overviewInset}`}
        actionProps={{ onClick: () => showToast('Подробнее') }}
        chart={(
          <AreaLineChart
            {...analyticsHeroChartProps(tabStyles, {
              color: ANALYTICS_BLUE,
              margin: { top: 12, bottom: 6 },
              height: 214,
            })}
            data={plotData}
            dataKey={metric}
            xKey="day"
            color={ANALYTICS_BLUE}
            name={VIDEO_SERIES_LABEL}
            showAreaFill={false}
            curve="linear"
            yTicks={metricTicks}
            yDomain={[0, metricTicks[metricTicks.length - 1]]}
            formatY={metricChart.formatAxis}
            xTickFormatter={xTickFormatter}
            xTicks={xTicks}
            formatTooltipLabel={tooltipLabel}
            formatTooltipValue={metricChart.formatTooltip}
            tooltipClassName={s.tip}
            tooltipLabelClassName={s.tipHead}
            tooltipValueClassName={s.tipValue}
          />
        )}
      >
        <div className={`${tabStyles.ytKpiStrip} ${showWatch ? '' : tabStyles.ytKpiStripThree}`}>
          <MetricKpiCell
            label="Просмотры"
            value={formatCompactOneDecimal(kpis.views)}
            note={kpis.typicalViews == null ? '' : absoluteUsualComparison(kpis.views - kpis.typicalViews, formatCompactOneDecimal)}
            description={KPI_DESCRIPTIONS.views}
            trend={compareTrend(kpis.views, kpis.typicalViews)}
            active={metric === 'views'}
            accentColor={ANALYTICS_BLUE}
            onClick={() => setRequestedMetric('views')}
          />
          {showWatch ? (
            <MetricKpiCell
              label="Время просмотра (часы)"
              value={formatWatchHours(kpis.watchHours)}
              note={kpis.typicalWatchHours == null ? '' : absoluteUsualComparison(kpis.watchHours - kpis.typicalWatchHours, formatWatchHours)}
              description={KPI_DESCRIPTIONS.watchTime}
              trend={compareTrend(kpis.watchHours, kpis.typicalWatchHours)}
              active={metric === 'watch'}
              accentColor={ANALYTICS_BLUE}
              onClick={() => setRequestedMetric('watch')}
            />
          ) : null}
          <MetricKpiCell
            label="Подписчики"
            value={formatSignedCompactNumber(kpis.subscribers)}
            description={KPI_DESCRIPTIONS.subscribers}
            active={metric === 'subscribers'}
            accentColor={ANALYTICS_BLUE}
            onClick={() => setRequestedMetric('subscribers')}
          />
          <MetricKpiCell
            label="Расчетный доход"
            value={formatTengeAmount(kpis.revenueTenge)}
            description={KPI_DESCRIPTIONS.revenue}
            clock
            active={metric === 'revenue'}
            accentColor={ANALYTICS_BLUE}
            onClick={() => setRequestedMetric('revenue')}
          />
        </div>
        <div className={s.chartLegend} data-testid="since-publication-legend">
          <span className={s.legendItem}>
            <i className={s.legendDot} style={{ '--legend-color': ANALYTICS_BLUE }} aria-hidden="true" />
            {VIDEO_SERIES_LABEL}
          </span>
          <span className={s.legendItem}>
            <i className={s.legendDot} style={{ '--legend-color': COMPARISON_COLOR }} aria-hidden="true" />
            {CHANNEL_SERIES_LABEL}
          </span>
        </div>
      </AnalyticsHeroCard>
      <p className={s.footNote}>Интерес к контенту · {period.label} · {declineDaysLabel(Math.max(0, days))}</p>
    </div>
    <aside className={s.overviewSide}>{renderRealtimeCard()}</aside>
    </div>
  )

  return (
    <div className={pageStyles.page}>
      <TopBar />
      <Sidebar active="analytics" />
      <div className={pageStyles.main}>
        <div className={pageStyles.headerRow}>
          <div className={s.headerLead}>
            <button
              type="button"
              className={s.backBtn}
              onClick={() => go('analytics')}
              aria-label="Назад к аналитике канала"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className={pageStyles.title}>Аналитика видео</h1>
          </div>
          <button
            type="button"
            className={pageStyles.advanced}
            onClick={() => showToast('Расширенный режим')}
          >
            Расширенный режим
          </button>
        </div>

        <div className={pageStyles.controlRow}>
          <TabRow tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="video-analytics-tab" />
          <div className={pageStyles.dateWrap}>
            <div className={pickerStyles.wrap} ref={periodRef}>
              <button
                type="button"
                className={`${pickerStyles.trigger} ${s.periodPill}`}
                aria-label={`Период: ${period.label}`}
                aria-expanded={periodOpen}
                onClick={() => setPeriodOpen((open) => !open)}
              >
                <span className={pickerStyles.sub}>{periodSub}</span>
                <span className={pickerStyles.main}>
                  {period.label} <ChevronDown size={16} />
                </span>
              </button>
              <AnimatePresence>
                {periodOpen ? (
                  <motion.div
                    className={pickerStyles.menu}
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {!showCustom ? (
                      <div className={pickerStyles.list}>
                        {periodGroups.map((group) => (
                          <div className={pickerStyles.group} key={group[0].key}>
                            {group.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                className={`${pickerStyles.item} ${item.key === period.key ? pickerStyles.itemActive : ''}`}
                                onClick={() => pickPeriod(item)}
                              >
                                <span>{item.label}</span>
                              </button>
                            ))}
                            <span className={pickerStyles.separator} aria-hidden="true" />
                          </div>
                        ))}
                        <div className={pickerStyles.group}>
                          <button
                            type="button"
                            className={`${pickerStyles.item} ${period.key === 'custom' ? pickerStyles.itemActive : ''}`}
                            onClick={() => {
                              setCustomDraft(customRange || { from: publishedAt, to: lastDate })
                              setShowCustom(true)
                            }}
                          >
                            <span>Другой диапазон дат</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={pickerStyles.custom}>
                        <div className={pickerStyles.customTitle}>Другой диапазон дат</div>
                        <label className={pickerStyles.customField}>
                          <span>С</span>
                          <input
                            type="date"
                            min={publishedAt}
                            max={lastDate}
                            value={customDraft.from}
                            onChange={(event) => setCustomDraft((draft) => ({ ...draft, from: event.target.value }))}
                          />
                        </label>
                        <label className={pickerStyles.customField}>
                          <span>По</span>
                          <input
                            type="date"
                            min={publishedAt}
                            max={lastDate}
                            value={customDraft.to}
                            onChange={(event) => setCustomDraft((draft) => ({ ...draft, to: event.target.value }))}
                          />
                        </label>
                        <div className={pickerStyles.customActions}>
                          <button type="button" className={pickerStyles.cancelBtn} onClick={() => setShowCustom(false)}>Назад</button>
                          <button type="button" className={pickerStyles.applyBtn} onClick={applyCustom}>Применить</button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div key={activeTab}>
          {activeTab === 0 ? renderOverview() : (
            <div className={s.emptyWrap}>
              <EmptyState
                title="Раздел доступен только на вкладке «Обзор»"
                description="Данные этого видео за период с момента публикации собраны на вкладке «Обзор»."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
