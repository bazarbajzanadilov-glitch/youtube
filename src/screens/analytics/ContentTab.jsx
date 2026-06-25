import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import {
  formatCompactNumber,
  formatNumberRu,
  formatPercent,
  formatSecondsAsClock,
} from '../../lib/analyticsFormat.js'
import s from './AnalyticsTabs.module.css'
import {
  avgWatchPretty,
  buildPublishedVideoMarkers,
  ctrPretty,
  kpiTrend,
  usualComparison,
  videoDate,
} from './studioAnalyticsHelpers.js'
import { KpiDownCircleIcon, KpiUpCircleIcon } from '../icons.jsx'

const TYPE_FILTERS = ['Все', 'Shorts', 'Прямой эфир']
const TRAFFIC_TABS = ['Общие', 'Внешние источники', 'Поиск на YouTube', 'Рекомендуемые видео', 'Плейлисты']
const TYPE_KEYS = ['all', 'short', 'live']
const CONTENT_CHART_COLOR = '#8e8cff'

function normalizeVideoType(video) {
  if (['video', 'short', 'live'].includes(video?.type)) return video.type
  const title = String(video?.title || '').toLowerCase()
  if (title.includes('прямой эфир') || title.includes('live stream')) return 'live'
  const parts = String(video?.duration || '0:00').split(':').map((part) => parseInt(part, 10) || 0)
  const seconds = parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : (parts[0] || 0) * 60 + (parts[1] || 0)
  if (seconds <= 60) return 'short'
  return 'video'
}

function averageDurationByViews(videos) {
  const totalViews = videos.reduce((sum, video) => sum + (Number(video.views) || 0), 0)
  if (totalViews <= 0) return 0
  const totalSeconds = videos.reduce((sum, video) => {
    const parts = String(video.duration || '0:00').split(':').map((part) => parseInt(part, 10) || 0)
    const seconds = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : (parts[0] || 0) * 60 + (parts[1] || 0)
    return sum + (Number(video.views) || 0) * seconds * 0.45
  }, 0)
  return totalSeconds / totalViews
}

function KpiCell({ label, value, note, active = false, trend = 'neutral' }) {
  const showTrend = trend === 'up' || trend === 'down'

  return (
    <div className={`${s.ytKpiCell} ${active ? s.ytKpiCellActive : ''}`}>
      <div className={s.ytKpiLabel}>{label}</div>
      <div className={s.ytKpiValue}>
        {value}
        {showTrend ? (
          <span className={`${s.trendMark} ${trend === 'up' ? s.trendUp : s.trendDown}`}>
            {trend === 'up'
              ? <KpiUpCircleIcon size={18} color="#2ba640" />
              : <KpiDownCircleIcon size={18} color="#909090" />}
          </span>
        ) : null}
      </div>
      <div className={s.ytKpiNote}>{note}</div>
    </div>
  )
}

