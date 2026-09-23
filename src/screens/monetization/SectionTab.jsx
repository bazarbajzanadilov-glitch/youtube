import Card from '../../components/ui/Card.jsx'
import { formatTenge } from '../analytics/studioAnalyticsHelpers.js'
import sx from './MonetizationExtras.module.css'

function sumRevenue(rows = []) {
  return rows.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0)
}

function sourceValue(sources = [], key) {
  return Number(sources.find((source) => source.key === key)?.value) || 0
}

/* Доля рекламы делится между длинными видео/трансляциями и Shorts по их
   реальному доходу за тот же период. */
function adsSplit(analytics) {
  const ads = sourceValue(analytics?.monetization?.sources, 'ads')
  const byType = analytics?.content?.seriesByType || {}
  const longForm = sumRevenue(byType.video) + sumRevenue(byType.live)
  const shorts = sumRevenue(byType.short)
  const total = longForm + shorts
  if (total <= 0) return { watch: 0, shorts: 0 }
  return { watch: ads * (longForm / total), shorts: ads * (shorts / total) }
}

const SECTIONS = {
  'Реклама на странице просмотра': {
    description: 'Доход от рекламы, которую зрители видят до, во время и после длинных видео и трансляций.',
    revenue: (analytics) => adsSplit(analytics).watch,
  },
  'Реклама в ленте Shorts': {
    description: 'Доля дохода от рекламы между роликами в ленте Shorts, распределённая по просмотрам ваших Shorts.',
    revenue: (analytics) => adsSplit(analytics).shorts,
  },
  Спонсорство: {
    description: 'Ежемесячные платежи спонсоров канала за бонусы и значки.',
    revenue: (analytics) => sourceValue(analytics?.monetization?.sources, 'memberships'),
  },
  'Суперфункции и подарки': {
    description: 'Суперчаты, суперстикеры, Super Thanks и подарки во время трансляций и под видео.',
    revenue: (analytics) => sourceValue(analytics?.monetization?.sources, 'supers'),
  },
  Покупки: {
    description: 'Комиссия с продаж товаров, отмеченных в ваших видео и Shorts.',
    revenue: (analytics) => sourceValue(analytics?.monetization?.sources, 'shopping'),
  },
  Коллаборации: {
    description: 'Интеграции с брендами через YouTube BrandConnect. Активных коллабораций нет.',
    revenue: () => null,
  },
}

export default function MonetizationSectionTab({ section, analytics, enabled, onOpenAnalytics, onOpenAdmin }) {
  const config = SECTIONS[section]
  if (!config) return null
  const revenue = enabled ? config.revenue(analytics) : null

  return (
    <div className={sx.partnerPage}>
      <main className={sx.partnerMain}>
        <section className={sx.partnerIntro}>
          <h2>{section}</h2>
        </section>
        <section className={sx.partnerSection}>
          <Card padding="lg" depth="md" className={sx.infoCard}>
            <div className={sx.infoPanel}>
              <div className={sx.panelCopy}>
                <h3>{enabled ? 'Включено' : 'Недоступно: монетизация канала отключена'}</h3>
                <p>{config.description}</p>
                {revenue != null ? (
                  <>
                    <h4>Расчетный доход за последние 28 дней</h4>
                    <strong data-testid="monetization-section-revenue">{formatTenge(revenue)}</strong>
                  </>
                ) : null}
                <div className={sx.buttonRow}>
                  {enabled ? (
                    <button type="button" className={sx.whiteButton} onClick={onOpenAnalytics}>Открыть аналитику дохода</button>
                  ) : (
                    <button type="button" className={sx.darkButton} onClick={onOpenAdmin}>Открыть админку</button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  )
}
