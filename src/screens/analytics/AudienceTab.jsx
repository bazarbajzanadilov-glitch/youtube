import { useMemo, useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import { analyticsAreaChartProps } from '../../components/charts/analyticsChartDefaults.js'
import Heatmap7x24 from '../../components/charts/Heatmap7x24.jsx'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.jsx'
import {
  formatCompactNumber,
  formatNumberRu,
  formatPercent,
} from '../../lib/analyticsFormat.js'
import s from './AnalyticsTabs.module.css'
import {
  ANALYTICS_PURPLE,
  absoluteUsualComparison,
  buildPublishedVideoMarkers,
  signedNumber,
  videoDate,
} from './studioAnalyticsHelpers.js'
import AnalyticsHeroCard from './AnalyticsHeroCard.jsx'
import MetricKpiCell from './MetricKpiCell.jsx'

const AUDIENCE_CHART_COLOR = ANALYTICS_PURPLE

export default function AudienceTab({ data, onOpenAdmin }) {
  const { audience, overview, content, range } = data
  const [metric, setMetric] = useState('viewers')
  const monthlyViewers = Math.max(0, Math.round((audience.kpis.uniqueViewers.value || 0) * 0.85))
  const topVideos = overview.topVideos || []
  const viewerSeries = useMemo(() => {
    const source = audience.newReturning?.length ? audience.newReturning : audience.subscribers
    if (!source.length) return []

    const values = source.map((row) => {
      const value = Number(row.new) + Number(row.returning)
      return Number.isFinite(value) && value > 0 ? value : 0
    })
    const total = values.reduce((sum, value) => sum + value, 0)

    let cumulative = 0
    return source.map((row, index) => {
      cumulative += values[index]
      const progress = total > 0
        ? cumulative / total
        : source.length > 1
          ? index / (source.length - 1)
          : 1

      return {
        date: row.date,
        viewers: Math.max(0, Math.round(monthlyViewers * progress)),
      }
    })
  }, [audience.newReturning, audience.subscribers, monthlyViewers])
  const chartByMetric = {
    viewers: {
      data: viewerSeries,
      dataKey: 'viewers',
      name: 'Зрителей в месяц',
    },
    subscribers: {
      data: audience.subscribers,
      dataKey: 'subscribers',
      name: 'Подписчики',
    },
  }
  const chart = chartByMetric[metric]
  const publishedMarkers = buildPublishedVideoMarkers(chart.data, content?.allVideos || [], 'date')
  const segments = [
    { label: 'Новые зрители', share: 0.918, color: 'rgba(188, 105, 243, 0.95)' },
    { label: 'Случайные зрители', share: 0.082, color: 'rgba(188, 105, 243, 0.62)' },
    { label: 'Постоянные зрители', share: 0.001, color: 'rgba(188, 105, 243, 0.34)' },
  ]
  const subscriptionStats = [
    { label: 'Без подписки', share: 0.999, color: AUDIENCE_CHART_COLOR },
    { label: 'С подпиской', share: 0.001, color: AUDIENCE_CHART_COLOR },
  ]
  const ageRows = audience.ageGender.ages.map((row) => ({ label: row.label, share: row.share, color: AUDIENCE_CHART_COLOR }))
  const genderRows = audience.ageGender.genders.map((row) => ({ label: row.label, share: row.share, color: AUDIENCE_CHART_COLOR }))
  const deviceRows = audience.devices.filter((row) => row.share > 0.001).map((row) => ({ label: row.label, share: row.share, color: AUDIENCE_CHART_COLOR }))
  const geoRows = audience.geography.slice(0, 5).map((row) => ({ label: row.label, share: row.share, color: AUDIENCE_CHART_COLOR }))
  const langRows = audience.languages.slice(0, 5).map((row) => ({ label: row.label, share: row.share, color: AUDIENCE_CHART_COLOR }))

  if (audience.kpis.subscribers.absolute === 0 && audience.subscribers.length === 0) {
    return (
      <EmptyState
        title="Аудитория ещё не сформирована"
        description="Добавьте видео и подписчиков в админке — здесь появится подробная разбивка."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку</button>}
      />
    )
  }

  return (
    <div className={`${s.tabStack} ${s.audienceTabStack}`}>
      <AnalyticsHeroCard
        className={s.audienceHeroCard}
        chart={(
          <AreaLineChart
            {...analyticsAreaChartProps()}
            data={chart.data}
            dataKey={chart.dataKey}
            xKey="date"
            color={AUDIENCE_CHART_COLOR}
            fillColor={AUDIENCE_CHART_COLOR}
            name={chart.name}
            formatY={formatCompactNumber}
            formatTooltipValue={formatNumberRu}
            eventMarkers={publishedMarkers}
          />
        )}
      >
        <div className={`${s.ytKpiStrip} ${s.ytKpiStripTwo}`}>
          <MetricKpiCell
            label="Зрителей в месяц"
            value={formatCompactNumber(monthlyViewers)}
            note="Обновляется каждый день"
            active={metric === 'viewers'}
            clock
            onClick={() => setMetric('viewers')}
          />
          <MetricKpiCell
            label="Подписчики"
            value={signedNumber(audience.kpis.subscribers.value)}
            note={absoluteUsualComparison(audience.kpis.subscribers.value, formatNumberRu)}
            trend={audience.kpis.subscribers.value > 0 ? 'up' : audience.kpis.subscribers.value < 0 ? 'down' : 'neutral'}
            active={metric === 'subscribers'}
            onClick={() => setMetric('subscribers')}
          />
        </div>
      </AnalyticsHeroCard>

      <div className={s.twoColumnGrid}>
        <div className={s.sideStack}>
          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Сегменты аудитории по просмотрам вашего контента</div>
            <div className={s.cardSub}>Зрителей в месяц · 14 июн. 2026 г.</div>
            <div className={s.segmentBar}>
              {segments.map((segment) => (
                <span key={segment.label} style={{ width: `${segment.share * 100}%`, background: segment.color }} />
              ))}
            </div>
            <div className={s.segmentRows}>
              {segments.map((segment) => (
                <div key={segment.label}>
                  <span><i style={{ background: segment.color }} />{segment.label}</span>
                  <strong>{segment.share < 0.01 ? '< 0,1 %' : formatPercent(segment.share * 100, 1)}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Видео, благодаря которым растет ваша аудитория</div>
            <div className={s.cardSub}>Новые зрители · {range.label}</div>
            <div className={s.compactVideoList}>
              {topVideos.slice(0, 5).map((video) => (
                <div className={s.compactVideoRow} key={video.id}>
                  <div className={s.sideThumb}>
                    {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                  </div>
                  <div className={s.videoMeta}>
                    <div className={s.videoTitle}>{video.title}</div>
                    <div className={s.videoSub}>{videoDate(video)}</div>
                  </div>
                  <strong>{formatCompactNumber(Math.round(video.views * 0.62))}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Когда ваши зрители смотрят видео на YouTube</div>
            <div className={s.cardSub}>Местное время (GMT +0500) · {range.label}</div>
            <Heatmap7x24 matrix={audience.heatmap} />
            <div className={s.cardNote}>Эффективность видео в долгосрочной перспективе не зависит от времени публикации.</div>
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Значок колокольчика и уведомления о канале</div>
            <div className={s.cardSub}>Подписчики, включившие все уведомления</div>
            <div className={s.emptyBlock}>Недостаточно данных для сравнения с типичным каналом.</div>
          </Card>
        </div>

        <div className={s.sideStack}>
          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Популярно у разных аудиторий</div>
            <div className={s.cardSub}>Просмотры · {range.label}</div>
            <div className={s.innerTabs}>
              {['Новые', 'Случайные', 'Постоянные'].map((tab, index) => (
                <button key={tab} type="button" className={`${s.innerTab} ${index === 0 ? s.innerTabActive : ''}`}>{tab}</button>
              ))}
            </div>
            <div className={s.compactVideoList}>
              {topVideos.slice(0, 4).map((video) => (
                <div className={s.compactVideoRow} key={video.id}>
                  <div className={s.sideThumb}>
                    {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                  </div>
                  <div className={s.videoMeta}>
                    <div className={s.videoTitle}>{video.title}</div>
                    <div className={s.videoSub}>{formatCompactNumber(video.views)} просмотров</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Время просмотра подписчиками</div>
            <div className={s.cardSub}>Время просмотра · {range.label}</div>
            <HorizontalBarChart data={subscriptionStats} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Возраст и пол</div>
            <div className={s.cardSub}>Просмотры · {range.label}</div>
            <HorizontalBarChart data={genderRows} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
            <div className={s.softDivider} />
            <HorizontalBarChart data={ageRows} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Какие форматы выбирают ваши зрители на YouTube</div>
            <div className={s.cardSub}>{range.label}</div>
            {audience.formatShares.map((format) => (
              <div className={s.formatRow} key={format.key}>
                <span>{format.label}</span>
                <div><i style={{ width: `${Math.max(4, format.score * 100)}%` }} /></div>
                <small><span>Никто не смотрит</span><span>Смотрят все</span></small>
              </div>
            ))}
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Тип устройства</div>
            <div className={s.cardSub}>Время просмотра (часы) · {range.label}</div>
            <HorizontalBarChart data={deviceRows} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Топ регионов</div>
            <div className={s.cardSub}>Просмотры · {range.label}</div>
            <HorizontalBarChart data={geoRows} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>

          <Card padding="lg" depth="md" className={s.blockCard}>
            <div className={s.cardTitle}>Самые популярные языки субтитров</div>
            <div className={s.cardSub}>Просмотры · {range.label}</div>
            <HorizontalBarChart data={langRows} defaultColor={AUDIENCE_CHART_COLOR} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>
        </div>
      </div>
    </div>
  )
}
