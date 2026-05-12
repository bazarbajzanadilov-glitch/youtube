import { motion } from 'framer-motion'
import s from './AnalyticsTabs.module.css'
import Card from '../../components/ui/Card.jsx'
import RealtimeIndicator from '../../components/ui/RealtimeIndicator.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AnimatedCounter from '../../components/ui/AnimatedCounter.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import RealtimeMiniChart from '../../components/charts/RealtimeMiniChart.jsx'
import { FAST_CHART_ANIMATION_SECONDS } from '../../components/charts/chartAnimation.js'
import {
  formatCompactNumber, formatHours, formatSecondsAsClock,
  formatNumberRu, formatDateLong, formatPercent, formatMoneyFixed, formatMoneyShort,
} from '../../lib/analyticsFormat.js'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { useRealtimeFeed } from '../../hooks/useRealtimeFeed.js'
import { KpiArrowUpIcon, ChevronLeft, ChevronRight } from '../icons.jsx'
import { useState } from 'react'
import clockIcon from '../../assets/clock.svg'

function rangeMessage(range) {
  switch (range.kind) {
    case 'lifetime': return 'За всё время'
    case '7d': return 'За последние 7 дней'
    case '28d': return 'За последние 28 дней'
    case '90d': return 'За последние 90 дней'
    case '365d': return 'За последний год'
    case 'custom': return 'За выбранный период'
    default: return 'За выбранный период'
  }
}

const inlineKpiVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function InlineKPI({
  label,
  labelIcon,
  value,
  format,
  hint,
  suffix,
  isFirst,
  hideMeta = false,
  showTrend = true,
  onClick,
  active = false,
}) {
  const Tag = onClick ? motion.button : motion.div
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${s.inlineKpi} ${onClick ? s.inlineKpiButton : ''} ${active ? s.inlineKpiActive : ''} ${isFirst ? '' : s.inlineKpiBordered}`}
      variants={inlineKpiVariants}
      onClick={onClick}
    >
      <div className={labelIcon ? `${s.inlineKpiLabel} ${s.inlineKpiLabelWithIcon}` : s.inlineKpiLabel}>
        <span>{label}</span>
        {labelIcon ? <img className={s.inlineKpiLabelIcon} src={labelIcon} alt="" aria-hidden="true" /> : null}
      </div>
      <div className={s.inlineKpiValue}>
        <AnimatedCounter value={Number(value) || 0} format={format} />
        {suffix ? <span className={s.inlineKpiSuffix}>{suffix}</span> : null}
        {showTrend ? <span className={s.inlineKpiTrendIcon}><KpiArrowUpIcon /></span> : null}
      </div>
      {hideMeta ? null : (
        <div className={s.inlineKpiHint}>
          <span className={s.inlineKpiHintText}>{hint}</span>
        </div>
      )}
    </Tag>
  )
}

function moreThanUsual(value, delta, format) {
  const v = Number(value) || 0
  const d = Number(delta)
  if (v <= 0) return 'Обычное значение'
  if (!Number.isFinite(d) || d <= 0) return `${format(v)} больше обычного`
  const previous = v / (1 + d / 100)
  const diff = Math.max(0, v - previous)
  return `${format(diff)} больше обычного`
}

export default function OverviewTab({ data, onOpenAdmin }) {
  const { overview, channel, realtime, range, monetization, audience } = data
  const kpis = overview.kpis
  const realtimeFeed = useRealtimeFeed({
    initial: realtime.last48,
    seed: realtime.generatorSeed,
    intervalMs: 5000,
    baseSubscribers: 0,
  })
  const [newestIdx, setNewestIdx] = useState(0)
  const [chartMetric, setChartMetric] = useState('views')
  const newestPool = overview.topVideos.slice(0, Math.min(5, overview.topVideos.length))
  const newestVideo = newestPool[newestIdx] || overview.newest

  if ((data.overview.topVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных для аналитики"
        description="Добавьте видео в админке — KPI и графики соберутся автоматически из тех же данных."
        action={
          <button type="button" className={s.linkBtn} onClick={onOpenAdmin}>
            Открыть админку →
          </button>
        }
      />
    )
  }

  const isLifetime = range.kind === 'lifetime'
  const periodDelta = (d) => isLifetime ? undefined : d
  const liveViews = realtimeFeed.bars[realtimeFeed.bars.length - 1] || 0
  const overviewChartSeries = overview.series.map((row) => ({
    ...row,
    watchTimeHours: row.watchTime / 3600,
  }))
  const chartConfigs = {
    views: {
      data: overview.series,
      dataKey: 'views',
      name: 'Просмотры',
      formatY: formatCompactNumber,
      formatTooltipValue: (v) => formatCompactNumber(v),
    },
    watchTime: {
      data: overviewChartSeries,
      dataKey: 'watchTimeHours',
      name: 'Время просмотра',
      formatY: formatHours,
      formatTooltipValue: (v) => `${formatHours(v)} ч`,
    },
    subscribers: {
      data: audience?.subscribers || [],
      dataKey: 'subscribers',
      name: 'Подписчики',
      formatY: formatCompactNumber,
      formatTooltipValue: (v) => formatNumberRu(v),
    },
    revenue: {
      data: overview.series,
      dataKey: 'revenue',
      name: 'Доход',
      formatY: (n) => formatMoneyShort(n),
      formatTooltipValue: (v) => formatMoneyFixed(v),
    },
  }
  const chartConfig = chartConfigs[chartMetric] || chartConfigs.views

  return (
    <div className={s.overviewLayout}>
      <div className={s.overviewMain}>
        {/* HERO CARD per PDF 11.pdf — KPIs inside, dividers, chart below */}
        <Card padding="lg" depth="lg" className={s.heroCardPdf}>
          <h2 className={s.heroPdfTitle}>
            <span>{rangeMessage(range)} ваши видео набрали</span>
            <strong>
              <AnimatedCounter value={kpis.views.value} format={(n) => formatNumberRu(n)} />
              <span className={s.heroPdfTitleUnit}>{declViews(kpis.views.value)}</span>
            </strong>
          </h2>

          <motion.div
            className={`${s.inlineKpiRow} ${s.inlineKpiRowFour}`}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden"
            animate="show"
          >
            <InlineKPI
              label="Просмотры"
              value={kpis.views.value}
              format={formatCompactNumber}
              hint={isLifetime ? 'за всё время' : moreThanUsual(kpis.views.value, periodDelta(kpis.views.delta), formatCompactNumber)}
              isFirst
              onClick={() => setChartMetric('views')}
              active={chartMetric === 'views'}
            />
            <InlineKPI
              label="Время просмотра (часы)"
              value={kpis.watchTime.value}
              format={formatHours}
              hint={isLifetime ? 'за всё время' : moreThanUsual(kpis.watchTime.value, periodDelta(kpis.watchTime.delta), formatHours)}
              onClick={() => setChartMetric('watchTime')}
              active={chartMetric === 'watchTime'}
            />
            <InlineKPI
              label="Подписчики"
              value={kpis.subscribers.value}
              format={(n) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ru-RU')}`}
              hint={isLifetime
                ? `всего ${formatNumberRu(kpis.subscribers.absolute)}`
                : `${formatCompactNumber(Math.abs(kpis.subscribers.value))} больше обычного`}
              onClick={() => setChartMetric('subscribers')}
              active={chartMetric === 'subscribers'}
            />
            <InlineKPI
              label="Расчетный доход"
              labelIcon={clockIcon}
              value={monetization?.kpis?.revenue?.value || 0}
              format={(n) => formatMoneyFixed(n)}
              hideMeta
              showTrend={false}
              onClick={() => setChartMetric('revenue')}
              active={chartMetric === 'revenue'}
            />
          </motion.div>

          <div className={s.heroChartWrap}>
            <AreaLineChart
              data={chartConfig.data}
              dataKey={chartConfig.dataKey}
              xKey="date"
              color={CHART_COLORS.primary}
              height={210}
              name={chartConfig.name}
              formatY={chartConfig.formatY}
              formatTooltipValue={chartConfig.formatTooltipValue}
              yAxisOrientation="right"
            />
          </div>

          <div className={s.heroPdfFooter}>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </div>
        </Card>

        <h2 className={s.popularPdfTitle}>Самый популярный контент за период</h2>
        <Card padding="none" depth="md">
          <table className={s.popularPdfTable}>
            <thead>
              <tr>
                <th className={s.first}>Контент</th>
                <th className={s.right}>Длительность</th>
                <th className={s.right}>Средняя продолжительность просмотра</th>
                <th className={s.right}>Просмотры</th>
              </tr>
            </thead>
            <tbody>
              {overview.topVideos.slice(0, 6).map((v, i) => (
                <tr key={v.id}>
                  <td className={s.first}>
                    <div className={s.popContent}>
                      <span className={s.rank}>{i + 1}</span>
                      <div className={s.popThumb}>
                        {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                      </div>
                      <div>
                        <div className={s.popName}>{v.title}</div>
                        <div className={s.popDate}>{formatDateLong(v.date)}</div>
                      </div>
                    </div>
                  </td>
                  <td className={s.right}>{v.duration}</td>
                  <td className={s.right}>
                    {avgWatchPretty(v)} <span className={s.popPct}>({avgWatchPercent(v)})</span>
                  </td>
                  <td className={s.right}>{formatNumberRu(v.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className={s.popularPdfFooter}>
          <button type="button" className={s.detailsBtn}>Подробнее</button>
        </div>
      </div>

      <div className={s.overviewSide}>
        {/* Side card per PDF 11: Текущая статистика */}
        <Card padding="lg" depth="md" className={s.sidePdfCard}>
          <div className={s.sidePdfTitle}>Текущая статистика</div>
          <RealtimeIndicator />

          <div className={s.sidePdfBigStat}>
            <AnimatedCounter
              value={(channel?.subscriberCount || 0) + realtimeFeed.subDelta}
              format={(n) => formatNumberRu(n)}
            />
          </div>
          <div className={s.sidePdfStatLabel}>Подписчики</div>
          <button type="button" className={s.sidePdfDetailsBtn}>Подробнее</button>

          <div className={s.sidePdfDivider} />

          <div className={s.sidePdfBigStat}>
            <AnimatedCounter value={realtime.totalLastHour || liveViews} format={(n) => formatNumberRu(n)} />
          </div>
          <div className={s.sidePdfStatLabel}>Просмотры · Последние 48 часов</div>
          <div className={s.sidePdfRealtimeChart}>
            <RealtimeMiniChart bars={realtimeFeed.bars} color={CHART_COLORS.primary} height={60} animationDuration={FAST_CHART_ANIMATION_SECONDS} />
          </div>
          <div className={s.sidePdfNowLabel}>Сейчас</div>

          <div className={s.sidePdfDivider} />

          <div className={s.sidePdfMiniHead}>
            <span>Самый популярный контент</span>
            <span className={s.sidePdfMiniHeadRight}>Просмотры</span>
          </div>
          {overview.topVideos[0] ? (
            <div className={s.sidePdfPopularRow}>
              <div className={s.sidePdfMiniThumb}>
                {overview.topVideos[0].cover ? <img src={overview.topVideos[0].cover} alt=""/> : <div className={s.thumbBlank}/>}
              </div>
              <div className={s.sidePdfMiniName} title={overview.topVideos[0].title}>{overview.topVideos[0].title}</div>
              <div className={s.sidePdfMiniValue}>{formatCompactNumber(overview.topVideos[0].views)}</div>
            </div>
          ) : null}
          <button type="button" className={s.sidePdfDetailsBtn}>Подробнее</button>
        </Card>

        {/* "Новый контент" card per PDF 11 */}
        {newestVideo ? (
          <Card padding="md" depth="md" className={s.sidePdfCard}>
            <div className={s.sidePdfTitle}>Новый контент</div>
            <div className={s.newestPdfCover}>
              {newestVideo.cover
                ? <img src={newestVideo.cover} alt=""/>
                : <div className={s.thumbBlank}/>}
              <span className={s.newestPdfDuration}>{newestVideo.duration}</span>
              <div className={s.newestPdfTitleOverlay}>{newestVideo.title}</div>
            </div>
            <div className={s.newestPdfMeta}>{daysSinceLong(newestVideo.date)}</div>
            <div className={s.newestPdfMetric}>
              <span>Просмотры</span>
              <span className={s.newestPdfMetricVal}>{formatNumberRu(newestVideo.views)}</span>
            </div>
            <div className={s.newestPdfMetric}>
              <span>CTR для значков видео</span>
              <span className={s.newestPdfMetricVal}>{ctrPretty(newestVideo)}</span>
            </div>
            <div className={s.newestPdfMetric}>
              <span>Средняя продолжительность просмотра</span>
              <span className={s.newestPdfMetricVal}>{avgWatchPretty(newestVideo)}</span>
            </div>
            <button type="button" className={s.newestPdfPrimary} onClick={onOpenAdmin}>
              Посмотреть аналитику для видео
            </button>
            {newestPool.length > 1 ? (
              <div className={s.newestPdfPager}>
                <button
                  type="button"
                  className={s.newestPdfPagerBtn}
                  onClick={() => setNewestIdx((i) => (i - 1 + newestPool.length) % newestPool.length)}
                  aria-label="Предыдущее"
                ><ChevronLeft size={16}/></button>
                <span>{newestIdx + 1} из {newestPool.length}</span>
                <button
                  type="button"
                  className={s.newestPdfPagerBtn}
                  onClick={() => setNewestIdx((i) => (i + 1) % newestPool.length)}
                  aria-label="Следующее"
                ><ChevronRight size={16}/></button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  )
}

/* helpers */
function declViews(n) {
  const v = Math.round(Number(n) || 0)
  const last2 = v % 100
  const last1 = v % 10
  if (last2 >= 11 && last2 <= 14) return ' просмотров'
  if (last1 === 1) return ' просмотр'
  if (last1 >= 2 && last1 <= 4) return ' просмотра'
  return ' просмотров'
}
function durationToSec(d) {
  if (!d) return 0
  const parts = String(d).split(':').map((x) => parseInt(x, 10) || 0)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parseInt(d, 10) || 0
}
function avgWatchPretty(v) {
  const sec = Math.round(durationToSec(v.duration) * 0.45)
  return formatSecondsAsClock(sec)
}
function avgWatchPercent() {
  return formatPercent(45, 1)
}
function ctrPretty(v) {
  const seed = (v.views || 0) % 100
  return formatPercent(8 + (seed % 8), 1)
}
function daysSinceLong(iso) {
  if (!iso) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  if (days === 0) return 'Опубликовано сегодня'
  const last2 = days % 100
  const last1 = days % 10
  if (last2 >= 11 && last2 <= 14) return `${days} дней после публикации`
  if (last1 === 1) return `${days} день после публикации`
  if (last1 >= 2 && last1 <= 4) return `${days} дня после публикации`
  return `${days} дней после публикации`
}
