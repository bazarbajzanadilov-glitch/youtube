import { useState } from 'react'
import l from './VideoLibraryVisual.module.css'
import { InlineNumber, InlineText } from './InlineEdit.jsx'
import { TrashIcon } from './AdminIcons.jsx'
import { EditIcon, ThumbDownIcon, ThumbUpIcon } from '../icons.jsx'
import { formatDateLong } from '../../lib/analyticsFormat.js'
import { getAlmatyDateISO } from '../../lib/almatyDate.js'
import { normalizeAverageViewPercentage } from '../../lib/videoMetrics.js'

const TYPES = [
  { value: 'video', label: 'Видео' },
  { value: 'short', label: 'Shorts' },
]

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 16q1.875 0 3.188-1.312Q16.5 13.375 16.5 11.5q0-1.875-1.312-3.188Q13.875 7 12 7q-1.875 0-3.188 1.312Q7.5 9.625 7.5 11.5q0 1.875 1.312 3.188Q10.125 16 12 16Zm0-1.8q-1.125 0-1.912-.788Q9.3 12.625 9.3 11.5t.788-1.913Q10.875 8.8 12 8.8t1.913.787q.787.788.787 1.913t-.787 1.912q-.788.788-1.913.788Zm0 4.8q-3.65 0-6.65-2.038-3-2.037-4.35-5.462 1.35-3.425 4.35-5.463Q8.35 4 12 4q3.65 0 6.65 2.037 3 2.038 4.35 5.463-1.35 3.425-4.35 5.462Q15.65 19 12 19Z" />
  </svg>
)

const count = (value) => (Number(value) || 0).toLocaleString('ru-RU')

/**
 * Список видео как в «Контенте»: название, дата, формат и цифры меняются
 * кликом и сразу сохраняются в видео.
 */
export default function VideoLibraryVisual({ videos, selected, allSelected, onToggle, onToggleAll, onUpdate: saveVideo, onOpen, onDelete }) {
  // Правка видна сразу, не дожидаясь ответа сервера (сохранение идёт в фоне).
  const [pending, setPending] = useState({})
  const onUpdate = (video, patch) => {
    setPending((current) => ({ ...current, [video.id]: { ...current[video.id], ...patch } }))
    Promise.resolve(saveVideo(video, patch)).finally(() => {
      setPending((current) => {
        const rest = { ...current[video.id] }
        Object.keys(patch).forEach((key) => { if (rest[key] === patch[key]) delete rest[key] })
        const next = { ...current }
        if (Object.keys(rest).length) next[video.id] = rest
        else delete next[video.id]
        return next
      })
    })
  }
  return (
    <div className={l.list}>
      <div className={`${l.row} ${l.head}`}>
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Выбрать все" />
        <span>Видео</span>
        <span>Дата и формат</span>
        <span>Просмотры</span>
        <span>Оценки</span>
        <span>Доход</span>
        <span>Досмотр</span>
        <span />
      </div>
      {videos.map((stored) => ({ ...stored, ...pending[stored.id] })).map((video) => (
        <div className={l.row} key={video.id}>
          <input type="checkbox" checked={selected.has(video.id)} onChange={() => onToggle(video.id)} aria-label={`Выбрать ${video.title}`} />

          <div className={l.video}>
            <div className={l.thumb}>
              {video.cover ? <img src={video.cover} alt="" /> : null}
              <InlineText
                className={l.duration}
                value={video.duration || ''}
                label="Длительность"
                onCommit={(duration) => onUpdate(video, { duration })}
              />
            </div>
            <InlineText
              className={l.title}
              value={video.title || ''}
              label="Название"
              onCommit={(title) => onUpdate(video, { title })}
            />
          </div>

          <div className={l.cell}>
            <label className={l.date}>
              {formatDateLong(video.date)}
              <input
                type="date"
                max={getAlmatyDateISO()}
                value={video.date}
                onChange={(event) => event.target.value && onUpdate(video, { date: event.target.value })}
                aria-label="Дата публикации"
              />
            </label>
            <div className={l.types}>
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`${l.type} ${(video.type || 'video') === type.value ? l.typeActive : ''}`}
                  aria-pressed={(video.type || 'video') === type.value}
                  onClick={() => onUpdate(video, { type: type.value })}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className={l.cell}>
            <span className={l.stat}>
              <EyeIcon />
              <InlineNumber value={Number(video.views) || 0} format={count} label="Просмотры" onChange={(views) => onUpdate(video, { views, autoViews: false })} />
            </span>
          </div>

          <div className={l.cell}>
            <span className={l.stat}>
              <ThumbUpIcon size={14} />
              <InlineNumber value={Number(video.likes) || 0} format={count} label="Лайки" onChange={(likes) => onUpdate(video, { likes })} />
            </span>
            <span className={l.stat}>
              <ThumbDownIcon size={14} />
              <InlineNumber value={Number(video.dislikes) || 0} format={count} label="Дизлайки" onChange={(dislikes) => onUpdate(video, { dislikes })} />
            </span>
          </div>

          <div className={l.cell}>
            <span className={l.stat}>
              <InlineNumber
                value={Number(video.revenue) || 0}
                decimals={2}
                format={(value) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`}
                label="Доход"
                onChange={(revenue) => onUpdate(video, { revenue, autoRevenue: false })}
              />
            </span>
          </div>

          <div className={l.cell}>
            <span className={l.stat}>
              <InlineNumber
                value={normalizeAverageViewPercentage(video.averageViewPercentage)}
                decimals={1}
                max={100}
                format={(value) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`}
                label="Средний процент просмотра"
                onChange={(averageViewPercentage) => onUpdate(video, { averageViewPercentage })}
              />
            </span>
          </div>

          <div className={l.actions}>
            <button type="button" className={l.iconBtn} onClick={() => onOpen(video)} title="Все настройки и обложка" aria-label="Открыть видео">
              <EditIcon size={18} />
            </button>
            <button type="button" className={`${l.iconBtn} ${l.danger}`} onClick={() => onDelete(video.id)} title="Удалить видео" aria-label="Удалить видео">
              <TrashIcon size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
