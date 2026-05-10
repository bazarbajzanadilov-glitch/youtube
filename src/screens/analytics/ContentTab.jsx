import { useState } from 'react'
import { motion } from 'framer-motion'
import s from './AnalyticsTabs.module.css'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AnimatedCounter from '../../components/ui/AnimatedCounter.jsx'
import DeltaChip from '../../components/ui/DeltaChip.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import FunnelChart from '../../components/charts/FunnelChart.jsx'
import {
  formatCompactNumber, formatNumberRu, formatPercent, formatSecondsAsClock,
} from '../../lib/analyticsFormat.js'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { CheckCircle } from '../icons.jsx'

const TRAFFIC_TABS = ['Общие', 'Внешние источники', 'Поиск на YouTube', 'Рекомендуемые видео', 'Плейлисты']

const inlineKpiVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

function InlineKPI({ label, value, format, delta, hint, suffix, isFirst, mark = true }) {
  return (
    <motion.div className={`${s.inlineKpi} ${isFirst ? '' : s.inlineKpiBordered}`} variants={inlineKpiVariants}>
      <div className={s.inlineKpiLabel}>{label}</div>
      <div className={s.inlineKpiValue}>
        <AnimatedCounter value={Number(value) || 0} format={format} />
        {suffix ? <span className={s.inlineKpiSuffix}>{suffix}</span> : null}
        {mark ? <CheckCircle size={16} color="#2ba640" /> : null}
      </div>
      {Number.isFinite(delta) ? (
        <div className={s.inlineKpiHint}>
          <DeltaChip value={delta} />
          {hint ? <span className={s.inlineKpiHintText}>{hint}</span> : null}
        </div>
      ) : (
        <div className={s.inlineKpiHint}>
          <span className={s.inlineKpiHintText}>{hint || 'Обычное значение'}</span>
        </div>
      )}
    </motion.div>
  )
}

