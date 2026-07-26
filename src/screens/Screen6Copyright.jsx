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

const EMPTY_COPY = {
  similarity: {
    title: 'Похожий контент не найден',
    text: 'Здесь появятся ролики, похожие на ваши видео. Сейчас совпадений по сходству нет.',
  },
  matches: {
    title: 'Отличная работа, все под контролем!',
    text: 'Здесь будут показаны видео, в которых есть совпадения с вашим контентом. Пока таких роликов не найдено.',
  },
  removals: {
    title: 'Нет активных запросов на удаление',
    text: 'Отправленные и полученные запросы на удаление появятся в этом разделе.',
  },
  messages: {
    title: 'Нет новых сообщений',
    text: 'Сообщения, связанные с авторскими правами и обнаруженным контентом, появятся здесь.',
  },
  archive: {
    title: 'Архив пуст',
    text: 'Завершенные совпадения и обработанные запросы будут храниться в этом разделе.',
  },
}

export default function Screen6Copyright() {
  const [activeTab, setActiveTab] = useState('copyright')
  const [activeFilter, setActiveFilter] = useState('matches')
  const emptyCopy = activeTab === 'similarity'
    ? EMPTY_COPY.similarity
    : EMPTY_COPY[activeFilter]

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
            <CheckCircle size={72} color="var(--studio-text-subtle)" />
          </div>
          <div className={s.emptyTitle}>{emptyCopy.title}</div>
          <div className={s.emptyText}>{emptyCopy.text}</div>
        </div>
      </div>
    </div>
  )
}
