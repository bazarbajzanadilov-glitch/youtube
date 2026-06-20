import { useContext, useEffect, useState } from 'react'
import s from './Screen3Analytics.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { SparkleIcon, KebabIcon } from './icons.jsx'
import { useAnalytics } from '../hooks/useAnalytics.js'
import TabRow from '../components/ui/TabRow.jsx'
import DateRangePicker from '../components/ui/DateRangePicker.jsx'
import OverviewTab from './analytics/OverviewTab.jsx'
import ContentTab from './analytics/ContentTab.jsx'
import AudienceTab from './analytics/AudienceTab.jsx'
import RevenueTab from './analytics/RevenueTab.jsx'
import TrendsTab from './analytics/TrendsTab.jsx'

const TABS = ['Обзор', 'Контент', 'Аудитория', 'Доход', 'Тренды']

function formatAdvancedNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('ru-RU')
}

function formatAdvancedMoney(value) {
  return `${((Number(value) || 0) * 512).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₸`
}

export default function Screen3Analytics() {
  const { showToast, go } = useContext(NavContext)
  const [activeTab, setActiveTab] = useState(0)
  const [range, setRange] = useState({ kind: '28d' })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const data = useAnalytics(range)
  const isTrends = activeTab === 4
  const isOverviewTab = activeTab === 0
  const isRevenueTab = activeTab === 3
  const isRailTab = isRevenueTab || isTrends
  const advancedRows = [
    ['Просмотры', formatAdvancedNumber(data.overview?.kpis?.views?.value)],
    ['Время просмотра (часы)', formatAdvancedNumber(data.overview?.kpis?.watchTime?.value)],
    ['Подписчики', formatAdvancedNumber(data.overview?.kpis?.subscribers?.value)],
    ['Расчетный доход', formatAdvancedMoney(data.monetization?.kpis?.revenue?.value)],
  ]

  useEffect(() => {
    if (!advancedOpen) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') setAdvancedOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advancedOpen])

  const renderTab = () => {
    if (activeTab === 0) return <OverviewTab data={data} onOpenAdmin={() => go('admin')} />
    if (activeTab === 1) return <ContentTab data={data} onOpenAdmin={() => go('admin')} />
    if (activeTab === 2) return <AudienceTab data={data} onOpenAdmin={() => go('admin')} />
    if (activeTab === 3) return <RevenueTab data={data} />
    return <TrendsTab data={data} />
  }

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="analytics"/>
      <div className={s.main}>
        {!isTrends ? (
          <div className={`${s.headerRow} ${isOverviewTab ? s.headerRowOverview : ''} ${isRevenueTab ? s.headerRowRail : ''}`}>
            <h1 className={s.title}>Аналитика по каналу</h1>
            <button
              type="button"
              className={s.advanced}
              onClick={() => {
                setAdvancedOpen(true)
                showToast('Расширенный режим')
              }}
              aria-expanded={advancedOpen}
            >
              Расширенный режим
            </button>
          </div>
        ) : null}

        {!isTrends ? (
          <div className={`${s.suggestRow} ${isOverviewTab ? s.suggestRowOverview : ''} ${isRevenueTab ? s.suggestRowRail : ''}`}>
            <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
              <SparkleIcon size={18}/>Как зрители находят мой контент?
            </button>
            <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
              <SparkleIcon size={18}/>Сколько на моем канале новых зрителей?
            </button>
            <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
              <SparkleIcon size={18}/>Дать краткую оценку эффективности последнего видео
            </button>
            <button type="button" className={s.kebab} onClick={() => showToast('Ещё')} aria-label="Ещё">
              <KebabIcon/>
            </button>
          </div>
        ) : null}

        <div className={`${s.controlRow} ${isOverviewTab ? s.controlRowOverview : ''} ${isTrends ? s.controlRowTrends : ''} ${isRailTab ? s.controlRowRail : ''}`}>
          <TabRow tabs={TABS} active={activeTab} onChange={setActiveTab} />
          {!isTrends ? (
            <div className={`${s.dateWrap} ${isRevenueTab ? s.dateWrapRail : ''}`}>
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          ) : null}
        </div>

        <div key={activeTab}>
          {renderTab()}
        </div>

        {advancedOpen ? (
          <div className={s.advancedOverlay} onMouseDown={() => setAdvancedOpen(false)}>
            <section
              className={s.advancedDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="advanced-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className={s.advancedHead}>
                <div>
                  <h2 id="advanced-title">Расширенный режим</h2>
                  <span>{data.range?.label || 'Последние 28 дней'}</span>
                </div>
                <button type="button" className={s.advancedClose} onClick={() => setAdvancedOpen(false)}>
                  Закрыть
                </button>
              </div>
              <div className={s.advancedGrid}>
                {advancedRows.map(([label, value]) => (
                  <div className={s.advancedMetric} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className={s.advancedTable}>
                {data.overview?.topVideos?.slice(0, 5).map((video, index) => (
                  <div className={s.advancedTableRow} key={video.id || video.title}>
                    <span>{index + 1}</span>
                    <strong>{video.title}</strong>
                    <em>{formatAdvancedNumber(video.views)} просмотров</em>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