export default function ContentTab({ data, onOpenAdmin }) {
  const { content, range } = data
  const [trafficTab, setTrafficTab] = useState(0)
  const [activeType, setActiveType] = useState(null)
  const defaultTypeIndex = 0
  const selectedType = activeType ?? defaultTypeIndex
  const typeKey = TYPE_KEYS[selectedType]
  const filteredVideos = useMemo(() => (
    (content.allVideos || []).filter((video) => (
      typeKey === 'all' || normalizeVideoType(video) === typeKey
    ))
  ), [content.allVideos, typeKey])
  const filteredTopVideos = useMemo(() => (
    [...filteredVideos].sort((a, b) => (b.views || 0) - (a.views || 0))
  ), [filteredVideos])
  const filteredSeries = typeKey === 'all'
    ? content.series
    : (content.seriesByType?.[typeKey] || [])
  const publishedMarkers = buildPublishedVideoMarkers(filteredSeries, filteredVideos, 'date')
  const filteredViews = filteredVideos.reduce((sum, video) => sum + (Number(video.views) || 0), 0)
  const fallbackCtr = content.kpis.ctr.value / 100
  const filteredImpressions = filteredViews > 0 ? Math.round(filteredViews / Math.max(0.04, fallbackCtr)) : 0
  const filteredCtr = filteredImpressions > 0 ? (filteredViews / filteredImpressions) * 100 : content.kpis.ctr.value
  const filteredAvgDuration = averageDurationByViews(filteredVideos)
  const trafficTitle = typeKey === 'live'
    ? 'Как зрители находят ваши прямые трансляции'
    : typeKey === 'short'
      ? 'Как зрители находят ваши Shorts'
      : 'Как зрители находят ваш контент'
  const bestTitle = typeKey === 'live'
    ? 'Лучшие трансляции'
    : typeKey === 'short'
      ? 'Лучшие Shorts'
      : 'Самый популярный контент'
  const trafficTotal = content.traffic.reduce((sum, item) => sum + item.share, 0) || 1

  if ((content.topVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных по контенту"
        description="Добавьте видео в админке — здесь появятся источники трафика, CTR и лучшие ролики."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку</button>}
      />
    )
  }

  return (
    <div className={`${s.tabStack} ${s.contentTabStack}`}>
      <div className={s.filterChips}>
        {TYPE_FILTERS.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`${s.filterChip} ${selectedType === index ? s.filterChipActive : ''}`}
                onClick={() => setActiveType(index)}
              >
                {item}
          </button>
        ))}
      </div>

      <Card padding="none" depth="lg" className={s.ytHeroCard}>
        <div className={s.ytKpiStrip}>
          <KpiCell
            label="Просмотры"
            value={formatCompactNumber(filteredViews)}
            note={typeKey === 'all' ? usualComparison(content.kpis.views, formatCompactNumber) : 'Обычное значение'}
            trend={typeKey === 'all' ? kpiTrend(content.kpis.views.delta) : 'neutral'}
            active
          />
          <KpiCell
            label="Показы"
            value={formatCompactNumber(filteredImpressions)}
            note={typeKey === 'all' ? usualComparison(content.kpis.impressions, formatCompactNumber) : 'Обычное значение'}
            trend={typeKey === 'all' ? kpiTrend(content.kpis.impressions.delta) : 'neutral'}
          />
          <KpiCell
            label="CTR для значков видео"
            value={formatPercent(filteredCtr, 1)}
            note="Обычное значение"
          />
          <KpiCell
            label="Средняя продолжительность просмотра"
            value={formatSecondsAsClock(filteredAvgDuration)}
            note="Обычное значение"
          />
        </div>
        <div className={s.ytHeroChart}>
          <AreaLineChart
            data={filteredSeries}
            dataKey="views"
            xKey="date"
            color={CONTENT_CHART_COLOR}
            fillColor={CONTENT_CHART_COLOR}
            height={174}
            name="Просмотры"
            formatY={formatCompactNumber}
            formatTooltipValue={formatNumberRu}
            yAxisOrientation="right"
            fillTopOpacity={0.1}
            fillBottomOpacity={0}
            eventMarkers={publishedMarkers}
          />
        </div>
        <div className={s.ytHeroFooter}>
          <button type="button" className={s.ytPillBtn}>Подробнее</button>
        </div>
      </Card>

      <div className={s.twoColumnGrid}>
        <Card padding="lg" depth="md" className={s.blockCard}>
          <div className={s.cardTitle}>{trafficTitle}</div>
          <div className={s.cardSub}>Количество просмотров · {range.label}</div>
          <div className={s.innerTabs}>
            {TRAFFIC_TABS.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`${s.innerTab} ${trafficTab === index ? s.innerTabActive : ''}`}
                onClick={() => setTrafficTab(index)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={s.trafficRows}>
            {content.traffic.slice(0, 7).map((row) => {
              const percent = (row.share / trafficTotal) * 100
              return (
                <div className={s.trafficRow} key={row.key}>
                  <span>{row.label}</span>
                  <div><span style={{ width: `${percent}%` }} /></div>
                  <strong>{formatPercent(percent, 1)}</strong>
                </div>
              )
            })}
          </div>
          <button type="button" className={s.ytTextBtn}>Подробнее</button>
        </Card>

        <div className={s.sideStack}>
          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>{bestTitle}</div>
            <div className={s.cardSub}>Просмотры · {range.label}</div>
            {filteredTopVideos.length > 0 ? (
              <div className={s.compactVideoList}>
                {filteredTopVideos.slice(0, 5).map((video) => (
                  <div className={s.compactVideoRow} key={video.id}>
                    <div className={s.sideThumb}>
                      {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                    </div>
                    <div className={s.videoMeta}>
                      <div className={s.videoTitle}>{video.title}</div>
                      <div className={s.videoSub}>{videoDate(video)}</div>
                    </div>
                    <strong>{formatCompactNumber(video.views)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.emptyBlock}>Нет данных для выбранного типа контента.</div>
            )}
            <button type="button" className={s.ytTextBtn}>Подробнее</button>
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Одновременные просмотры</div>
            <div className={s.cardSub}>Прямые трансляции · {range.label}</div>
            <div className={s.emptyBlock}>Недостаточно данных за выбранный период.</div>
          </Card>
        </div>
      </div>

      <Card padding="none" depth="md" className={s.tableCard}>
        <div className={s.tableHeader}>
          <div>
            <div className={s.cardTitle}>Самый популярный контент</div>
            <div className={s.cardSub}>Видео и трансляции · {range.label}</div>
          </div>
        </div>
        <table className={s.ytTable}>
          <thead>
            <tr>
              <th>Контент</th>
              <th>CTR для значков видео</th>
              <th>Средняя продолжительность просмотра</th>
              <th className={s.right}>Просмотры</th>
            </tr>
          </thead>
          <tbody>
            {filteredTopVideos.map((video, index) => (
              <tr key={video.id}>
                <td>
                  <div className={s.videoCell}>
                    <span className={s.rank}>{index + 1}</span>
                    <div className={s.videoThumb}>
                      {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                    </div>
                    <div className={s.videoMeta}>
                      <div className={s.videoTitle}>{video.title}</div>
                      <div className={s.videoSub}>{videoDate(video)}</div>
                    </div>
                  </div>
                </td>
                <td>{ctrPretty(video)}</td>
                <td>{avgWatchPretty(video)}</td>
                <td className={s.right}>{formatNumberRu(video.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
