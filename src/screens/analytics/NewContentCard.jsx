import { useState } from 'react'
import Card from '../../components/ui/Card.jsx'
import { formatCompactNumber } from '../../lib/analyticsFormat.js'
import { ChevronLeft, ChevronRight } from '../icons.jsx'
import s from './AnalyticsTabs.module.css'
import {
  avgWatchPercent,
  daysSinceLong,
} from './studioAnalyticsHelpers.js'

export default function NewContentCard({ videos, onOpenVideoAnalytics }) {
  const [requestedIndex, setRequestedIndex] = useState(0)
  const lastIndex = Math.max(0, videos.length - 1)
  const currentIndex = Math.min(requestedIndex, lastIndex)
  const video = videos[currentIndex]

  if (!video) return null

  const metrics = [
    {
      label: 'Просмотры',
      value: formatCompactNumber(video.views || 0),
    },
    {
      label: 'Средний процент просмотра',
      value: avgWatchPercent(video).replace('%', '\u00a0%'),
    },
    {
      label: 'Отметки "Нравится"',
      value: formatCompactNumber(video.likes || 0),
    },
  ]

  return (
    <Card padding="md" depth="md" className={`${s.sideCard} ${s.newVideoCard} ${s.overviewNewVideoCard}`}>
      <div className={s.sideTitle}>Новый контент</div>
      <div
        key={video.id || currentIndex}
        className={s.newVideoSlide}
        role="group"
        aria-roledescription="слайд"
        aria-label={`${currentIndex + 1} из ${videos.length}`}
        aria-live="polite"
      >
        <div className={s.newVideoCover}>
          {video.cover ? (
            <img src={video.cover} alt={`Обложка видео «${video.title}»`} />
          ) : (
            <div className={s.thumbBlank} />
          )}
          <div className={s.newVideoOverlay}>
            <div className={s.newVideoOverlayTitle}>{video.title}</div>
          </div>
        </div>
        <div className={s.sideLabel}>{daysSinceLong(video.date)}</div>
        <div className={s.newMetricList}>
          {metrics.map((item) => (
            <div className={s.newMetricRow} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <button type="button" className={s.ytWideBtn} onClick={onOpenVideoAnalytics}>
          Посмотреть аналитику для видео
        </button>
      </div>
      <div className={s.pager} aria-label="Переключение нового контента">
        <button
          type="button"
          onClick={() => setRequestedIndex(Math.max(0, currentIndex - 1))}
          aria-label="Предыдущее"
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={30} />
        </button>
        <span aria-live="polite">{currentIndex + 1} из {videos.length}</span>
        <button
          type="button"
          onClick={() => setRequestedIndex(Math.min(lastIndex, currentIndex + 1))}
          aria-label="Следующее"
          disabled={currentIndex === lastIndex}
        >
          <ChevronRight size={30} />
        </button>
      </div>
    </Card>
  )
}
