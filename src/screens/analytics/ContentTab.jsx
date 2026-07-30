import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { analyticsHeroChartProps } from '../../components/charts/analyticsChartDefaults.js'
import {
  formatCompactNumber,
  formatNumberRu,
  formatPercent,
  formatSignedCompactNumber,
} from '../../lib/analyticsFormat.js'
import s from './AnalyticsTabs.module.css'
import {
  avgWatchPretty,
  buildPublishedVideoMarkers,
  ctrPretty,
  KPI_DESCRIPTIONS,
  kpiTrend,
  metricPerformanceComparison,
  previousPeriodComparison,
  videoDate,
} from './studioAnalyticsHelpers.js'
import AnalyticsHeroCard from './AnalyticsHeroCard.jsx'
import MetricKpiCell from './MetricKpiCell.jsx'

const TYPE_FILTERS = ['Все', 'Видео', 'Shorts', 'Прямой эфир', 'Записи']
const TRAFFIC_TABS = ['Общие', 'Внешние источники', 'Поиск на YouTube', 'Рекомендуемые видео', 'Плейлисты']
const TYPE_KEYS = ['all', 'video', 'short', 'live', 'post']
const TRAFFIC_KEYS_BY_TAB = [
  null,
  ['external'],
  ['search'],
  ['suggested'],
  ['playlists'],
]
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

export default function ContentTab({ data, onOpenAdmin }) {
  const { content, range } = data
  const [trafficTab, setTrafficTab] = useState(0)
  const [activeType, setActiveType] = useState(null)
  const [metric, setMetric] = useState('views')
  const defaultTypeIndex = 0
  const selectedType = activeType ?? defaultTypeIndex
  const typeKey = TYPE_KEYS[selectedType]
  const filteredVideos = useMemo(() => (
    (content.allVideos || []).filter((video) => (
      typeKey === 'all' || normalizeVideoType(video) === typeKey
    ))
  ), [content.allVideos, typeKey])
  const filteredTopVideos = useMemo(() => (
    [...filteredVideos]
      .filter((video) => (video.periodViews || 0) > 0)
      .sort((a, b) => (b.periodViews || 0) - (a.periodViews || 0))
  ), [filteredVideos])
  const filteredSeries = typeKey === 'all'
    ? (content.metricSeries || content.series)
    : (content.metricSeriesByType?.[typeKey] || content.seriesByType?.[typeKey] || [])
  const selectedKpis = typeKey === 'all'
    ? content.kpis
    : (content.kpisByType?.[typeKey] || {})
  const publishedMarkers = buildPublishedVideoMarkers(
    filteredSeries,
    filteredVideos,
    'date',
    range,
  )
  const filteredSubscriberSeries = typeKey === 'all'
    ? (content.subscribers || [])
    : (content.subscribersByType?.[typeKey] || [])
  const chartByMetric = {
    views: {
      dataKey: 'views',
      name: 'Просмотры',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
    },
    engagedViews: {
      dataKey: 'engagedViews',
      name: 'Заинтересованные просмотры',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
    },
    likes: {
      dataKey: 'likes',
      name: 'Отметки "Нравится"',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
    },
    subscribers: {
      dataKey: 'subscribers',
      name: 'Подписчики',
      formatY: formatCompactNumber,
      formatTooltipValue: formatNumberRu,
    },
  }
  const chart = chartByMetric[metric]
  const chartData = metric === 'subscribers'
    ? filteredSubscriberSeries
    : filteredSeries
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
  const selectedTraffic = typeKey === 'all'
    ? content.traffic
    : (content.trafficByType?.[typeKey] || [])
  const trafficTotal = selectedTraffic.reduce((sum, item) => sum + item.share, 0) || 1
  const activeTrafficKeys = TRAFFIC_KEYS_BY_TAB[trafficTab]
  const visibleTraffic = activeTrafficKeys
    ? selectedTraffic.filter((item) => activeTrafficKeys.includes(item.key))
    : selectedTraffic

  if ((content.allVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных по контенту"
        description="Добавьте видео в админке — здесь появятся просмотры, реакции и лучшие ролики."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку</button>}
      />
    )
  }
  if ((content.kpis?.views?.value || 0) === 0) {
    return (
      <EmptyState
        title="За выбранный период нет данных"
        description="Выберите другой период, чтобы увидеть просмотры, источники трафика и лучшие ролики."
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

      <AnalyticsHeroCard
        chart={(
          <AreaLineChart
            {...analyticsHeroChartProps(s, { color: CONTENT_CHART_COLOR })}
            data={chartData}
            dataKey={chart.dataKey}
            xKey="date"
            color={CONTENT_CHART_COLOR}
            fillColor={CONTENT_CHART_COLOR}
            name={chart.name}
            formatY={chart.formatY}
            formatTooltipValue={chart.formatTooltipValue}
            eventMarkers={publishedMarkers}
          />
        )}
      >
        <div className={s.ytKpiStrip}>
          <MetricKpiCell
            label="Просмотры"
            value={formatSignedCompactNumber(selectedKpis.views?.value || 0)}
            note={metricPerformanceComparison(selectedKpis.views, range, formatCompactNumber)}
            description={KPI_DESCRIPTIONS.views}
            trend={kpiTrend(selectedKpis.views?.delta)}
            active={metric === 'views'}
            accentColor={CONTENT_CHART_COLOR}
            onClick={() => setMetric('views')}
          />
          <MetricKpiCell
            label="Заинтересованные просмотры"
            value={formatSignedCompactNumber(selectedKpis.engagedViews?.value || 0)}
            note={previousPeriodComparison(selectedKpis.engagedViews, range)}
            description={KPI_DESCRIPTIONS.engagedViews}
            trend={kpiTrend(selectedKpis.engagedViews?.delta)}
            active={metric === 'engagedViews'}
            accentColor={CONTENT_CHART_COLOR}
            onClick={() => setMetric('engagedViews')}
          />
          <MetricKpiCell
            label={'Отметки "Нравится"'}
            value={formatCompactNumber(selectedKpis.likes?.value || 0)}
            note={previousPeriodComparison(selectedKpis.likes, range)}
            description={KPI_DESCRIPTIONS.likes}
            trend={kpiTrend(selectedKpis.likes?.delta)}
            active={metric === 'likes'}
            accentColor={CONTENT_CHART_COLOR}
            onClick={() => setMetric('likes')}
          />
          <MetricKpiCell
            label="Подписчики"
            value={formatSignedCompactNumber(selectedKpis.subscribers?.value || 0)}
            note={metricPerformanceComparison(selectedKpis.subscribers, range, formatCompactNumber)}
            description={KPI_DESCRIPTIONS.subscribers}
            trend={kpiTrend(selectedKpis.subscribers?.delta)}
            active={metric === 'subscribers'}
            accentColor={CONTENT_CHART_COLOR}
            onClick={() => setMetric('subscribers')}
          />
        </div>
      </AnalyticsHeroCard>

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
            {visibleTraffic.slice(0, 7).map((row) => {
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
                    <strong>{formatCompactNumber(video.periodViews)}</strong>
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
                <td className={s.right}>{formatNumberRu(video.periodViews)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
