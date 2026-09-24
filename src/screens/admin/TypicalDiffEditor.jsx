import { useMemo, useState } from 'react'
import s from './TypicalDiffEditor.module.css'
import tabStyles from '../analytics/AnalyticsTabs.module.css'
import MetricKpiCell from '../analytics/MetricKpiCell.jsx'
import { KpiDownCircleIcon, KpiUpCircleIcon } from '../icons.jsx'
import { formatCompactOneDecimal } from '../../lib/analyticsFormat.js'
import { buildVideoPerformanceView, videoAnalyticsRoute } from '../../lib/videoPerformanceSection.js'
import { absoluteUsualComparison } from '../analytics/studioAnalyticsHelpers.js'
import { parseHumanAmount } from '../../lib/humanAmount.js'

const METRICS = [
  { key: 'views', label: 'Просмотры', diffKey: 'viewsDiff', valueKey: 'views', typicalKey: 'typicalViews', autoKey: 'views', step: 1 },
  { key: 'watch', label: 'Время просмотра (часы)', diffKey: 'watchHoursDiff', valueKey: 'watchHours', typicalKey: 'typicalWatchHours', autoKey: 'watchHours', step: 0.1 },
]

function plainNumber(value, step) {
  const rounded = step < 1 ? Math.round(Math.abs(value) * 10) / 10 : Math.round(Math.abs(value))
  return rounded.toLocaleString('ru-RU', { maximumFractionDigits: step < 1 ? 1 : 0 })
}

function draftFrom(view, override) {
  return Object.fromEntries(METRICS.map((metric) => {
    const stored = override?.[metric.diffKey]
    if (stored != null) {
      return [metric.key, { auto: false, up: stored >= 0, text: plainNumber(stored, metric.step) }]
    }
    const auto = view.autoTypical?.[metric.autoKey]
    const diff = auto == null ? 0 : view.kpis[metric.valueKey] - auto
    return [metric.key, { auto: true, up: diff >= 0, text: plainNumber(diff, metric.step) }]
  }))
}

function trendOf(diff) {
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'usual'
}

/**
 * Визуальный редактор подписи «На 5,9 млн больше, чем обычно» на странице
 * «Аналитика видео»: выбираешь ролик, жмёшь стрелку ↑/↓, пишешь цифру —
 * карточка сверху сразу показывает, как это будет выглядеть в студии.
 */
export default function TypicalDiffEditor({ videos, channel, onSave, onOpen }) {
  const list = useMemo(() => [...videos].sort((a, b) => String(b.date).localeCompare(String(a.date))), [videos])
  const [selectedId, setSelectedId] = useState(() => list[0]?.id ?? null)
  const video = list.find((item) => item.id === selectedId) || list[0] || null
  const view = useMemo(() => (video ? buildVideoPerformanceView(video, videos, channel) : null), [video, videos, channel])
  const override = video ? channel?.typicalOverrides?.[String(video.id)] : null
  const [draftState, setDraftState] = useState({ key: null, draft: null })
  const [saving, setSaving] = useState(false)

  const draftKey = video && view ? `${video.id}|${JSON.stringify(override || {})}|${view.kpis.views}` : null
  if (draftKey !== draftState.key) {
    setDraftState({ key: draftKey, draft: view ? draftFrom(view, override) : null })
  }
  const draft = draftKey === draftState.key ? draftState.draft : (view ? draftFrom(view, override) : null)

  if (!video || !view) {
    return <div className={s.empty}>Добавьте видео, чтобы настроить подписи.</div>
  }

  const setMetric = (key, patch) => setDraftState((state) => ({
    ...state,
    draft: { ...state.draft, [key]: { ...state.draft[key], ...patch, auto: false } },
  }))
  const resetMetric = (key) => setDraftState((state) => ({
    ...state,
    draft: { ...state.draft, [key]: draftFrom(view, {})[key] },
  }))

  const signedDiff = (metric) => {
    const item = draft[metric.key]
    const amount = parseHumanAmount(item.text)
    if (amount == null) return null
    return item.up ? amount : -amount
  }

  async function save() {
    setSaving(true)
    try {
      const values = Object.fromEntries(METRICS.map((metric) => [
        metric.diffKey,
        draft[metric.key].auto ? null : signedDiff(metric),
      ]))
      await onSave(video.id, values)
    } finally {
      setSaving(false)
    }
  }

  const invalid = METRICS.some((metric) => !draft[metric.key].auto && signedDiff(metric) == null)

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

      <div className={s.workArea}>
        <div className={s.previewHead}>
          <span>Так будет на странице «Аналитика видео»</span>
          <button type="button" className={s.openLink} onClick={() => onOpen(videoAnalyticsRoute(video))}>Открыть страницу →</button>
        </div>
        <div className={`${tabStyles.ytKpiStrip} ${s.previewStrip}`}>
          {METRICS.map((metric) => {
            const diff = signedDiff(metric) ?? 0
            return (
              <MetricKpiCell
                key={metric.key}
                label={metric.label}
                value={formatCompactOneDecimal(view.kpis[metric.valueKey])}
                note={absoluteUsualComparison(diff, formatCompactOneDecimal)}
                trend={trendOf(diff)}
              />
            )
          })}
        </div>

        <div className={s.controls}>
          {METRICS.map((metric) => {
            const item = draft[metric.key]
            const amount = parseHumanAmount(item.text)
            return (
              <div className={s.control} key={metric.key}>
                <div className={s.controlLabel}>
                  {metric.label}
                  {item.auto ? <span className={s.autoBadge}>авто</span> : (
                    <button type="button" className={s.resetBtn} onClick={() => resetMetric(metric.key)}>Вернуть авто</button>
                  )}
                </div>
                <div className={s.controlRow}>
                  <div className={s.arrows} role="group" aria-label="Направление">
                    <button
                      type="button"
                      className={`${s.arrowBtn} ${item.up ? s.arrowUpActive : ''}`}
                      aria-pressed={item.up}
                      onClick={() => setMetric(metric.key, { up: true })}
                    >
                      <KpiUpCircleIcon size={20} color={item.up ? '#2ba640' : '#909090'} />
                      Больше
                    </button>
                    <button
                      type="button"
                      className={`${s.arrowBtn} ${!item.up ? s.arrowDownActive : ''}`}
                      aria-pressed={!item.up}
                      onClick={() => setMetric(metric.key, { up: false })}
                    >
                      <KpiDownCircleIcon size={20} color="#909090" />
                      Меньше
                    </button>
                  </div>
                  <input
                    className={`${s.amountInput} ${amount == null && !item.auto ? s.amountInvalid : ''}`}
                    inputMode="decimal"
                    value={item.text}
                    placeholder="например 5,9 млн или 250000"
                    onChange={(event) => setMetric(metric.key, { text: event.target.value })}
                    aria-label={`${metric.label}: на сколько`}
                  />
                </div>
                <div className={s.hint}>
                  {amount == null
                    ? 'Напишите число: 50000, 50 тыс, 5,9 млн'
                    : `Будет написано: «${absoluteUsualComparison(item.up ? amount : -amount, formatCompactOneDecimal)}»`}
                </div>
              </div>
            )
          })}
        </div>

        <div className={s.footer}>
          <button type="button" className={s.saveBtn} disabled={saving || invalid} onClick={save}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
