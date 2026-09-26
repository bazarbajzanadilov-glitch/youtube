import { useMemo } from 'react'
import v from './AdminVisual.module.css'
import t from './TypicalDiffEditor.module.css'
import { PercentControl, SaveStatus } from './InlineEdit.jsx'
import { useAutoSavedDraft } from './useAutoSavedDraft.js'
import { build } from '../../lib/analyticsAggregator.js'
import { formatCompactOneDecimal, formatSignedCompactNumber } from '../../lib/analyticsFormat.js'

const METRICS = [
  { key: 'views', label: 'Просмотры', kpiKey: 'views', format: formatCompactOneDecimal },
  { key: 'watch', label: 'Время просмотра (часы)', kpiKey: 'watchTime', format: (value) => `${value > 0 ? '+' : ''}${formatCompactOneDecimal(value)}` },
  { key: 'subscribers', label: 'Подписчики', kpiKey: 'subscribers', format: formatSignedCompactNumber },
]

function autoPercent(kpi) {
  const delta = Number(kpi?.delta)
  if (!Number.isFinite(delta)) return 999
  return Math.round(delta)
}

/**
 * Карточки «Аналитика по каналу»: процент «чем за предыдущие 28 дней»
 * задаётся кликом по цифре и стрелке, фиксируется навсегда и сохраняется сам.
 */
export default function ChannelKpiVisual({ videos, channel, onSave, onOpen }) {
  const overview = useMemo(
    () => build(videos, { ...channel, kpiOverrides: null }, { kind: '28d' }).overview,
    [videos, channel],
  )
  const serverValue = useMemo(() => ({
    views: channel?.kpiOverrides?.views ?? null,
    watch: channel?.kpiOverrides?.watch ?? null,
    subscribers: channel?.kpiOverrides?.subscribers ?? null,
  }), [channel?.kpiOverrides])
  const [draft, setDraft, status] = useAutoSavedDraft(serverValue, onSave)

  return (
    <div data-testid="channel-kpi-visual">
      <div className={v.bar}>
        <span className={v.where}>На сайте: «Аналитика» → вкладка «Обзор», карточки над графиком (так же во вкладках «Контент» и «Аудитория»)</span>
        <div className={v.barRight}>
          <SaveStatus status={status} />
          <button type="button" className={v.openLink} onClick={onOpen}>Открыть аналитику →</button>
        </div>
      </div>
      <div className={v.card}>
        <div className={v.kpis}>
          {METRICS.map((metric) => {
            const kpi = overview.kpis[metric.kpiKey]
            const manual = draft[metric.key]
            return (
              <div className={v.kpi} key={metric.key}>
                <span className={v.kpiLabel}>{metric.label}</span>
                <span className={v.kpiValue}>{metric.format(kpi?.value || 0)}</span>
                <PercentControl
                  percent={manual ?? autoPercent(kpi)}
                  label={metric.label}
                  onChange={(next) => setDraft((current) => ({ ...current, [metric.key]: next }))}
                />
                {manual == null ? (
                  <span className={t.autoNote}>сейчас считается автоматически</span>
                ) : (
                  <button type="button" className={t.resetBtn} onClick={() => setDraft((current) => ({ ...current, [metric.key]: null }))}>
                    вернуть авто
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className={v.tip}>Нажмите на цифру процента, чтобы написать свою (например 999 или 900); на стрелку или слово — чтобы поменять «больше/меньше». Заданный процент не меняется со временем и одинаков для любого периода. Сохраняется автоматически.</div>
    </div>
  )
}
