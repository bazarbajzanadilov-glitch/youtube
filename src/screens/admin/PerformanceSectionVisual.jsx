import { useMemo, useState } from 'react'
import v from './AdminVisual.module.css'
import { DiffControl, InlineNumber, InlineText, SaveStatus } from './InlineEdit.jsx'
import { useAutoSavedDraft } from './useAutoSavedDraft.js'
import { getAlmatyDateISO } from '../../lib/almatyDate.js'
import {
  declineDaysLabel,
  declineTimes,
  formatCompactOneDecimal,
  formatNumberRu,
  formatSignedCompactNumber,
} from '../../lib/analyticsFormat.js'
import {
  CURVE_SHAPES,
  buildCumulativeCurve,
  daysSincePublication,
  normalizePerformanceSection,
} from '../../lib/videoPerformanceSection.js'
import { formatTengeAmount } from '../analytics/studioAnalyticsHelpers.js'

const MAX_SOURCES = 5

function ShapeIcon({ shape }) {
  const path = useMemo(() => {
    const curve = buildCumulativeCurve({ days: 60, total: 100, shape, seed: 7 })
    return curve.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index / 60) * 56 + 2},${30 - (value / 100) * 26}`).join(' ')
  }, [shape])
  return (
    <svg width="60" height="32" viewBox="0 0 60 32" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function SectionEditor({ variant, section, onSave }) {
  const serverValue = useMemo(() => normalizePerformanceSection(variant, section), [variant, section])
  const [draft, setDraft, status] = useAutoSavedDraft(serverValue, (value) => onSave(variant, value))
  const isShorts = variant === 'shorts'
  const days = daysSincePublication(draft.publishedAt)
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const setSource = (index, patch) => set({
    trafficSources: draft.trafficSources.map((item, i) => (i === index ? { ...item, ...patch } : item)),
  })

  return (
    <>
      <div className={v.bar}>
        <SaveStatus status={status} />
      </div>
      <div className={v.page}>
        <div>
          <h3 className={v.headline}>
            С момента публикации это видео{isShorts ? ' Shorts' : ''} посмотрели{' '}
            <InlineNumber value={draft.totalViews} format={formatNumberRu} label="Просмотры" onChange={(totalViews) => set({ totalViews })} />{' '}
            {declineTimes(draft.totalViews)}
          </h3>
          <div className={v.meta}>
            Опубликовано{' '}
            <input
              className={v.dateInline}
              type="date"
              max={getAlmatyDateISO()}
              value={draft.publishedAt}
              onChange={(event) => event.target.value && set({ publishedAt: event.target.value })}
              aria-label="Дата публикации"
            />
            {' · '}{declineDaysLabel(days)} с публикации — от этого числа подписи оси графика
          </div>

          <div className={v.card}>
            <div className={v.kpis}>
              <div className={v.kpi}>
                <span className={v.kpiLabel}>Просмотры</span>
                <span className={v.kpiValue}>
                  <InlineNumber value={draft.totalViews} format={formatCompactOneDecimal} label="Просмотры" onChange={(totalViews) => set({ totalViews })} />
                </span>
                <DiffControl
                  diff={draft.totalViews - draft.typicalViews}
                  maxUp={draft.totalViews}
                  format={formatCompactOneDecimal}
                  label="Разница просмотров"
                  onChange={(diff) => set({ typicalViews: Math.max(0, draft.totalViews - diff) })}
                />
              </div>
              {!isShorts ? (
                <div className={v.kpi}>
                  <span className={v.kpiLabel}>Время просмотра (часы)</span>
                  <span className={v.kpiValue}>
                    <InlineNumber value={draft.watchHours} decimals={1} format={formatCompactOneDecimal} label="Время просмотра" onChange={(watchHours) => set({ watchHours })} />
                  </span>
                  <DiffControl
                    diff={Math.round((draft.watchHours - draft.typicalWatchHours) * 10) / 10}
                    maxUp={draft.watchHours}
                    decimals={1}
                    format={formatCompactOneDecimal}
                    label="Разница времени просмотра"
                    onChange={(diff) => set({ typicalWatchHours: Math.max(0, Math.round((draft.watchHours - diff) * 10) / 10) })}
                  />
                </div>
              ) : null}
              <div className={v.kpi}>
                <span className={v.kpiLabel}>Подписчики</span>
                <span className={v.kpiValue}>
                  <InlineNumber value={draft.subscribersGained} format={formatSignedCompactNumber} label="Подписчики" onChange={(subscribersGained) => set({ subscribersGained })} />
                </span>
              </div>
              <div className={v.kpi}>
                <span className={v.kpiLabel}>Расчетный доход</span>
                <span className={v.kpiValue}>
                  <InlineNumber value={draft.revenueTenge} decimals={2} format={formatTengeAmount} label="Доход" onChange={(revenueTenge) => set({ revenueTenge })} />
                </span>
              </div>
            </div>
            <div className={v.shapes}>
              <span className={v.shapesLabel}>Форма графика</span>
              {CURVE_SHAPES.map((shape) => (
                <button
                  key={shape.value}
                  type="button"
                  className={`${v.shape} ${draft.curveShape === shape.value ? v.shapeActive : ''}`}
                  aria-pressed={draft.curveShape === shape.value}
                  onClick={() => set({ curveShape: shape.value })}
                >
                  <ShapeIcon shape={shape.value} />
                  {shape.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={v.side}>
          <span className={v.sideTitle}>Текущая статистика</span>
          <span className={v.sideBig}>
            <InlineNumber value={draft.realtimeViews48h} format={formatNumberRu} label="Просмотры за 48 часов" onChange={(realtimeViews48h) => set({ realtimeViews48h })} />
          </span>
          <span className={v.sideSub}>Просмотры · Последние 48 часов</span>
          <div className={v.sourceHead}><span>Основные источники трафика</span><span>%</span></div>
          {draft.trafficSources.map((item, index) => (
            <div className={v.source} key={index}>
              <InlineText value={item.label} placeholder="Источник" onChange={(label) => setSource(index, { label })} />
              <InlineNumber
                value={item.percent}
                decimals={1}
                max={100}
                format={(value) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`}
                label="Процент"
                onChange={(percent) => setSource(index, { percent })}
              />
              <button type="button" className={v.remove} aria-label="Убрать источник" onClick={() => set({ trafficSources: draft.trafficSources.filter((_, i) => i !== index) })}>×</button>
            </div>
          ))}
          {draft.trafficSources.length < MAX_SOURCES ? (
            <button type="button" className={v.addSource} onClick={() => set({ trafficSources: [...draft.trafficSources, { label: 'Новый источник', percent: 1 }] })}>+ Добавить источник</button>
          ) : null}
        </aside>
      </div>
    </>
  )
}

/**
 * Разделы Shorts / Видео в виде самой страницы: цифры меняются кликом,
 * всё сохраняется само.
 */
export default function PerformanceSectionVisual({ sections, onSave, onOpen }) {
  const [variant, setVariant] = useState('shorts')
  return (
    <div data-testid="performance-sections-visual">
      <div className={v.bar}>
        <div className={v.barLeft}>
          <div className={v.tabs} role="tablist">
            {[['shorts', 'Shorts'], ['video', 'Видео']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={variant === key}
                className={`${v.tab} ${variant === key ? v.tabActive : ''}`}
                onClick={() => setVariant(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={v.where}>На сайте: кнопка {variant === 'shorts' ? '«?»' : '«✦»'} в верхней панели</span>
        </div>
        <button type="button" className={v.openLink} onClick={() => onOpen(variant)}>Открыть страницу →</button>
      </div>
      <SectionEditor key={variant} variant={variant} section={sections?.[variant]} onSave={onSave} />
      <div className={v.tip}>Нажмите на любую подчёркнутую цифру или стрелку, чтобы изменить. Сохраняется автоматически.</div>
    </div>
  )
}
