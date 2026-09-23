import { useContext, useMemo } from 'react'
import s from './Screen1Dashboard.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  UploadIcon, LiveIcon, EditIcon, ChevronUp, ChevronRight, ChevronLeft,
  ChartIcon, CommentIcon, ThumbUpIcon, KebabIcon, SparkleIcon,
} from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { CHANNEL_DEFAULTS } from '../storage/channelStore.js'
import { formatNumber, formatViews } from '../storage/videoStore.js'
import { effectiveComments, build as buildAnalytics } from '../lib/analyticsAggregator.js'
import { averageViewFraction } from '../lib/videoMetrics.js'
import VideoRow from '../components/ui/VideoRow.jsx'
import { formatTenge } from './analytics/studioAnalyticsHelpers.js'
import { videoAnalyticsRoute } from '../lib/videoPerformanceSection.js'
import { addDays, daysBetween, isoDay } from '../lib/analyticsEngine.js'
import { getAlmatyDateISO } from '../lib/almatyDate.js'

const PERFORMANCE_THUMB = '/studio-assets/dashboard-performance-reference.jpg'
const SHOPPING_ART = '/studio-assets/dashboard-shopping-idea.png'

function parseDurationSeconds(value) {
  const parts = String(value || '').split(':').map((part) => Math.max(0, parseInt(part, 10) || 0))
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.round(seconds) || 0)
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatPercent(value) {
  const percent = Number(value)
  if (!Number.isFinite(percent)) return '—'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(percent)} %`
}

function plural(value, one, few, many) {
  const n = Math.abs(Math.round(Number(value) || 0))
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/* Дата публикации хранится без времени, поэтому считаем полные дни по Алматы. */
function publicationAgeDays(iso) {
  if (!iso) return 0
  return Math.max(0, daysBetween(iso, getAlmatyDateISO()))
}

function firstDaysLabel(iso) {
  const days = publicationAgeDays(iso)
  if (days === 0) return 'Первые часы после публикации'
  return `Первые ${days} ${plural(days, 'день', 'дня', 'дней')} после публикации`
}

function elapsedSince(iso) {
  const days = publicationAgeDays(iso)
  if (days === 0) return 'сегодня'
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`
}

function formatDelta(n) {
  const value = Math.round(Number(n) || 0)
  if (value === 0) return '— за последние 28 дней'
  if (value < 0) return `– ${formatNumber(Math.abs(value))} за последние 28 дней`
  return `+${formatNumber(value)} за последние 28 дней`
}

function avatarLetter(value) {
  const clean = String(value || '').replace(/^@/, '').trim()
  return clean ? clean[0].toUpperCase() : ''
}

