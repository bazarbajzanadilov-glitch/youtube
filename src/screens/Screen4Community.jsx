import { useMemo, useState, useContext } from 'react'
import s from './Screen4Community.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { FilterIcon, ChevronDown, ThumbUpIcon, ThumbDownIcon, HeartIcon, KebabIcon } from './icons.jsx'
import { useChannel } from '../storage/useChannel.js'

const TABS = ['Комментарии', 'На проверке']

function avatarLetter(author = '') {
  const clean = String(author).replace(/^@/, '').trim()
  return (clean[0] || '?').toUpperCase()
}

export default function Screen4Community() {
  const { showToast } = useContext(NavContext)
  const { channel } = useChannel()
  const [activeTab, setActiveTab] = useState(0)
  const dashboardComments = useMemo(
    () => (Array.isArray(channel.dashboardComments) ? channel.dashboardComments : []),
    [channel.dashboardComments],
  )
  const comments = useMemo(() => (
    dashboardComments.map((comment, index) => {
      return {
        id: comment.id || `comment-${index}`,
        handle: comment.author || '@author',
        time: comment.age || 'Недавно',
        text: comment.text || '',
        avatarColor: comment.avatarColor || '#525252',
      }
    })
  ), [dashboardComments])

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="community"/>
      <div className={s.main}>
        <h1 className={s.title}>Сообщество</h1>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button key={t} type="button" className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
          ))}
        </div>

        <div className={s.filterRow}>
          <button type="button" className={s.filterIcon} onClick={() => showToast('Фильтр')} aria-label="Фильтр"><FilterIcon/></button>
          <button type="button" className={s.filterChip}>Опубликованные <ChevronDown size={14}/></button>
          <button type="button" className={s.filterChip}>Ответы <ChevronDown size={14}/></button>
          <button type="button" className={s.filterChip}>Есть ответы <ChevronDown size={14}/></button>
          <button type="button" className={s.filterChip}>Подписчик канала</button>
          <button type="button" className={s.filterChip}>Содержит</button>
          <button type="button" className={s.filterClear} aria-label="Очистить фильтры" onClick={() => showToast('Очистить фильтры')}>×</button>
        </div>

        {activeTab === 1 ? (
          <div className={s.emptyState}>Нет комментариев, ожидающих проверки.</div>
        ) : comments.length === 0 ? (
          <div className={s.emptyState}>Опубликованных комментариев пока нет.</div>
        ) : (
          <div className={s.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={s.commentRow}>
                <div className={s.checkbox}/>
                <div className={s.avatar} style={{ backgroundColor: c.avatarColor }}>
                  <span className={s.avatarFallback}>{avatarLetter(c.handle)}</span>
                </div>
                <div className={s.body}>
                  <div className={s.head}>
                    <span className={s.handle}>{c.handle}</span>
                    <span className={s.time}>· {c.time}</span>
                  </div>
                  <div className={s.text}>{c.text}</div>
                  <div className={s.actions}>
                    <button type="button" className={s.actionBtn} onClick={() => showToast('Ответить')}>Ответить</button>
                    <span className={s.replyDrop}>Все ответы <ChevronDown size={12}/></span>
                    <span className={s.actionIcon}><ThumbUpIcon size={18}/></span>
                    <span className={s.actionIcon}><ThumbDownIcon size={18}/></span>
                    <span className={s.actionIcon}><HeartIcon size={18}/></span>
                    <span className={s.actionIcon}><KebabIcon size={16}/></span>
                  </div>
                </div>
                <div className={s.right}>
                  <div className={s.rightInfo}>
                    <div className={s.rightOn}>Комментарий к каналу</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
