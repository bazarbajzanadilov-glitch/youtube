import { useMemo, useState } from 'react'
import s from './TypicalDiffEditor.module.css'
import v from './AdminVisual.module.css'
import { DiffControl, InlineNumber, SaveStatus } from './InlineEdit.jsx'
import { useAutoSavedDraft } from './useAutoSavedDraft.js'
import { declineTimes, formatCompactOneDecimal, formatNumberRu } from '../../lib/analyticsFormat.js'
import { buildVideoPerformanceView, resolveSectionVideo, videoAnalyticsRoute } from '../../lib/videoPerformanceSection.js'
import { HelpIcon, SparkleIcon } from '../icons.jsx'

const METRICS = [
  { key: 'views', label: 'Просмотры', diffKey: 'viewsDiff', valueKey: 'views', autoKey: 'views', decimals: 0 },
  { key: 'watch', label: 'Время просмотра (часы)', diffKey: 'watchHoursDiff', valueKey: 'watchHours', autoKey: 'watchHours', decimals: 1 },
]

const VIDEO_FIELDS = [
  { key: 'views', label: 'Просмотры', decimals: 0, format: (value) => value.toLocaleString('ru-RU') },
  { key: 'likes', label: 'Лайки', decimals: 0, format: (value) => value.toLocaleString('ru-RU') },
  { key: 'dislikes', label: 'Дизлайки', decimals: 0, format: (value) => value.toLocaleString('ru-RU') },
  { key: 'revenue', label: 'Доход за видео ($)', decimals: 2, format: (value) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` },
  { key: 'averageViewPercentage', label: 'Средний % просмотра', decimals: 1, max: 100, format: (value) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %` },
]

