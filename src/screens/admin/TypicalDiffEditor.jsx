import { useMemo, useState } from 'react'
import s from './TypicalDiffEditor.module.css'
import v from './AdminVisual.module.css'
import { DiffControl, SaveStatus } from './InlineEdit.jsx'
import { useAutoSavedDraft } from './useAutoSavedDraft.js'
import { declineTimes, formatCompactOneDecimal, formatNumberRu } from '../../lib/analyticsFormat.js'
import { buildVideoPerformanceView, videoAnalyticsRoute } from '../../lib/videoPerformanceSection.js'

const METRICS = [
  { key: 'views', label: 'Просмотры', diffKey: 'viewsDiff', valueKey: 'views', autoKey: 'views', decimals: 0 },
  { key: 'watch', label: 'Время просмотра (часы)', diffKey: 'watchHoursDiff', valueKey: 'watchHours', autoKey: 'watchHours', decimals: 1 },
]

function round(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function VideoDiffEditor({ video, videos, channel, onSave, onOpen }) {
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
        <span className={v.where}>На сайте: клик по видео → «Аналитика видео», карточки над графиком</span>
        <div className={v.barRight}>
          <SaveStatus status={status} />
          <button type="button" className={v.openLink} onClick={() => onOpen(videoAnalyticsRoute(video))}>Открыть страницу →</button>
        </div>
      </div>
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
                    вернуть авто
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className={v.tip}>Нажмите на стрелку или слово «больше/меньше», чтобы поменять; на цифру — чтобы написать свою (например 5,9 млн или 250000). Сохраняется автоматически.</div>
    </div>
  )
}

/**
 * Подпись «На 5,9 млн больше, чем обычно» на странице «Аналитика видео»:
 * слева выбираешь ролик, справа — сами карточки, которые меняются кликом.
 */
export default function TypicalDiffEditor({ videos, channel, onSave, onOpen }) {
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
                {channel?.typicalOverrides?.[String(item.id)] ? ' · задано вручную' : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
      <VideoDiffEditor key={video.id} video={video} videos={videos} channel={channel} onSave={onSave} onOpen={onOpen} />
    </div>
  )
}