export default function ContentTab({ data, onOpenAdmin }) {
  const { content } = data
  const kpis = content.kpis
  const [trafficTab, setTrafficTab] = useState(0)

  if ((content.topVideos?.length || 0) === 0) {
    return (
      <EmptyState
        title="Пока нет данных по контенту"
        description="Добавьте видео в админке — мы посчитаем CTR, показы и трафик."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }

  /* PDF 22 traffic order: Поиск, Плейлисты, Функции выбора контента, Адресная строка, Внешние, Другое */
  const traffic = content.traffic
  const trafficTotal = traffic.reduce((s, x) => s + (x.share || 0), 0) || 1
  const isLifetime = data.range.kind === 'lifetime'
  const periodDelta = (d) => isLifetime ? undefined : d

  /* Funnel data per PDF 22 */
  const impressions = kpis.impressions.value
  const ctrFraction = (kpis.ctr.value || 0) / 100
  const viewsFromImpressions = Math.round(impressions * ctrFraction)
  const avgWatchSec = Math.round((kpis.avgDuration.value || 0) * 0.45)
  const watchTimeMins = Math.round((viewsFromImpressions * avgWatchSec) / 60)
  const funnelSteps = [
    {
      label: 'Показы',
      value: formatCompactNumber(impressions),
      note: `В ${formatPercent((Math.round((Math.min(1, viewsFromImpressions / Math.max(1, impressions))) * 100)) , 1)} случаев значки были показаны в рекомендациях`,
    },
    {
      label: 'Просмотры по показам значков',
      value: formatCompactNumber(viewsFromImpressions),
      note: `Среднее время просмотра — ${formatSecondsAsClock(avgWatchSec)}`,
    },
    {
      label: 'Время просмотра в результате показа значков (часы)',
      value: formatCompactNumber(Math.round(watchTimeMins / 60)),
      note: null,
    },
  ]

  return (
    <div className={s.contentLayout}>
      {/* 4 separate KPI cards per PDF 22 */}
      <Card padding="none" depth="md" className={s.contentKpiBlock}>
        <motion.div
          className={s.contentKpiRow}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="show"
        >
          <InlineKPI
            label="Просмотры"
            value={kpis.views.value}
            format={formatCompactNumber}
            delta={periodDelta(kpis.views.delta)}
            hint="Обычное значение"
            isFirst
          />
          <InlineKPI
            label="Показы"
            value={kpis.impressions.value}
            format={formatCompactNumber}
            delta={periodDelta(kpis.impressions.delta)}
            hint="На 27 % выше, чем за предыдущие 28 дней"
          />
          <InlineKPI
            label="CTR для значков видео"
            value={kpis.ctr.value}
            format={(n) => formatPercent(n, 1)}
            mark={false}
            hint=""
          />
          <InlineKPI
            label="Средняя продолжительность просмотра"
            value={kpis.avgDuration.value}
            format={formatSecondsAsClock}
            mark={false}
            hint=""
          />
        </motion.div>
      </Card>

      {/* Big chart per PDF 22 */}
      <Card padding="lg" depth="lg" className={s.heroCardPdf}>
        <AreaLineChart
          data={content.series}
          dataKey="views"
          xKey="date"
          color={CHART_COLORS.primary}
          height={210}
          name="Просмотры"
          formatY={formatCompactNumber}
          formatTooltipValue={(v) => formatNumberRu(v)}
        />
        <div className={s.heroPdfFooter}>
          <button type="button" className={s.detailsBtn}>Подробнее</button>
        </div>
      </Card>

      {/* 2-col grid per PDF 22 */}
      <div className={s.contentGrid}>
        <Card padding="lg" depth="md">
          <div className={s.cardTitle}>Как зрители находят ваши видео</div>
          <div className={s.cardSub}>Количество просмотров · {data.range.label}</div>

          <div className={s.trafficTabs}>
            {TRAFFIC_TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                className={`${s.trafficTab} ${i === trafficTab ? s.trafficTabActive : ''}`}
                onClick={() => setTrafficTab(i)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={s.trafficList}>
            {traffic.map((row) => {
              const pct = (row.share / trafficTotal) * 100
              return (
                <div key={row.key} className={s.trafficRow}>
                  <span className={s.trafficLabel}>{row.label}</span>
                  <div className={s.trafficBarOuter}>
                    <motion.div
                      className={s.trafficBar}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={s.trafficValue}>{formatPercent(pct, 1)}</span>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </div>
        </Card>

        <div className={s.contentRightCol}>
          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Лучшие видео</div>
            <div className={s.cardSub}>Просмотры · {data.range.label}</div>
            <ul className={s.bestList}>
              {content.topVideos.slice(0, 5).map((v) => {
                const pct = Math.min(100, (v.views / Math.max(1, content.topVideos[0].views)) * 100)
                return (
                  <li key={v.id} className={s.bestRow}>
                    <div className={s.bestThumb}>
                      {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                    </div>
                    <span className={s.bestTitle} title={v.title}>{v.title}</span>
                    <div className={s.bestBar}>
                      <motion.div
                        className={s.bestBarInner}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                    </div>
                    <span className={s.bestValue}>{formatCompactNumber(v.views)}</span>
                  </li>
                )
              })}
            </ul>
            <div style={{ marginTop: 12 }}>
              <button type="button" className={s.detailsBtn}>Подробнее</button>
            </div>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Топ по ремиксам</div>
            <div className={s.cardSub}>Ваш контент, который добавляли в Shorts · {data.range.label}</div>
            <div className={s.remixesEmpty}>Нет данных за выбранный диапазон дат.</div>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>
        </div>
      </div>

      {/* Funnel per PDF 22 */}
      <Card padding="lg" depth="md">
        <div className={s.cardTitle}>Показы значков и время просмотра видео</div>
        <div className={s.cardSub}>Данные за период · {data.range.label}</div>
        <FunnelChart steps={funnelSteps} />
      </Card>
    </div>
  )
}
