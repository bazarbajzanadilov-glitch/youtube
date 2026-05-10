import { motion } from 'framer-motion'
import s from './AnalyticsTabs.module.css'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import AnimatedCounter from '../../components/ui/AnimatedCounter.jsx'
import DeltaChip from '../../components/ui/DeltaChip.jsx'
import AreaLineChart from '../../components/charts/AreaLineChart.jsx'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.jsx'
import Heatmap7x24 from '../../components/charts/Heatmap7x24.jsx'
import {
  formatCompactNumber, formatNumberRu, formatPercent,
} from '../../lib/analyticsFormat.js'
import { CHART_COLORS } from '../../lib/chartColors.js'
import { CheckCircle, ArrowUpIcon } from '../icons.jsx'

const inlineKpiVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function AudienceTab({ data, onOpenAdmin }) {
  const { audience } = data
  const kpis = audience.kpis
  const ageRows = audience.ageGender.ages.map((a) => ({
    label: a.label, share: a.share, color: CHART_COLORS.purple,
  }))
  const genderRows = audience.ageGender.genders.map((g) => ({
    label: g.label, share: g.share, color: CHART_COLORS.purple,
  }))
  const deviceRows = audience.devices.map((d) => ({
    label: d.label, share: d.share, color: CHART_COLORS.purple,
  })).filter((d) => d.share > 0.001)
  const langRows = audience.languages.slice(0, 5).map((l) => ({ label: l.label, share: l.share, color: CHART_COLORS.purple }))
  const geoRows = audience.geography.slice(0, 5).map((g) => ({ label: g.label, share: g.share, color: CHART_COLORS.purple }))

  if (kpis.subscribers.absolute === 0 && audience.subscribers.length === 0) {
    return (
      <EmptyState
        title="Аудитория ещё не сформирована"
        description="Добавьте видео и подписчиков в админке — здесь появится подробная разбивка."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }

  /* PDF 33: 2 KPI cards at top — "Зрителей в месяц" + "Подписчики" */
  const monthlyViewers = Math.round((kpis.uniqueViewers.value || 0) * 0.85)

  /* Audience segments (PDF 33: Новые / Случайные / Постоянные) */
  const segments = [
    { label: 'Новые зрители', share: 0.69, color: CHART_COLORS.purple },
    { label: 'Случайные зрители', share: 0.26, color: CHART_COLORS.purple },
    { label: 'Постоянные зрители', share: 0.05, color: CHART_COLORS.purple },
  ]

  /* Watch time by subscription state */
  const subscriptionStats = [
    { label: 'Без подписки', share: 0.999, color: CHART_COLORS.purple },
    { label: 'С подпиской', share: 0.001, color: CHART_COLORS.purple },
  ]

  return (
    <div className={s.audienceLayout}>
      {/* Top row: 2 KPI cards per PDF 33 */}
      <div className={s.audienceKpiRow}>
        <Card padding="lg" depth="md" className={s.audienceKpi}>
          <motion.div variants={inlineKpiVariants} initial="hidden" animate="show">
            <div className={s.audienceKpiLabel}>
              Зрителей в месяц
              <span className={s.audienceKpiHelp}>ⓘ</span>
            </div>
            <div className={s.audienceKpiValue}>
              <AnimatedCounter value={monthlyViewers} format={formatCompactNumber} />
            </div>
          </motion.div>
        </Card>
        <Card padding="lg" depth="md" className={s.audienceKpi}>
          <motion.div variants={inlineKpiVariants} initial="hidden" animate="show">
            <div className={s.audienceKpiLabel}>Подписчики</div>
            <div className={s.audienceKpiValue}>
              <AnimatedCounter
                value={kpis.subscribers.value}
                format={(n) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('ru-RU')}`}
              />
              <ArrowUpIcon size={18} color="#2ba640"/>
            </div>
            <div className={s.audienceKpiHint}>На 50 % больше, чем за предыдущие 28 дней</div>
          </motion.div>
        </Card>
      </div>

      {/* Big purple chart — subscriber growth */}
      <Card padding="lg" depth="lg" className={s.heroCardPdf}>
        <AreaLineChart
          data={audience.subscribers}
          dataKey="subscribers"
          xKey="date"
          color={CHART_COLORS.purple}
          height={210}
          name="Подписчики"
          formatY={formatCompactNumber}
          formatTooltipValue={(v) => formatNumberRu(v)}
        />
        <div className={s.heroPdfFooter}>
          <button type="button" className={s.detailsBtn}>Подробнее</button>
        </div>
      </Card>

      {/* 2-col grid per PDF 33 */}
      <div className={s.audienceGrid}>
        {/* LEFT */}
        <div className={s.audienceCol}>
          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Сегменты аудитории по просмотрам вашего контента</div>
            <div className={s.cardSub}>Зрителей в месяц · {data.range.label}</div>
            <div className={s.spacer16} />
            <div className={s.segmentBar}>
              {segments.map((seg, i) => (
                <motion.div
                  key={seg.label}
                  className={s.segmentSlice}
                  style={{ width: `${seg.share * 100}%`, background: lighten(seg.color, i) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${seg.share * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                />
              ))}
            </div>
            <ul className={s.segmentList}>
              {segments.map((seg, i) => (
                <li key={seg.label} className={s.segmentRow}>
                  <span className={s.segmentDot} style={{ background: lighten(seg.color, i) }} />
                  <span className={s.segmentLabel}>{seg.label}</span>
                  <span className={s.segmentValue}>{formatPercent(seg.share * 100, 1)}</span>
                </li>
              ))}
            </ul>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Когда ваши зрители смотрят видео на YouTube</div>
            <div className={s.cardSub}>Местное время (GMT +0500) · {data.range.label}</div>
            <div className={s.spacer16} />
            <Heatmap7x24 matrix={audience.heatmap} />
            <div className={s.cardFooterNote}>
              ⓘ Эффективность видео в долгосрочной перспективе не зависит от времени публикации. <a href="#" className={s.linkInline}>Подробнее</a>
            </div>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Время просмотра подписчиками</div>
            <div className={s.cardSub}>Время просмотра · {data.range.label}</div>
            <div className={s.spacer16} />
            <HorizontalBarChart data={subscriptionStats} formatValue={(v) => formatPercent(v * 100, 1)} />
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Возраст и пол</div>
            <div className={s.cardSub}>Просмотры · {data.range.label}</div>
            <div className={s.spacer16} />
            <HorizontalBarChart data={genderRows} formatValue={(v) => formatPercent(v * 100, 1)} />
            <div className={s.divider} />
            <HorizontalBarChart
              data={ageRows.map((a) => ({ ...a, label: `Возраст: ${a.label}` }))}
              formatValue={(v) => formatPercent(v * 100, 1)}
            />
            <div className={s.cardFooterNote}>
              ⓘ Возраст зрителя определяется на основе возраста, который пользователь указывает при создании аккаунта.
            </div>
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>
        </div>

        {/* RIGHT */}
        <div className={s.audienceCol}>
          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Популярно у разных аудиторий</div>
            <div className={s.cardSub}>Просмотры · {data.range.label}</div>

            <div className={s.audienceTabs}>
              {['Новые', 'Случайные', 'Постоянные'].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={`${s.audienceTabBtn} ${i === 0 ? s.audienceTabActive : ''}`}
                >{t}</button>
              ))}
            </div>

            <ul className={s.bestList}>
              {data.overview.topVideos.slice(0, 4).map((v) => {
                const pct = Math.min(100, (v.views / Math.max(1, data.overview.topVideos[0].views)) * 100)
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
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Каналы, которые смотрят ваши зрители</div>
            <div className={s.cardSub}>{data.range.label}</div>
            <div className={s.audienceEmpty}>Недостаточно данных. <a href="#" className={s.linkInline}>Подробнее...</a></div>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Что смотрят ваши зрители</div>
            <div className={s.cardSub}>Последние 7 дней</div>
            <div className={s.audienceEmpty}>Недостаточно данных. <a href="#" className={s.linkInline}>Подробнее...</a></div>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Какие форматы выбирают ваши зрители на YouTube</div>
            <div className={s.cardSub}>{data.range.label}</div>
            <div className={s.spacer16} />
            <div className={s.formatBlock}>
              <div className={s.formatLabel}>Видео</div>
              <div className={s.formatBar}>
                <motion.div className={s.formatFill} style={{ width: '78%' }}
                  initial={{ width: 0 }} animate={{ width: '78%' }} transition={{ duration: 0.6 }} />
              </div>
              <div className={s.formatScale}><span>Никто не смотрит</span><span>Смотрят все</span></div>
            </div>
            <div className={s.formatBlock}>
              <div className={s.formatLabel}>Shorts</div>
              <div className={s.formatBar}>
                <motion.div className={s.formatFill} style={{ width: '32%' }}
                  initial={{ width: 0 }} animate={{ width: '32%' }} transition={{ duration: 0.6, delay: 0.1 }} />
              </div>
              <div className={s.formatScale}><span>Никто не смотрит</span><span>Смотрят все</span></div>
            </div>
            <div className={s.formatBlock}>
              <div className={s.formatLabel}>Трансляции</div>
              <div className={s.formatBar}>
                <motion.div className={s.formatFill} style={{ width: '45%' }}
                  initial={{ width: 0 }} animate={{ width: '45%' }} transition={{ duration: 0.6, delay: 0.2 }} />
              </div>
              <div className={s.formatScale}><span>Никто не смотрит</span><span>Смотрят все</span></div>
            </div>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Тип устройства</div>
            <div className={s.cardSub}>Время просмотра (часы) · {data.range.label}</div>
            <div className={s.spacer16} />
            <HorizontalBarChart data={deviceRows} formatValue={(v) => formatPercent(v * 100, 1)} />
            <button type="button" className={s.detailsBtn}>Подробнее</button>
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Топ регионов</div>
            <div className={s.cardSub}>Просмотры · {data.range.label}</div>
            <div className={s.spacer16} />
            <HorizontalBarChart data={geoRows} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>

          <Card padding="lg" depth="md">
            <div className={s.cardTitle}>Самые популярные языки субтитров</div>
            <div className={s.cardSub}>Просмотры · {data.range.label}</div>
            <div className={s.spacer16} />
            <HorizontalBarChart data={langRows} formatValue={(v) => formatPercent(v * 100, 1)} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function lighten(color, idx) {
  const opacity = 1 - idx * 0.25
  return `rgba(139, 92, 246, ${Math.max(0.35, opacity)})`
}