/** Сами цифры видео: меняются кликом и сохраняются сразу в это видео. */
function VideoNumbers({ video, onUpdateVideo }) {
  const serverValue = useMemo(() => Object.fromEntries(
    VIDEO_FIELDS.map((field) => [field.key, Number(video[field.key]) || 0]),
  ), [video])
  const [draft, setDraft, status] = useAutoSavedDraft(serverValue, (value) => {
    const patch = Object.fromEntries(VIDEO_FIELDS
      .filter((field) => value[field.key] !== serverValue[field.key])
      .map((field) => [field.key, value[field.key]]))
    if ('views' in patch) patch.autoViews = false
    if ('revenue' in patch) patch.autoRevenue = false
    return onUpdateVideo(video.id, patch)
  })
  return (
    <div className={v.card}>
      <div className={s.numbersHead}>
        <span className={v.kpiLabel}>Цифры видео — видны в «Контенте», на Главной и в аналитике</span>
        <SaveStatus status={status} />
      </div>
      <div className={v.kpis}>
        {VIDEO_FIELDS.map((field) => (
          <div className={v.kpi} key={field.key}>
            <span className={v.kpiLabel}>{field.label}</span>
            <span className={s.numberValue}>
              <InlineNumber
                value={draft[field.key]}
                decimals={field.decimals}
                max={field.max}
                format={field.format}
                label={field.label}
                onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function round(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Кнопка верхней панели («?» для Shorts, «✦» для видео), которая открывает это видео. */
function PinButton({ video, videos, channel, onPin }) {
  const variant = video.type === 'short' ? 'shorts' : 'video'
  const pinned = resolveSectionVideo(variant, channel?.performanceSections, videos)?.id === video.id
  const Icon = variant === 'shorts' ? HelpIcon : SparkleIcon
  const mark = variant === 'shorts' ? '«?»' : '«✦»'
  return (
    <button
      type="button"
      className={`${s.pin} ${pinned ? s.pinOn : ''}`}
      aria-pressed={pinned}
      onClick={() => !pinned && onPin(variant, video.id)}
    >
      <Icon size={18} />
      {pinned ? `Открывается кнопкой ${mark}` : `Открывать кнопкой ${mark}`}
    </button>
  )
}

function VideoDiffEditor({ video, videos, channel, onSave, onOpen, onUpdateVideo, onPin }) {
  const view = useMemo(() => buildVideoPerformanceView(video, videos, channel), [video, videos, channel])
  const override = channel?.typicalOverrides?.[String(video.id)]
  const serverValue = useMemo(() => ({
    viewsDiff: override?.viewsDiff ?? null,
    watchHoursDiff: override?.watchHoursDiff ?? null,
  }), [override])
  const [draft, setDraft, status] = useAutoSavedDraft(serverValue, (value) => onSave(video.id, value))

  const autoDiff = (metric) => {
    const auto = view.autoTypical?.[metric.autoKey]
    return auto == null ? 0 : round(view.kpis[metric.valueKey] - auto, metric.decimals)
  }

  return (
    <div className={s.workArea}>
      <div className={v.bar}>
        <PinButton video={video} videos={videos} channel={channel} onPin={onPin} />
        <div className={v.barRight}>
          <SaveStatus status={status} />
          <button type="button" className={v.openLink} onClick={() => onOpen(videoAnalyticsRoute(video))}>Открыть страницу →</button>
        </div>
      </div>
      <VideoNumbers video={video} onUpdateVideo={onUpdateVideo} onPin={onPin} />
      <h3 className={v.headline}>
        С момента публикации это видео{video.type === 'short' ? ' Shorts' : ''} посмотрели {formatNumberRu(view.kpis.views)} {declineTimes(view.kpis.views)}
      </h3>
      <div className={`${v.card} ${s.cards}`}>
        <div className={v.kpis}>
          {METRICS.map((metric) => {
            const manual = draft[metric.diffKey]
            const diff = manual ?? autoDiff(metric)
            return (
              <div className={v.kpi} key={metric.key}>
                <span className={v.kpiLabel}>{metric.label}</span>
                <span className={v.kpiValue}>{formatCompactOneDecimal(view.kpis[metric.valueKey])}</span>
                <DiffControl
                  diff={diff}
                  decimals={metric.decimals}
                  format={formatCompactOneDecimal}
                  label={metric.label}
                  onChange={(next) => setDraft((current) => ({ ...current, [metric.diffKey]: next }))}
                />
                {manual == null ? (
                  <span className={s.autoNote}>считается автоматически</span>
                ) : (
                  <button type="button" className={s.resetBtn} onClick={() => setDraft((current) => ({ ...current, [metric.diffKey]: null }))}>
                    Вернуть автоматический расчёт
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Подпись «На 5,9 млн больше, чем обычно» на странице «Аналитика видео»:
 * слева выбираешь ролик, справа — сами карточки, которые меняются кликом.
 */
export default function TypicalDiffEditor({ videos, channel, onSave, onOpen, onUpdateVideo, onPin }) {
  const list = useMemo(() => [...videos].sort((a, b) => String(b.date).localeCompare(String(a.date))), [videos])
  const [selectedId, setSelectedId] = useState(() => list[0]?.id ?? null)
  const video = list.find((item) => item.id === selectedId) || list[0] || null

  if (!video) {
    return <div className={s.empty}>Добавьте видео, чтобы настроить подписи.</div>
  }

  return (
    <div className={s.editor} data-testid="typical-diff-editor">
      <div className={s.videoList} role="listbox" aria-label="Видео">
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={item.id === video.id}
            className={`${s.videoChip} ${item.id === video.id ? s.videoChipActive : ''}`}
            onClick={() => setSelectedId(item.id)}
          >
            {item.cover ? <img src={item.cover} alt="" /> : <span className={s.coverStub} />}
            <span className={s.videoChipText}>
              <span className={s.videoChipTitle}>{item.title}</span>
              <span className={s.videoChipMeta}>
                {item.type === 'short' ? 'Shorts' : 'Видео'}
                {resolveSectionVideo(item.type === 'short' ? 'shorts' : 'video', channel?.performanceSections, videos)?.id === item.id
                  ? (item.type === 'short' ? ' · кнопка «?»' : ' · кнопка «✦»')
                  : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
      <VideoDiffEditor key={video.id} video={video} videos={videos} channel={channel} onSave={onSave} onOpen={onOpen} onUpdateVideo={onUpdateVideo} onPin={onPin} />
    </div>
  )
}
