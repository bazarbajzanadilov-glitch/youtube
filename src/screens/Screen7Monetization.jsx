import { useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import s from './Screen7Monetization.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { SparkleIcon, KebabIcon } from './icons.jsx'
import { useAnalytics } from '../hooks/useAnalytics.js'
import TabRow from '../components/ui/TabRow.jsx'
import DateRangePicker from '../components/ui/DateRangePicker.jsx'
import OverviewTab from './monetization/OverviewTab.jsx'
import IncomeTab from './monetization/IncomeTab.jsx'
import AdsTab from './monetization/AdsTab.jsx'
import TransactionsTab from './monetization/TransactionsTab.jsx'

const TABS = ['Обзор', 'Доходы', 'Реклама', 'Транзакции']

export default function Screen7Monetization() {
  const { showToast, go } = useContext(NavContext)
  const [activeTab, setActiveTab] = useState(0)
  const [range, setRange] = useState({ kind: '28d' })
  const data = useAnalytics(range)

  const renderTab = () => {
    if (activeTab === 0) return <OverviewTab data={data} onOpenAdmin={() => go('admin')} />
    if (activeTab === 1) return <IncomeTab data={data} onOpenAdmin={() => go('admin')} />
    if (activeTab === 2) return <AdsTab data={data} onOpenAdmin={() => go('admin')} />
    return <TransactionsTab data={data} onOpenAdmin={() => go('admin')} />
  }

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="monetize"/>
      <div className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Монетизация</h1>
          <button type="button" className={s.advanced} onClick={() => showToast('Расширенный режим')}>
            Расширенный режим
          </button>
        </div>

        <div className={s.suggestRow}>
          <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
            <SparkleIcon size={18}/>Какой источник дохода вырос больше всего?
          </button>
          <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
            <SparkleIcon size={18}/>Какие видео приносят больше всего?
          </button>
          <button type="button" className={s.suggestion} onClick={() => showToast('Подсказка ИИ')}>
            <SparkleIcon size={18}/>Можно ли поднять CPM?
          </button>
          <button type="button" className={s.kebab} onClick={() => showToast('Ещё')} aria-label="Ещё">
            <KebabIcon/>
          </button>
        </div>

        <div className={s.controlRow}>
          <TabRow tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="monetize-tab-underline" />
          <div className={s.dateWrap}>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
