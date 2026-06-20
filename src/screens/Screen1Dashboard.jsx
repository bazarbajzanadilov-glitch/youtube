import { useContext, useMemo } from 'react'
import s from './Screen1Dashboard.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  UploadIcon, LiveIcon, EditIcon, ChevronUp, ChevronRight, ChevronLeft,
  ChartIcon, CommentIcon, ThumbUpIcon, KebabIcon, HelpIcon, SparkleIcon,
} from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { CHANNEL_DEFAULTS } from '../storage/channelStore.js'
import { formatNumber, formatMoney, formatViews } from '../storage/videoStore.js'
import { effectiveComments, build as buildAnalytics } from '../lib/analyticsAggregator.js'

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

function daysSince(iso) {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const days = Math.max(0, Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24)))
  if (days === 0) return 'сегодня'
  if (days === 1) return '1 день назад'
  if (days < 5) return `${days} дня назад`
  return `${days} дней назад`
}

function elapsedSince(iso) {
  if (!iso) return 'недавно'
  const diffHours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)))
  const days = Math.floor(diffHours / 24)
  const hours = diffHours % 24
  if (days === 0) return `${hours || 1} часов назад`
  return `${days} дней ${hours} часов назад`
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
  const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 2)
  const publishedVideos = videos.slice(0, 4)
  const lastVideoComments = lastVideo ? effectiveComments(lastVideo) : 0
  const avgViewDuration = lastVideo ? formatDuration(parseDurationSeconds(lastVideo.duration) * 0.45) : '0:00'
  const maxConcurrent = lastVideo ? Math.max(3, Math.round((Number(lastVideo.views) || 0) * 0.007)) : 0
  const performanceTitle = lastVideo?.type === 'live' ? 'Эффективность прямой трансляции' : 'Эффективность последнего видео'

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
            <div className={`${s.card} ${s.violationsCard}`}>
              <div className={s.cardHead}>
                <h2 className={s.cardTitle}>Нарушения</h2>
                <button type="button" className={s.helpBtn} onClick={() => showToast('Справка')} aria-label="Справка"><HelpIcon size={24} /></button>
              </div>
              <div className={s.violationList}>
                <button type="button" className={s.violationRow} onClick={() => showToast('Авторские права')}>
                  <span>Действующие предупреждения о нарушении авторских прав</span>
                  <strong className={s.dangerBadge}>1 из 3</strong>
                </button>
                <button type="button" className={s.violationRow} onClick={() => showToast('Правила сообщества')}>
                  <span>Действительные предупреждения о нарушении правил сообщества</span>
                  <strong className={s.noticeBadge}>Уведомление</strong>
                </button>
              </div>
            </div>

            {lastVideo ? (
              <div className={s.card}>
                <h2 className={s.cardTitle}>{performanceTitle}</h2>
                <div className={s.perfThumb}>
                  <img src={PERFORMANCE_THUMB} alt="" />
                </div>
                <h3 className={s.videoHeading}>{lastVideo.title}</h3>
                <div className={s.statsRow}>
                  <span className={s.stat}><ChartIcon />{formatViews(lastVideo.views)}</span>
                  <span className={s.stat}><CommentIcon />{formatNumber(lastVideoComments)}</span>
                  <span className={s.stat}><ThumbUpIcon />{formatNumber(lastVideo.likes || 0)}</span>
                  <span className={s.chevUp}><ChevronUp /></span>
                </div>
                <div className={s.publishLine}>
                  {lastVideo.type === 'live'
                    ? `Во время прямого эфира (он закончился ${elapsedSince(lastVideo.date)})`
                    : `${daysSince(lastVideo.date)} после публикации`}
                </div>
                {lastVideo.type === 'live' ? (
                  <div className={s.infoLine}>Для прямых трансляций сравнение показателей доступно только за периоды после публикации.</div>
                ) : null}
                <button type="button" className={s.metricBtn} onClick={() => go('analytics')}>
                  <span>Просмотры</span>
                  <strong>{formatViews(lastVideo.views)}</strong>
                </button>
                <button type="button" className={s.metricBtn} onClick={() => go('analytics')}>
                  <span>Средняя продолжительность просмотра</span>
                  <strong>{avgViewDuration}</strong>
                </button>
                <button type="button" className={s.metricBtn} onClick={() => go('analytics')}>
                  <span>Макс. число одновременных зрителей</span>
                  <strong>{formatViews(maxConcurrent)}</strong>
                </button>
                <button type="button" className={s.catchBtn} onClick={() => showToast('Catch me up on this video')}>
                  <SparkleIcon size={18} />
                  Catch me up on this video
                </button>
                <div className={s.linkStack}>
                  <button type="button" className={s.linkBtn} onClick={() => go('analytics')}>Посмотреть статистику по видео</button>
                  <button type="button" className={s.linkBtn} onClick={() => go('community')}>Перейти к комментариям ({formatNumber(lastVideoComments)})</button>
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
                    <button type="button" className={s.publishedRow} key={video.id} onClick={() => go('content')}>
                      <span className={s.publishedThumb}>
                        {video.cover ? <img src={video.cover} alt="" /> : <span className={s.thumbBlank} />}
                      </span>
                      <span className={s.publishedBody}>
                        <span className={s.publishedTitle}>{video.title}</span>
                        <span className={s.publishedMeta}>
                          <span>{formatViews(video.views)}</span>
                          <span>{formatNumber(effectiveComments(video))}</span>
                          <span>{formatNumber(video.likes || 0)}</span>
                        </span>
                      </span>
                    </button>
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
                <span className={s.num}>{formatMoney(channelRevenue)} <span className={s.dash}>—</span></span>
              </div>
              <div className={s.divider} />
              <div className={s.popularHead}>Самый популярный контент</div>
              <div className={s.popularSub}>Последние 48 часов · Просмотры</div>
              {topVideos.map((v) => (
                <button type="button" className={s.popularRow} key={v.id} onClick={() => go('analytics')}>
                  <span className={s.popularTitleEllipsis}>{v.title}</span>
                  <span className={s.views}>{formatNumber(Math.max(1, Math.round((v.views || 0) / 900)))}</span>
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
