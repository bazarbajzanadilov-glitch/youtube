import { useState } from 'react'
import s from './Screen6Copyright.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { CheckCircle } from './icons.jsx'

const TOP_TABS = [
  { id: 'copyright', label: 'Авторские права' },
  { id: 'similarity', label: 'Сходство', beta: true },
]

const FILTERS = [
  { id: 'matches', label: 'Совпадения' },
  { id: 'removals', label: 'Запросы на удаление' },
  { id: 'messages', label: 'Сообщения' },
  { id: 'archive', label: 'Архив' },
]

export default function Screen6Copyright() {
  const [activeTab, setActiveTab] = useState('copyright')
  const [activeFilter, setActiveFilter] = useState('matches')

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="copyright"/>
      <div className={s.main}>
        <h1 className={s.title}>Обнаружение контента</h1>

        <div className={s.tabs} role="tablist" aria-label="Вкладки обнаружения контента">
          {TOP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              className={`${s.tab} ${tab.id === activeTab ? s.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.beta ? <span className={s.betaBadge}>Бета</span> : null}
            </button>
          ))}
        </div>

        <div className={s.filterRow} role="radiogroup" aria-label="Разделы">
          {FILTERS.map((item) => {
            const checked = item.id === activeFilter
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={checked}
                className={`${s.filterChip} ${checked ? s.filterChipActive : ''}`}
                onClick={() => setActiveFilter(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className={s.emptyState}>
          <div className={s.emptyIcon} aria-hidden="true">
            <CheckCircle size={72} color="#8d8d8d" />
          </div>
          <div className={s.emptyTitle}>Отличная работа, все под контролем!</div>
          <div className={s.emptyText}>
            Здесь будут показаны видео, в которых есть совпадения с вашим контентом.
            Пока таких роликов не найдено.
          </div>
        </div>
      </div>
    </div>
  )
}