export default function Screen1Dashboard() {
  const { showToast, go } = useContext(NavContext)
  const { videos } = useVideos()
  const { channel } = useChannel()
  const lastVideo = videos[0]

  const analytics = useMemo(
    () => buildAnalytics(videos, channel, { kind: '28d' }),
    [videos, channel],
  )
  const dashboardComments = Array.isArray(channel.dashboardComments)
    ? channel.dashboardComments
    : CHANNEL_DEFAULTS.dashboardComments
  const recentSubscribers = Array.isArray(channel.recentSubscribers)
    ? channel.recentSubscribers
    : CHANNEL_DEFAULTS.recentSubscribers
  const channelRevenue = analytics.monetization.kpis.revenue.value
  const watchHours = analytics.overview.kpis.watchTime.value
  const subscriberDelta = analytics.overview.kpis.subscribers.value
  const topVideos = (analytics.realtime.topVideos || []).slice(0, 2)
  const publishedVideos = videos.slice(0, 4)
  const lastVideoComments = lastVideo ? effectiveComments(lastVideo, channel) : 0
  const lastVideoAverageFraction = averageViewFraction(lastVideo)
  const avgViewDuration = lastVideo && lastVideoAverageFraction != null
    ? formatDuration(parseDurationSeconds(lastVideo.duration) * lastVideoAverageFraction)
    : '—'
  const avgViewPercentage = lastVideoAverageFraction != null
    ? formatPercent(lastVideoAverageFraction * 100)
    : '—'
  const maxConcurrent = lastVideo ? Math.max(3, Math.round((Number(lastVideo.views) || 0) * 0.007)) : 0
  const performanceTitle = lastVideo?.type === 'live' ? 'Эффективность прямой трансляции' : 'Эффективность последнего видео'
  // Как в YouTube: последние 10 роликов того же формата сравниваются по
  // просмотрам за одинаковый срок после публикации, а не за всё время.
  const recentRankingPool = lastVideo
    ? videos.filter((video) => video.type === lastVideo.type).slice(0, 10)
    : []
  const rankingAge = publicationAgeDays(lastVideo?.date)
  const viewsAtAge = (video) => {
    const rows = (channel.videoDailyStats || []).filter((row) => String(row.videoId) === String(video.id))
    if (rows.length === 0) return Number(video.views) || 0
    const until = isoDay(addDays(video.date, Math.max(0, rankingAge - 1)))
    return rows.reduce((sum, row) => (row.date <= until ? sum + (Number(row.views) || 0) : sum), 0)
  }
  const lastVideoRank = lastVideo
    ? [...recentRankingPool]
        .map((video) => ({ id: video.id, views: rankingAge > 0 ? viewsAtAge(video) : Number(video.views) || 0 }))
        .sort((a, b) => b.views - a.views)
        .findIndex((video) => video.id === lastVideo.id) + 1
    : 0

  return (
    <div className={s.page}>
      <TopBar />
      <Sidebar active="home" />

      <main className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.pageTitle}>Панель управления каналом</h1>
          <div className={s.actions}>
            <button type="button" className={s.actionBtn} onClick={() => go('admin')} aria-label="Добавить видео"><UploadIcon /></button>
            <button type="button" className={s.actionBtn} onClick={() => showToast('Начать трансляцию')} aria-label="Начать трансляцию"><LiveIcon /></button>
            <button type="button" className={s.actionBtn} onClick={() => showToast('Создать запись')} aria-label="Создать запись"><EditIcon /></button>
          </div>
        </div>

        <div className={s.grid}>
          <section className={s.col}>
            {lastVideo ? (
              <div className={`${s.card} ${s.performanceCard}`} data-testid="performance-card">
                <h2 className={`${s.cardTitle} ${s.performanceTitle}`}>
                  {performanceTitle}
                  {lastVideo.type === 'short' ? <span>Shorts</span> : null}
                </h2>
                <div className={s.perfThumb} data-testid="performance-thumbnail">
                  <img
                    src={lastVideo.cover || PERFORMANCE_THUMB}
                    alt={`Обложка видео «${lastVideo.title}»`}
                  />
                  <h3 className={s.videoHeading}>{lastVideo.title}</h3>
                </div>
                <div className={s.statsRow}>
                  <span className={s.stat}><ChartIcon />{formatViews(lastVideo.views)}</span>
                  <span className={s.stat}><CommentIcon />{formatNumber(lastVideoComments)}</span>
                  <span className={s.stat}><ThumbUpIcon />{formatNumber(lastVideo.likes || 0)}</span>
                  <span className={s.chevUp}><ChevronUp /></span>
                </div>
                <div className={s.publishLine}>
                  {lastVideo.type === 'live'
                    ? `Во время прямого эфира (он закончился ${elapsedSince(lastVideo.date)})`
                    : firstDaysLabel(lastVideo.date)}
                </div>
                {lastVideo.type === 'live' ? (
                  <div className={s.infoLine}>Для прямых трансляций сравнение показателей доступно только за периоды после публикации.</div>
                ) : null}
                {lastVideo.type !== 'live' ? (
                  <button type="button" className={s.rankBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                    <span>Место в рейтинге по числу просмотров</span>
                    <strong>
                      {Math.max(1, lastVideoRank)} из {Math.max(1, recentRankingPool.length)}
                      <ChevronRight />
                    </strong>
                  </button>
                ) : null}
                <button type="button" className={s.metricBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                  <span>Просмотры</span>
                  <strong>{formatViews(lastVideo.views)}</strong>
                </button>
                {lastVideo.type === 'live' ? (
                  <>
                    <button type="button" className={s.metricBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                      <span>Средняя продолжительность просмотра</span>
                      <strong>{avgViewDuration}</strong>
                    </button>
                    <button type="button" className={s.metricBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                      <span>Макс. число одновременных зрителей</span>
                      <strong>{formatViews(maxConcurrent)}</strong>
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={s.metricBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                      <span>Средний процент просмотра</span>
                      <strong>{avgViewPercentage}</strong>
                    </button>
                    <button type="button" className={s.metricBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))}>
                      <span>Отметки "Нравится"</span>
                      <strong>{formatNumber(lastVideo.likes || 0)}</strong>
                    </button>
                  </>
                )}
                <div className={s.performanceActions} data-testid="performance-actions">
                  <button type="button" className={s.catchBtn} onClick={() => showToast('Catch me up on this video')}>
                    <SparkleIcon size={18} />
                    Catch me up on this video
                  </button>
                  <button type="button" className={s.performanceIconBtn} onClick={() => go(videoAnalyticsRoute(lastVideo))} aria-label="Посмотреть статистику по видео">
                    <ChartIcon />
                  </button>
                  <button type="button" className={s.performanceIconBtn} onClick={() => go('community')} aria-label={`Перейти к комментариям (${formatNumber(lastVideoComments)})`}>
                    <CommentIcon />
                  </button>
                </div>
              </div>
            ) : (
              <div className={s.card}>
                <h2 className={s.cardTitle}>Эффективность последнего видео</h2>
                <div className={s.emptyCard}>
                  Пока нет видео.{' '}
                  <button type="button" className={s.emptyLink} onClick={() => go('admin')}>Добавьте первое в админке</button>
                </div>
              </div>
            )}

            <div className={s.card}>
              <h2 className={s.cardTitle}>Опубликованные видео</h2>
              {publishedVideos.length > 0 ? (
                <div className={s.publishedList}>
                  {publishedVideos.map((video) => (
                    <VideoRow
                      as="button"
                      className={s.publishedRow}
                      thumbClassName={s.publishedThumb}
                      bodyClassName={s.publishedBody}
                      titleClassName={s.publishedTitle}
                      metaClassName={s.publishedMeta}
                      blankClassName={s.thumbBlank}
                      key={video.id}
                      cover={video.cover}
                      title={video.title}
                      onClick={() => go(videoAnalyticsRoute(video))}
                      meta={(
                        <>
                          <span>{formatViews(video.views)}</span>
                          <span>{formatNumber(effectiveComments(video, channel))}</span>
                          <span>{formatNumber(video.likes || 0)}</span>
                        </>
                      )}
                    />
                  ))}
                  <button type="button" className={s.linkBtn} onClick={() => go('content')}>Перейти к видео</button>
                </div>
              ) : (
                <div className={s.emptyCard}>Опубликованных видео пока нет.</div>
              )}
            </div>

            <div className={s.card}>
              <div className={s.postEmpty}>
                <img className={s.postIllustration} src="/studio-assets/post-empty.png" alt="" />
                <p>Опубликуйте первую запись, чтобы начать обсуждение и получить отзывы от сообщества.</p>
                <button type="button" className={s.whitePill} onClick={() => showToast('Создать запись')}>Создать запись</button>
              </div>
            </div>
          </section>

          <section className={s.col}>
            <div className={`${s.card} ${s.analyticsCard}`}>
              <h2 className={s.cardTitle}>Аналитика по каналу</h2>
              <div className={s.analyticsBlock}>
                <div className={s.subTitle}>Подписчики</div>
                <div className={s.bigNum}>{formatNumber(channel.subscriberCount || 0)}</div>
                <div className={subscriberDelta < 0 ? s.negativeLine : s.deltaLine}>{formatDelta(subscriberDelta)}</div>
              </div>
              <div className={s.divider} />
              <div className={s.summaryHead}>Сводные данные</div>
              <div className={s.summaryTime}>Последние 28 дней</div>
              <div className={s.summaryRow}>
                Просмотры
                <span className={s.num}>{formatViews(analytics.overview.kpis.views.value)}</span>
              </div>
              <div className={s.summaryRow}>
                Время просмотра (часы)
                <span className={s.num}>{formatNumber(Math.round(watchHours * 10) / 10)}</span>
              </div>
              <div className={s.summaryRow}>
                Расчетный доход
                <span className={s.num}>{formatTenge(channelRevenue)} <span className={s.dash}>—</span></span>
              </div>
              <div className={s.divider} />
              <div className={s.popularHead}>Самый популярный контент</div>
              <div className={s.popularSub}>Последние 48 часов · Просмотры</div>
              {topVideos.map((v) => (
                <button type="button" className={s.popularRow} key={v.id} onClick={() => go(videoAnalyticsRoute(v))}>
                  <span className={s.popularTitleEllipsis}>{v.title}</span>
                  <span className={s.views}>{formatNumber(v.realtimeViews || 0)}</span>
                </button>
              ))}
              <div className={s.sectionSpacer}>
                <button type="button" className={s.ghostPill} onClick={() => go('analytics')}>Посмотреть статистику по каналу</button>
              </div>
            </div>

            <div className={s.card}>
              <h2 className={s.cardTitle}>Комментарии</h2>
              <div className={s.commentList}>
                {dashboardComments.slice(0, 3).map((comment, index) => (
                  <div className={s.commentRow} key={comment.id || index}>
                    <div className={s.commentAvatar} style={{ backgroundColor: comment.avatarColor || '#525252' }}>
                      {avatarLetter(comment.author)}
                    </div>
                    <div className={s.commentBody}>
                      <div className={s.commentHead}>
                        <span>{comment.author}</span>
                        <span>•</span>
                        <span>{comment.age}</span>
                      </div>
                      <div className={s.commentText}>{comment.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={s.ghostPill} onClick={() => go('community')}>Ещё</button>
            </div>
          </section>

          <section className={s.col}>
            <div className={s.card}>
              <h2 className={s.cardTitle}>Новые подписчики</h2>
              <div className={s.allTime}>Последние 90 дней</div>
              <div className={s.subList}>
                {recentSubscribers.slice(0, 3).map((subscriber, index) => (
                  <div className={s.subRow} key={subscriber.id || index}>
                    <div className={s.subAvatar} style={{ backgroundColor: subscriber.avatarColor || '#525252' }}>
                      {avatarLetter(subscriber.name)}
                    </div>
                    <div className={s.subBody}>
                      <div className={s.subName}>{subscriber.name}</div>
                      <div className={s.subCount}>{subscriber.count}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={s.ghostPill} onClick={() => showToast('Показать всех')}>Показать всех</button>
            </div>

            <div className={`${s.card} ${s.ideasCard}`}>
              <div className={s.ideaTop}>
                <h2 className={s.cardTitle}>Идеи для вас</h2>
                <div className={s.ideaPager}>
                  <button type="button" className={s.miniIconBtn} onClick={() => showToast('Предыдущий элемент')} aria-label="Предыдущий элемент" disabled><ChevronLeft /></button>
                  <span>1 / 3</span>
                  <button type="button" className={s.miniIconBtn} onClick={() => showToast('Следующий элемент')} aria-label="Следующий элемент"><ChevronRight /></button>
                </div>
              </div>
              <div className={s.ideaBody}>
                <div className={s.ideaCopy}>
                  <h3>Вступите в партнерскую программу и начните зарабатывать</h3>
                  <p>Приглашаем в партнерскую программу YouTube Покупок. Вы сможете отмечать товары в видео и получать комиссию с продаж, помогая зрителям с покупками.</p>
                </div>
                <img className={s.ideaArt} src={SHOPPING_ART} alt="" />
              </div>
              <div className={s.ideaActions}>
                <button type="button" className={s.ghostPill} onClick={() => go('monetization')}>Вступить в программу</button>
                <button type="button" className={s.miniIconBtn} onClick={() => showToast('Скрыть')} aria-label="Скрыть"><KebabIcon /></button>
              </div>
            </div>
          </section>
        </div>

        <div className={s.footer}>
          <button type="button" className={s.footerLink} onClick={() => showToast('Условия использования')}>Условия использования</button>
          <button type="button" className={s.footerLink} onClick={() => showToast('Конфиденциальность')}>Политика конфиденциальности</button>
          <button type="button" className={s.footerLink} onClick={() => showToast('Правила')}>Правила и безопасность</button>
        </div>
      </main>
    </div>
  )
}
