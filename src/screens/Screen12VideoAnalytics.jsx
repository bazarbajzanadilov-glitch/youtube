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
import { buildPerformanceSectionView } from '../lib/videoPerformanceSection.js'
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

export default function Screen12VideoAnalytics() {
  const { go, showToast, route } = useContext(NavContext)
  const { channel } = useChannel()
  const variant = variantFromRoute(route)
  const [activeTab, setActiveTab] = useState(0)
  const section = channel?.performanceSections?.[variant]
  const view = useMemo(
    () => buildPerformanceSectionView({ ...(section || {}), variant }),
    [section, variant],
  )
  const { kpis, chartData, xAxis, yTicks, yDomain, days, realtime } = view
  const isShorts = variant === 'shorts'
  const headline = `С момента публикации это видео${isShorts ? ' Shorts' : ''} посмотрели ${formatNumberRu(kpis.views)} ${declineTimes(kpis.views)}`
  const lastTick = xAxis.lastTick

  const xTickFormatter = (value) => {
    const day = Number(value) || 0
    return day === lastTick ? declineDaysLabel(day) : String(day)
  }
  const tooltipLabel = (label) => {
    const day = Number(label) || 0
    const row = chartData[day]
    return row?.date ? formatChartDateLabel(row.date) : `День ${day}`
  }
  const tooltipRows = (payload) => [
    { label: VIDEO_SERIES_LABEL, value: formatNumberRu(payload?.views ?? 0), emphasis: true },
    { label: CHANNEL_SERIES_LABEL, value: formatNumberRu(payload?.typical ?? 0) },
  ]

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

  const renderOverview = () => (
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
            data={chartData}
            dataKey="views"
            comparisonDataKey="typical"
            comparisonColor={COMPARISON_COLOR}
            comparisonName={CHANNEL_SERIES_LABEL}
            xKey="day"
            color={ANALYTICS_BLUE}
            name={VIDEO_SERIES_LABEL}
            yTicks={yTicks}
            yDomain={yDomain}
            formatY={formatAxisCompact}
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
            note={absoluteUsualComparison(kpis.views - kpis.typicalViews, formatCompactOneDecimal)}
            description={KPI_DESCRIPTIONS.views}
            trend="up"
          />
          {!isShorts ? (
            <MetricKpiCell
              label="Время просмотра (часы)"
              value={formatWatchHours(kpis.watchHours)}
              note={absoluteUsualComparison(kpis.watchHours - kpis.typicalWatchHours, formatWatchHours)}
              description={KPI_DESCRIPTIONS.watchTime}
              trend="up"
            />
          ) : null}
          <MetricKpiCell
            label="Подписчики"
            value={formatSignedCompactNumber(kpis.subscribers)}
            description={KPI_DESCRIPTIONS.subscribers}
          />
          <MetricKpiCell
            label="Расчетный доход"
            value={formatTengeAmount(kpis.revenueTenge)}
            description={KPI_DESCRIPTIONS.revenue}
            clock
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
