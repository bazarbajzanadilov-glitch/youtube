import s from '../analytics/AnalyticsTabs.module.css'
import sx from './MonetizationExtras.module.css'
import Card from '../../components/ui/Card.jsx'
import EmptyState from '../../components/ui/EmptyState.jsx'
import { formatMoneyShort, formatDateLong, formatNumberRu } from '../../lib/analyticsFormat.js'

export default function MonetizationTransactionsTab({ data, onOpenAdmin }) {
  const { monetization } = data
  const videos = data.overview.topVideos
  if (monetization.enabled === false) {
    return (
      <EmptyState
        title="Транзакции недоступны"
        description="Включите монетизацию в админке."
        action={<button type="button" className={s.linkBtn} onClick={onOpenAdmin}>Открыть админку →</button>}
      />
    )
  }
  if (!videos || videos.length === 0) {
    return <EmptyState title="Нет транзакций" description="Когда появятся видео с доходом — здесь будет история." />
  }

  const sorted = [...videos]
    .filter((v) => (v.revenue || 0) > 0)
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))

  return (
    <div className={sx.layoutSingle}>
      <Card padding="lg" depth="md">
        <div className={s.cardTitle}>Транзакции по видео</div>
        <div className={s.cardSub}>Сводка за выбранный период</div>
      </Card>

      <Card padding="none" depth="md">
        <table className={sx.txTable}>
          <thead>
            <tr>
              <th>Видео</th>
              <th>Дата</th>
              <th className={s.right}>Просмотры</th>
              <th className={s.right}>Доход</th>
              <th className={s.right}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className={sx.popContent}>
                    <div className={sx.popThumb}>{v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}</div>
                    <div>
                      <div className={sx.popName}>{v.title}</div>
                      <div className={sx.popDate}>{v.duration}</div>
                    </div>
                  </div>
                </td>
                <td className={sx.txDate}>{formatDateLong(v.date)}</td>
                <td className={s.right}>{formatNumberRu(v.views)}</td>
                <td className={s.right}>{formatMoneyShort(v.revenue || 0)}</td>
                <td className={s.right}>
                  <span className={sx.statusOk}>Выплачено</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
