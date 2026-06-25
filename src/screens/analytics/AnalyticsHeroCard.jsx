import Card from '../../components/ui/Card.jsx'
import StudioButton from '../../components/ui/StudioButton.jsx'
import s from './AnalyticsTabs.module.css'

export default function AnalyticsHeroCard({
  className = '',
  children,
  chart,
  chartClassName = '',
  chartStyle,
  footerClassName = '',
  actionLabel = 'Подробнее',
  actionProps = {},
}) {
  return (
    <Card padding="none" depth="lg" className={`${s.ytHeroCard} ${className}`} data-analytics-hero="true">
      {children}
      <div className={`${s.ytHeroChart} ${chartClassName}`} style={chartStyle}>
        {chart}
      </div>
      <div className={`${s.ytHeroFooter} ${footerClassName}`} data-analytics-hero-footer="true">
        <StudioButton variant="pill" className={s.ytPillBtn} {...actionProps}>
          {actionLabel}
        </StudioButton>
      </div>
    </Card>
  )
}
