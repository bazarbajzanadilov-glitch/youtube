import { useContext, useMemo } from 'react'
import s from './Screen1Dashboard.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  SparkleIcon, UploadIcon, LiveIcon, EditIcon, ChevronUp, ChartIcon,
  CommentIcon, ThumbUpIcon, KebabIcon, CheckCircle, CakeIcon,
} from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { formatNumber, formatMoney, formatViews, formatLikePct } from '../storage/videoStore.js'
import { effectiveRevenue, effectiveComments, build as buildAnalytics } from '../lib/analyticsAggregator.js'
import SparklineChart from '../components/charts/SparklineChart.jsx'
import { FAST_CHART_ANIMATION_MS } from '../components/charts/chartAnimation.js'
import { CHART_COLORS } from '../lib/chartColors.js'

const PostEmptyArt = () => (
  <svg width="80" height="80" viewBox="0 0 80 80">
    <ellipse cx="40" cy="68" rx="28" ry="4" fill="#1a1a1a"/>
    <path d="M20 30 L40 18 L60 30 L60 60 L20 60 Z" fill="#E63946"/>
    <rect x="28" y="36" width="24" height="20" fill="#FFFFFF"/>
    <path d="M52 36 L60 30 L60 36 Z" fill="#A52833"/>
    <circle cx="35" cy="44" r="2" fill="#1F1F1F"/>
    <circle cx="45" cy="44" r="2" fill="#1F1F1F"/>
    <path d="M32 48 Q40 54 48 48" stroke="#1F1F1F" strokeWidth="1.5" fill="none"/>
  </svg>
)

function daysSince(iso) {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const days = Math.max(0, Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24)))
  if (days === 0) return 'Только что опубликовано'
  if (days === 1) return '1 день после публикации'
  if (days < 5) return `${days} дня после публикации`
  return `${days} дней после публикации`
}

