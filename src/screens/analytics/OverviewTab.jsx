import { useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { analyticsHeroChartProps } from '../../components/charts/analyticsChartDefaults.js'
import RealtimeMiniChart from '../../components/charts/RealtimeMiniChart.jsx'
import RealtimeIndicator from '../../components/ui/RealtimeIndicator.jsx'
import { FAST_CHART_ANIMATION_SECONDS } from '../../components/charts/chartAnimation.js'
import { useRealtimeFeed } from '../../hooks/useRealtimeFeed.js'
import {
  formatCompactNumber,
  formatHours,
  formatDateLong,
  formatNumberRu,
} from '../../lib/analyticsFormat.js'
import {
  ThumbDownIcon,
  ThumbUpIcon,
} from '../icons.jsx'
import s from './AnalyticsTabs.module.css'
import AnalyticsHeroCard from './AnalyticsHeroCard.jsx'
import MetricKpiCell from './MetricKpiCell.jsx'
import NewContentCard from './NewContentCard.jsx'
import {
  ANALYTICS_BLUE,
  avgWatchPercent,
  avgWatchPretty,
  buildPublishedVideoMarkers,
  formatTengeChart,
  formatTengeAxis,
  formatTenge,
  KPI_DESCRIPTIONS,
  kpiTrend,
  previousPeriodComparison,
  signedNumber,
  usualComparison,
  videoDate,
} from './studioAnalyticsHelpers.js'

function StudioAiSparkle({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="studioAiSparkleGradient" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7c6ff" />
          <stop offset="0.42" stopColor="#bd73ff" />
          <stop offset="1" stopColor="#5ea8ff" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.8l1.82 5.08L19 9.75l-5.18 1.87L12 16.8l-1.82-5.18L5 9.75l5.18-1.87L12 2.8z"
        fill="url(#studioAiSparkleGradient)"
      />
      <path
        d="M5.7 15.35l.84 2.1 2.1.84-2.1.84-.84 2.1-.84-2.1-2.1-.84 2.1-.84.84-2.1zm12.4-1.7l.68 1.7 1.7.68-1.7.68-.68 1.7-.68-1.7-1.7-.68 1.7-.68.68-1.7z"
        fill="url(#studioAiSparkleGradient)"
        opacity="0.95"
      />
    </svg>
  )
}

export default function OverviewTab({ data, onOpenAdmin, onOpenVideoAnalytics }) {
  const { overview, audience, channel, content, monetization, realtime, range } = data
  const [metric, setMetric] = useState('views')
  const realtimeFeed = useRealtimeFeed({
    initial: realtime.last48,
    baseSubscribers: channel?.subscriberCount || 0,
  })

  if ((content?.allVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных для аналитики"
        description="Добавьте видео в админке — KPI и графики соберутся автоматически из тех же данных."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку</button>}
      />
    )
  }

  const newestPool = (overview.recentVideos?.length ? overview.recentVideos : overview.topVideos).slice(0, 10)
  const newestPoolKey = newestPool.map((video) => video.id || video.title).join('|')
  const newestVideo = newestPool[0] || overview.newest
  const watchSeries = overview.series.map((row) => ({ ...row, watchTimeHours: row.watchTime / 3600 }))
  const uniqueViewers = audience?.kpis?.uniqueViewers?.value || Math.round(overview.kpis.views.value * 0.7)
  const returningShare = Math.max(0, audience?.kpis?.returning?.value || 0)
  const chartByMetric = {
    views: {
      data: overview.series,
      dataKey: 'views',
      name: 'Просмотры',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
      color: ANALYTICS_BLUE,
    },
    watch: {
      data: watchSeries,
      dataKey: 'watchTimeHours',
      name: 'Время просмотра',
      formatY: formatHours,
      formatTooltipValue: formatHours,
      color: ANALYTICS_BLUE,
    },
    subscribers: {
      data: audience.subscribers,
      dataKey: 'subscribers',
      name: 'Подписчики',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
      color: ANALYTICS_BLUE,
    },
    revenue: {
      data: overview.series,
      dataKey: 'revenue',
      name: 'Расчетный доход',
      formatY: formatTengeAxis,
      formatTooltipValue: formatTengeChart,
      color: ANALYTICS_BLUE,
    },
  }
  const chart = chartByMetric[metric]
  const publishedMarkers = buildPublishedVideoMarkers(
    chart.data,
    content?.allVideos || [],
    'date',
    range,
  )
  const heroYAxisWidth = metric === 'revenue' ? 108 : 62
  const topVideo = overview.topVideos[0]
  const aiInsights = [
    (
      <>
        <strong>Показатели канала остаются стабильными, а удержание аудитории — ровным.</strong>{' '}
        За период «{range?.label || 'Последние 28 дней'}» канал {channel?.channelName || 'TRADING INSIDER'} получил {formatNumberRu(overview.kpis.views.value)} просмотров и {formatHours(overview.kpis.watchTime.value)} часов просмотра. Уникальных зрителей было около {formatCompactNumber(uniqueViewers)}, а доля вернувшихся зрителей составила примерно {returningShare}%.
      </>
    ),
    (
      <>
        <strong>Лучший контент по-прежнему приносит больше всего вовлечения.</strong>{' '}
        Видео вроде <span className={s.aiInlineLink}>{topVideo?.title || 'лучшего ролика канала'}</span> опережают остальную библиотеку, удерживая в среднем {avgWatchPercent(topVideo || newestVideo)} просмотра и доводя зрителей до основной ценности ролика.
      </>
    ),
    (
      <>
        <strong>Есть запас для роста в упаковке и продолжении удачных тем.</strong>{' '}
        Используйте темы из верхних строк таблицы ниже в следующих заголовках, обложках и продолжениях, а основную мысль делайте понятной с первых секунд.
      </>
    ),
  ]
  return (
    <div className={`${s.analyticsShell} ${s.overviewShell}`}>
      <div className={`${s.analyticsMain} ${s.overviewMain}`}>
        <AnalyticsHeroCard
          className={`${s.overviewHeroCard} ${s.overviewInset}`}
          chart={(
            <AreaLineChart
              {...analyticsHeroChartProps(s, {
                color: chart.color,
                margin: { top: 12, bottom: 6 },
                yValueScale: metric === 'revenue' ? 512 : 1,
                yAxisWidth: heroYAxisWidth,
              })}
              data={chart.data}
              dataKey={chart.dataKey}
              xKey="date"
              color={chart.color}
              name={chart.name}
              formatY={chart.formatY}
              xTickFormatter={formatDateLong}
              formatTooltipValue={chart.formatTooltipValue}
              eventMarkers={publishedMarkers}
            />
          )}
        >
          <div className={s.ytKpiStrip}>
            <MetricKpiCell
              label="Просмотры"
              value={formatCompactNumber(overview.kpis.views.value)}
              note={usualComparison(overview.kpis.views, formatCompactNumber)}
              description={KPI_DESCRIPTIONS.views}
              trend={kpiTrend(overview.kpis.views.delta)}
              active={metric === 'views'}
              accentColor={chartByMetric.views.color}
              onClick={() => setMetric('views')}
            />
            <MetricKpiCell
              label="Время просмотра (часы)"
              value={formatHours(overview.kpis.watchTime.value)}
              note={usualComparison(overview.kpis.watchTime, formatHours)}
              description={KPI_DESCRIPTIONS.watchTime}
              trend={kpiTrend(overview.kpis.watchTime.delta)}
              active={metric === 'watch'}
              accentColor={chartByMetric.watch.color}
              onClick={() => setMetric('watch')}
            />
            <MetricKpiCell
              label="Подписчики"
              value={signedNumber(overview.kpis.subscribers.value)}
              note={previousPeriodComparison(overview.kpis.subscribers, range)}
              description={KPI_DESCRIPTIONS.subscribers}
              trend={kpiTrend(overview.kpis.subscribers.delta)}
              active={metric === 'subscribers'}
              accentColor={chartByMetric.subscribers.color}
              onClick={() => setMetric('subscribers')}
            />
            <MetricKpiCell
              label="Расчетный доход"
              value={formatTenge(monetization?.kpis?.revenue?.value || 0)}
              description={KPI_DESCRIPTIONS.revenue}
              active={metric === 'revenue'}
              clock
              accentColor={chartByMetric.revenue.color}
              onClick={() => setMetric('revenue')}
            />
          </div>
        </AnalyticsHeroCard>

        <Card padding="lg" depth="md" className={`${s.aiCard} ${s.overviewAICard} ${s.overviewInset}`}>
          <div className={s.aiIcon}><StudioAiSparkle size={22} /></div>
          <div className={s.aiBody}>
            <div className={s.aiTitle}>Основные показатели канала</div>
            <div className={s.aiWarn}>ИИ может ошибаться. Перепроверяйте ответы.</div>
            <div className={s.aiParagraphs}>
              {aiInsights.map((insight, index) => (
                <p key={index}>
                  <span className={s.aiBullet}>•</span>
                  {insight}
                </p>
              ))}
            </div>
            <div className={s.aiActions}>
              <button type="button" className={s.ytPillBtn}>Спросить у Студии</button>
              <div className={s.aiFeedback}>
                <button type="button" className={s.aiFeedbackButton} aria-label="Нравится">
                  <ThumbUpIcon size={22} />
                </button>
                <button type="button" className={s.aiFeedbackButton} aria-label="Не нравится">
                  <ThumbDownIcon size={22} />
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div className={`${s.overviewSectionBreak} ${s.overviewInset}`} aria-hidden="true" />
        <h2 className={`${s.sectionTitle} ${s.overviewInset}`}>Самый популярный контент за период</h2>
        <Card padding="none" depth="md" className={`${s.tableCard} ${s.overviewTable} ${s.overviewInset}`}>
          <table className={s.ytTable}>
            <thead>
              <tr>
                <th>Контент</th>
                <th>Средняя продолжительность просмотра</th>
                <th className={s.right}>Просмотры</th>
              </tr>
            </thead>
            <tbody>
              {overview.topVideos.slice(0, 10).map((video, index) => (
                <tr key={video.id}>
                  <td>
                    <div className={s.videoCell}>
                      <span className={s.rank}>{index + 1}</span>
                      <div className={s.videoThumb}>
                        {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                      </div>
                      <div className={s.videoMeta}>
                        <div className={s.videoTitle} title={video.title}>{video.title}</div>
                        <div className={s.videoSub}>{videoDate(video)}</div>
                      </div>
                    </div>
                  </td>
                  <td>{avgWatchPretty(video)} <span className={s.muted}>({avgWatchPercent(video)})</span></td>
                  <td className={s.right}>{formatNumberRu(video.periodViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className={`${s.tableFooter} ${s.overviewTableFooter}`}>
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </div>
      </div>

      <aside className={`${s.analyticsSide} ${s.overviewSide}`}>
        <Card padding="lg" depth="md" className={`${s.sideCard} ${s.overviewSideCard}`}>
          <div className={s.sideTitle}>Текущая статистика</div>
          <RealtimeIndicator />
          <div className={s.sideBig}>{formatNumberRu(channel?.subscriberCount || 0)}</div>
          <div className={s.sideLabel}>Подписчики</div>
          <button type="button" className={s.ytPillBtn}>Подробнее</button>

          <div className={s.sideDivider} />
          <div className={s.sideBig}>{formatNumberRu(realtimeFeed.bars.reduce((sum, value) => sum + value, 0))}</div>
          <div className={s.sideLabel}>Просмотры · Последние 48 часов</div>
          <RealtimeMiniChart
            bars={realtimeFeed.bars}
            color={ANALYTICS_BLUE}
            height={48}
            animationDuration={FAST_CHART_ANIMATION_SECONDS}
          />
          <div className={s.nowLabel}>Сейчас</div>

          <div className={s.sideDivider} />
          <div className={s.sideTableHead}>
            <span>Самый популярный контент</span>
            <span>Просмотры</span>
          </div>
          {(realtime.topVideos || []).slice(0, 3).map((video) => (
            <div className={s.sideVideoRow} key={video.id}>
              <div className={s.sideThumb}>
                {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
              </div>
              <div className={s.sideVideoTitle}>{video.title}</div>
              <div className={s.sideVideoValue}>{formatCompactNumber(video.realtimeViews)}</div>
            </div>
          ))}
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </Card>

        {newestPool.length > 0 ? (
          <NewContentCard
            key={newestPoolKey}
            videos={newestPool}
            onOpenVideoAnalytics={onOpenVideoAnalytics}
          />
        ) : null}
      </aside>
    </div>
  )
}
