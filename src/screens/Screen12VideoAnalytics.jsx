import { useContext, useMemo, useState } from 'react'
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
import { formatChartDateLabel } from '../lib/chartDateFormat.js'
import {
  buildPerformanceSectionView,
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

const METRIC_CHARTS = {
  views: { formatAxis: formatAxisCompact, formatTooltip: formatNumberRu },
  watch: {
    formatAxis: formatAxisCompact,
    formatTooltip: (value) => (Number(value) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 }),
  },
  subscribers: { formatAxis: formatAxisCompact, formatTooltip: formatNumberRu },
  revenue: { formatAxis: (value) => `${formatAxisCompact(value)}\u00a0₸`, formatTooltip: formatTengeAmount },
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
  const section = channel?.performanceSections?.[variant]
  const view = useMemo(
    () => (video
      ? buildVideoPerformanceView(video, videos, channel)
      : buildPerformanceSectionView({ ...(section || {}), variant })),
    [video, videos, channel, section, variant],
  )
  const { kpis, chartData, xAxis, days, realtime } = view
  const isShorts = variant === 'shorts'
  const headline = `С момента публикации это видео${isShorts ? ' Shorts' : ''} посмотрели ${formatNumberRu(kpis.views)} ${declineTimes(kpis.views)}`
  const lastTick = xAxis.lastTick
  // Ось X — дни с публикации (0 … N дней), как в YouTube Studio; линия
  // начинается с нуля в день публикации и идёт до последнего полного дня.
  const plotData = video
    ? chartData.map((row) => (row.day === 0
      ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' && key !== 'day' ? 0 : value]))
      : row))
    : chartData

  const xTickFormatter = (value) => {
    const day = Number(value) || 0
    return day === lastTick ? declineDaysLabel(day) : String(day)
  }
  const tooltipLabel = (label) => {
    const day = Number(label) || 0
    const row = chartData[day]
    return row?.date ? formatChartDateLabel(row.date) : `День ${day}`
  }
  const metric = isShorts && requestedMetric === 'watch' ? 'views' : requestedMetric
  const metricChart = METRIC_CHARTS[metric]
  const metricTicks = view.yTicksByMetric[metric]
  const tooltipRows = (payload) => {
    const typicalValue = payload?.[`${metric}Typical`]
    return [
      { label: VIDEO_SERIES_LABEL, value: metricChart.formatTooltip(payload?.[metric] ?? 0), emphasis: true },
      ...(typicalValue == null ? [] : [{ label: CHANNEL_SERIES_LABEL, value: metricChart.formatTooltip(typicalValue) }]),
    ]
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
      {video ? null : (
      <div className={s.variantSwitch} role="tablist" aria-label="Тип контента">
        <button
          type="button"
          role="tab"
          aria-selected={!isShorts}
          className={`${s.variantChip} ${!isShorts ? s.variantChipActive : ''}`}
          onClick={() => go('video-analytics/video')}
        >
          Видео
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isShorts}
          className={`${s.variantChip} ${isShorts ? s.variantChipActive : ''}`}
          onClick={() => go('video-analytics/shorts')}
        >
          Shorts
        </button>
      </div>
      )}
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
            formatTooltipLabel={tooltipLabel}
            tooltipRows={tooltipRows}
          />
        )}
      >
        <div className={`${tabStyles.ytKpiStrip} ${isShorts ? tabStyles.ytKpiStripThree : ''}`}>
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
          {!isShorts ? (
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
      <p className={s.footNote}>Интерес к контенту · С момента публикации · {declineDaysLabel(days)}</p>
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
            <div className={`${pickerStyles.trigger} ${s.periodPill}`} aria-label="Период: с момента публикации">
              <span className={pickerStyles.sub}>С {formatDateLong(view.section.publishedAt)} по сегодняшний день</span>
              <span className={pickerStyles.main}>
                С момента публикации <ChevronDown size={16} />
              </span>
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
