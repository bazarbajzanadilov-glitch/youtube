import { useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
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
import clockIcon from '../../assets/clock.svg'
import {
  ChevronLeft,
  ChevronRight,
  InfoIcon,
  KpiDownCircleIcon,
  SparkleIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '../icons.jsx'
import s from './AnalyticsTabs.module.css'
import {
  ANALYTICS_BLUE,
  avgWatchPercent,
  avgWatchPretty,
  belowUsual,
  ctrPretty,
  daysSinceLong,
  formatTenge,
  liveEndedLong,
  signedNumber,
  videoDate,
} from './studioAnalyticsHelpers.js'

function KpiCell({
  label,
  value,
  note,
  active = false,
  clock = false,
  onClick,
  accentColor,
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${s.ytKpiCell} ${active ? s.ytKpiCellActive : ''}`}
      onClick={onClick}
      style={active && accentColor ? { '--yt-kpi-accent': accentColor } : undefined}
    >
      <div className={s.ytKpiLabel}>
        {label}
        {clock ? <img className={s.clockBadge} src={clockIcon} alt="" aria-hidden="true" /> : null}
      </div>
      <div className={s.ytKpiValue}>
        {value}
        {!clock ? <span className={s.downMark}><KpiDownCircleIcon size={18} color="#909090" /></span> : null}
      </div>
      {note ? <div className={s.ytKpiNote}>{note}</div> : null}
    </Tag>
  )
}

function NewContentMetric({ label, value, secondaryLabel, secondaryValue }) {
  return (
    <div className={s.newMetricBlock}>
      <div className={s.newMetricPrimary}>
        <span className={s.newMetricLabel}>{label}</span>
        <strong className={s.newMetricValue}>{value}</strong>
      </div>
      {secondaryLabel && secondaryValue ? (
        <div className={s.newMetricSecondary}>
          <span className={s.newMetricLabel}>{secondaryLabel}</span>
          <strong className={s.newMetricSecondaryValue}>{secondaryValue}</strong>
        </div>
      ) : null}
    </div>
  )
}

export default function OverviewTab({ data, onOpenAdmin }) {
  const { overview, audience, channel, monetization, realtime } = data
  const [metric, setMetric] = useState('views')
  const [newestIdx, setNewestIdx] = useState(0)
  const realtimeFeed = useRealtimeFeed({
    initial: realtime.last48,
    seed: realtime.generatorSeed,
    intervalMs: 5000,
    baseSubscribers: 0,
  })

  if ((overview.topVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных для аналитики"
        description="Добавьте видео в админке — KPI и графики соберутся автоматически из тех же данных."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку</button>}
      />
    )
  }

  const newestPool = (overview.recentVideos?.length ? overview.recentVideos : overview.topVideos).slice(0, 10)
  const newestVideo = newestPool[newestIdx] || overview.newest
  const canGoPrev = newestIdx > 0
  const canGoNext = newestIdx < newestPool.length - 1
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
      formatTooltipValue: (v) => `${formatHours(v)} ч`,
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
      formatY: formatTenge,
      formatTooltipValue: formatTenge,
      color: ANALYTICS_BLUE,
    },
  }
  const chart = chartByMetric[metric]
  const heroChartMargin = metric === 'revenue'
    ? { top: 12, right: 88, left: 8, bottom: 6 }
    : { top: 12, right: 48, left: 8, bottom: 6 }
  const heroYAxisWidth = metric === 'revenue' ? 80 : 44
  const heroFillTopOpacity = 0.1
  const heroFillBottomOpacity = 0
  const topVideo = overview.topVideos[0]
  const replayViews = newestVideo ? Math.max(1, Math.round((newestVideo.views || 0) * (newestVideo.type === 'live' ? 0.01 : 0.08))) : 0
  const aiInsights = [
    (
      <>
        <strong>Показатели канала остаются стабильными, а удержание аудитории — ровным.</strong>{' '}
        За последние 28 дней канал {channel?.channelName || 'PRENTOSOV'} получил {formatNumberRu(overview.kpis.views.value)} просмотров и {formatHours(overview.kpis.watchTime.value)} часов просмотра. Уникальных зрителей было около {formatCompactNumber(uniqueViewers)}, а доля вернувшихся зрителей составила примерно {returningShare}%.
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
  const newestMetrics = newestVideo
    ? newestVideo.type === 'live'
      ? [
        {
          label: 'Просмотры',
          value: formatCompactNumber(newestVideo.views || 0),
          secondaryLabel: 'При повторном воспроизведении',
          secondaryValue: formatCompactNumber(replayViews),
        },
        {
          label: 'Средняя продолжительность просмотра',
          value: avgWatchPretty(newestVideo),
          secondaryLabel: 'При повторном воспроизведении',
          secondaryValue: avgWatchPretty(newestVideo),
        },
        {
          label: 'Макс. число одновременных зрителей',
          value: formatCompactNumber(Math.max(1, Math.round((newestVideo.views || 0) * 0.007))),
        },
      ]
      : [
        {
          label: 'Просмотры',
          value: formatCompactNumber(newestVideo.views || 0),
        },
        {
          label: 'CTR для значков видео',
          value: ctrPretty(newestVideo),
        },
        {
          label: 'Средняя продолжительность просмотра',
          value: avgWatchPretty(newestVideo),
        },
      ]
    : []

  return (
    <div className={`${s.analyticsShell} ${s.overviewShell}`}>
      <div className={`${s.analyticsMain} ${s.overviewMain}`}>
        <Card padding="none" depth="lg" className={`${s.ytHeroCard} ${s.overviewHeroCard} ${s.overviewInset}`}>
          <div className={s.ytKpiStrip}>
            <KpiCell
              label="Просмотры"
              value={formatCompactNumber(overview.kpis.views.value)}
              note={belowUsual(overview.kpis.views.value)}
              active={metric === 'views'}
              accentColor={chartByMetric.views.color}
              onClick={() => setMetric('views')}
            />
            <KpiCell
              label="Время просмотра (часы)"
              value={formatHours(overview.kpis.watchTime.value)}
              note={belowUsual(overview.kpis.watchTime.value, formatHours)}
              active={metric === 'watch'}
              accentColor={chartByMetric.watch.color}
              onClick={() => setMetric('watch')}
            />
            <KpiCell
              label="Подписчики"
              value={signedNumber(overview.kpis.subscribers.value)}
              note={belowUsual(Math.abs(overview.kpis.subscribers.value) || 1)}
              active={metric === 'subscribers'}
              accentColor={chartByMetric.subscribers.color}
              onClick={() => setMetric('subscribers')}
            />
            <KpiCell
              label="Расчетный доход"
              value={formatTenge(monetization?.kpis?.revenue?.value || 0)}
              active={metric === 'revenue'}
              clock
              accentColor={chartByMetric.revenue.color}
              onClick={() => setMetric('revenue')}
            />
          </div>

          <div className={s.ytHeroChart} style={{ '--overview-tooltip-accent': chart.color }}>
            <AreaLineChart
              data={chart.data}
              dataKey={chart.dataKey}
              xKey="date"
              color={chart.color}
              height={174}
              name={chart.name}
              formatY={chart.formatY}
              xTickFormatter={formatDateLong}
              formatTooltipValue={chart.formatTooltipValue}
              yAxisOrientation="right"
              yAxisWidth={heroYAxisWidth}
              margin={heroChartMargin}
              fillTopOpacity={heroFillTopOpacity}
              fillBottomOpacity={heroFillBottomOpacity}
              tooltipClassName={s.overviewHeroTooltip}
              tooltipLabelClassName={s.overviewHeroTooltipLabel}
              tooltipValueClassName={s.overviewHeroTooltipValue}
              tooltipCursor={{ stroke: '#6c6c6c', strokeOpacity: 0.8, strokeWidth: 1 }}
              activeDotProps={{ r: 5, stroke: '#282828', strokeWidth: 2, fill: chart.color }}
            />
          </div>

          <div className={s.ytHeroFooter}>
            <button type="button" className={s.ytPillBtn}>Подробнее</button>
          </div>
        </Card>

        <Card padding="lg" depth="md" className={`${s.aiCard} ${s.overviewAICard} ${s.overviewInset}`}>
          <div className={s.aiIcon}><SparkleIcon size={20} /></div>
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
                  <ThumbUpIcon size={20} />
                </button>
                <button type="button" className={s.aiFeedbackButton} aria-label="Не нравится">
                  <ThumbDownIcon size={20} />
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
                  <td className={s.right}>{formatNumberRu(video.views)}</td>
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
          <div className={s.sideBig}>{formatNumberRu((channel?.subscriberCount || 0) + realtimeFeed.subDelta)}</div>
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
          {overview.topVideos.slice(0, 3).map((video) => (
            <div className={s.sideVideoRow} key={video.id}>
              <div className={s.sideThumb}>
                {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
              </div>
              <div className={s.sideVideoTitle}>{video.title}</div>
              <div className={s.sideVideoValue}>{formatCompactNumber(video.views)}</div>
            </div>
          ))}
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </Card>

        {newestVideo ? (
          <Card padding="md" depth="md" className={`${s.sideCard} ${s.newVideoCard} ${s.overviewNewVideoCard}`}>
            <div className={s.sideTitle}>Новый контент</div>
            <div className={s.newVideoCover}>
              {newestVideo.cover ? <img src={newestVideo.cover} alt="" /> : <div className={s.thumbBlank} />}
              <div className={s.newVideoOverlay}>
                <div className={s.newVideoOverlayTitle}>{newestVideo.title}</div>
              </div>
              <span>{newestVideo.duration}</span>
            </div>
            <div className={s.sideLabel}>
              {newestVideo.type === 'live'
                ? liveEndedLong(newestVideo.date)
                : daysSinceLong(newestVideo.date)}
            </div>
            {newestVideo.type === 'live' ? (
              <div className={s.liveNote}>
                <span className={s.liveNoteIcon}><InfoIcon size={16} /></span>
                <span>Для прямых трансляций сравнение показателей доступно только за периоды после публикации.</span>
              </div>
            ) : null}
            {newestMetrics.map((item) => (
              <NewContentMetric
                key={item.label}
                label={item.label}
                value={item.value}
                secondaryLabel={item.secondaryLabel}
                secondaryValue={item.secondaryValue}
              />
            ))}
            <button type="button" className={s.ytWideBtn}>Посмотреть аналитику для видео</button>
            {newestPool.length > 1 ? (
              <div className={s.pager}>
                <button type="button" onClick={() => setNewestIdx((i) => Math.max(0, i - 1))} aria-label="Предыдущее" disabled={!canGoPrev}>
                  <ChevronLeft size={16} />
                </button>
                <span>{newestIdx + 1} из {newestPool.length}</span>
                <button type="button" onClick={() => setNewestIdx((i) => Math.min(newestPool.length - 1, i + 1))} aria-label="Следующее" disabled={!canGoNext}>
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </aside>
    </div>
  )
}