export default function Screen1Dashboard() {
  const { showToast, go } = useContext(NavContext)
  const { videos, totals } = useVideos()
  const { channel } = useChannel()
  const lastVideo = videos[0]

  const channelRevenue = useMemo(
    () => videos.reduce((sum, v) => sum + effectiveRevenue(v, channel), 0),
    [videos, channel],
  )
  const channelComments = useMemo(
    () => videos.reduce((sum, v) => sum + effectiveComments(v), 0),
    [videos],
  )
  const lastVideoRevenue = lastVideo ? effectiveRevenue(lastVideo, channel) : 0

  /* Sparkline-серия для блока «Аналитика по каналу» */
  const sparkSeries = useMemo(() => {
    if (videos.length === 0) return []
    const a = buildAnalytics(videos, channel, { kind: '28d' })
    return a.overview.series.map((d) => d.views)
  }, [videos, channel])
  const revenueSpark = useMemo(() => {
    if (videos.length === 0) return []
    const a = buildAnalytics(videos, channel, { kind: '28d' })
    return a.monetization.series.map((d) => d.revenue)
  }, [videos, channel])

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="home"/>

      <div className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.pageTitle}>Панель управления каналом</h1>
          <div className={s.actions}>
            <button type="button" className={s.actionBtn} onClick={() => go('admin')} aria-label="Загрузить"><UploadIcon/></button>
            <button type="button" className={s.actionBtn} onClick={() => showToast('Эфир')} aria-label="Эфир"><LiveIcon/></button>
            <button type="button" className={s.actionBtn} onClick={() => showToast('Создать запись')} aria-label="Создать запись"><EditIcon/></button>
          </div>
        </div>

        <div className={s.grid}>
          <div className={s.col}>
            {lastVideo ? (
              <div className={s.card}>
                <h2 className={s.cardTitle}>Эффективность последнего видео</h2>
                <div className={s.perfThumb}>
                  {lastVideo.cover ? <img src={lastVideo.cover} alt=""/> : <div className={s.thumbBlank}/>}
                  <div className={s.thumbLabel}>{lastVideo.title}</div>
                </div>
                <div className={s.statsRow}>
                  <span className={s.stat}><ChartIcon/>{formatNumber(lastVideo.views)}</span>
                  <span className={s.stat}><CommentIcon/>0</span>
                  <span className={s.stat}><ThumbUpIcon/>{formatNumber(lastVideo.likes)}</span>
                  <span className={s.chevUp}><ChevronUp/></span>
                </div>
                <div className={s.publishLine}>{daysSince(lastVideo.date)}</div>
                <div className={s.metric}>
                  <span className={s.label}>Просмотры</span>
                  <span className={s.val}>{formatNumber(lastVideo.views)}</span>
                </div>
                <div className={s.metric}>
                  <span className={s.label}>«Нравится»</span>
                  <span className={s.val}>{formatLikePct(lastVideo.likePct)}</span>
                </div>
                <div className={s.metric}>
                  <span className={s.label}>Доход с видео</span>
                  <span className={s.val}>{formatMoney(lastVideoRevenue)}</span>
                </div>
                <div className={s.metric}>
                  <span className={s.label}>Длительность</span>
                  <span className={s.val}>{lastVideo.duration}</span>
                </div>
                <div className={s.catchRow}>
                  <button type="button" className={s.catchPill} onClick={() => showToast('Краткая сводка по видео')}><SparkleIcon size={18}/>Catch me up on this video</button>
                  <button type="button" className={s.miniIconBtn} onClick={() => go('analytics')} aria-label="Аналитика"><ChartIcon/></button>
                  <button type="button" className={s.miniIconBtn} onClick={() => go('community')} aria-label="Комментарии"><CommentIcon/></button>
                </div>
              </div>
            ) : (
              <div className={s.card}>
                <h2 className={s.cardTitle}>Эффективность последнего видео</h2>
                <div className={s.emptyCard}>
                  Пока нет видео.{' '}
                  <button type="button" className={s.emptyLink} onClick={() => go('admin')}>Добавьте первое в админке →</button>
                </div>
              </div>
            )}

            <div className={s.card}>
              <div className={s.postEmpty}>
                <div className={s.postIllustration}><PostEmptyArt/></div>
                <div className={s.postEmptyText}>
                  Опубликуйте первую запись, чтобы начать обсуждение и получить отзывы от сообщества.
                </div>
                <button type="button" className={s.whitePill} onClick={() => showToast('Создать запись')}>Создать запись</button>
              </div>
            </div>
          </div>

          <div className={s.col}>
            <div className={s.card}>
              <h2 className={s.cardTitle}>Поздравляем!</h2>
              <div className={s.congrats}>
                <div className={s.congratsIcon}><CakeIcon/></div>
                <div className={s.congratsBody}>
                  <div className={s.congratsTitle}>Вашему каналу уже пять лет!</div>
                  <div className={s.congratsText}>Даже не верится, что прошло столько времени. Это большое достижение!</div>
                </div>
              </div>
              <div className={s.ghostPillRow}>
                <button type="button" className={s.ghostPill} onClick={() => go('analytics')}>Посмотреть статистику</button>
                <button type="button" className={s.miniIconBtn} onClick={() => showToast('Ещё')} aria-label="Меню"><KebabIcon/></button>
              </div>
            </div>

            <div className={s.card}>
              <h2 className={s.cardTitle}>Аналитика по каналу</h2>
              <div className={s.analyticsBlock}>
                <div className={s.subTitle}>Просмотры за 28 дней</div>
                <div className={s.bigNum}>{formatNumber(sparkSeries.reduce((s, x) => s + x, 0))}</div>
                {totals.count > 0 ? (
                  <div className={s.deltaLine}>+ {totals.count} видео за всё время</div>
                ) : null}
                {sparkSeries.length > 0 ? (
                  <div className={s.sparkRow}>
                    <SparklineChart values={sparkSeries} color={CHART_COLORS.primary} height={56} animationDuration={FAST_CHART_ANIMATION_MS} />
                  </div>
                ) : null}
              </div>
              <div className={s.divider}/>
              <div className={s.summaryHead}>Сводные данные</div>
              <div className={s.summaryTime}>За весь период</div>
              <div className={s.summaryRow}>
                Просмотры
                <span className={s.num}>{formatViews(totals.views)} <CheckCircle/></span>
              </div>
              <div className={s.summaryRow}>
                Лайки
                <span className={s.num}>{formatNumber(totals.likes)} <CheckCircle/></span>
              </div>
              <div className={s.summaryRow}>
                Доход
                <span className={s.num}>{formatMoney(channelRevenue)} <CheckCircle/></span>
              </div>
              <div className={s.summaryRow}>
                Комментарии
                <span className={s.num}>{formatNumber(channelComments)} <CheckCircle/></span>
              </div>
              {videos.length > 0 ? (
                <>
                  <div className={s.divider}/>
                  <div className={s.popularHead}>Самый популярный контент</div>
                  <div className={s.popularSub}>За всё время · Просмотры</div>
                  {[...videos].sort((a, b) => b.views - a.views).slice(0, 3).map((v) => (
                    <div className={s.popularRow} key={v.id}>
                      <div className={s.popularThumb}>
                        {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                      </div>
                      <span className={s.popularTitleEllipsis}>{v.title}</span>
                      <span className={s.views}>{formatNumber(v.views)}</span>
                    </div>
                  ))}
                </>
              ) : null}
              <div className={s.sectionSpacer}>
                <button type="button" className={s.ghostPill} onClick={() => go('analytics')}>Посмотреть статистику по каналу</button>
              </div>
            </div>

            <div className={s.card}>
              <h2 className={s.cardTitle}>Доход</h2>
              <div className={s.bigNum}>{formatMoney(channelRevenue)}</div>
              <div className={s.deltaLine}>За всё время</div>
              {revenueSpark.length > 0 ? (
                <div className={s.sparkRow}>
                  <SparklineChart values={revenueSpark} color={CHART_COLORS.primary} height={56} animationDuration={FAST_CHART_ANIMATION_MS} />
                </div>
              ) : null}
              <div className={s.divider}/>
              <div className={s.summaryRow}>Видео в каталоге<span className={s.num}>{totals.count}</span></div>
              <div className={s.sectionSpacer}>
                <button type="button" className={s.ghostPill} onClick={() => go('monetization')}>Перейти в монетизацию</button>
              </div>
            </div>
          </div>
        </div>

        <div className={s.footer}>
          <button type="button" className={s.footerLink} onClick={() => showToast('Условия использования')}>Условия использования</button>
          <button type="button" className={s.footerLink} onClick={() => showToast('Конфиденциальность')}>Политика конфиденциальности</button>
          <button type="button" className={s.footerLink} onClick={() => showToast('Правила')}>Правила и безопасность</button>
        </div>
      </div>
    </div>
  )
}
