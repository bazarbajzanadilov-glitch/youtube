import { useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import s from './Screen7Monetization.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import TabRow from '../components/ui/TabRow.jsx'
import OverviewTab from './monetization/OverviewTab.jsx'

const TABS = [
  'Обзор',
  'Реклама на странице просмотра',
  'Реклама в ленте Shorts',
  'Спонсорство',
  'Суперфункции и подарки',
  'Покупки',
  'Коллаборации',
]

export default function Screen7Monetization() {
  const { go } = useContext(NavContext)
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="monetize"/>
      <div className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Зарабатывайте на YouTube</h1>
        </div>

        <div className={s.controlRow}>
          <TabRow tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="monetize-tab-underline" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <OverviewTab activeSection={TABS[activeTab]} onOpenAdmin={() => go('admin')} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
