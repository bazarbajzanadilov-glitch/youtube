import { useState, useContext } from 'react'
import s from './Screen4Community.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { FilterIcon, ChevronDown, ThumbUpIcon, ThumbDownIcon, HeartIcon, KebabIcon, AnimeThumb } from './icons.jsx'

const TABS = ['Комментарии', 'На проверке']
const BASE_COMMENTS = [
  ['@darth-lord-revan49...', '3 месяца назад', "If this isn't the persona 6 battle theme I'm crashing out", 1],
  ['@RoseanAshman', '6 месяцев назад', 'why is it so jolly', 1],
  ['@Hajile-430', '7 месяцев назад', 'This fight was cinema. An unstoppable duos first fight while the curse they are fighting just laughs at them.', 0],
  ['@yagamiblack5', '8 месяцев назад', 'Good music keeps fans alive.', 4],
  ['@HarunaWestbrook', '1 год назад', 'Rly looks like a horror film soundtrack but for jjk.', 5],
  ['@Sergei2099', '1 год назад', 'Brother who sad nostalgic?', 3],
  ['@AnnoNimo89', '1 год назад', 'Bro this is the best second wave inspired by Geass Coding (CLOCK)', 1],
  ['@RealKai-vg', '1 год назад', 'wow', 1],
  ['@daviswhittle', '1 год назад', 'I looked to the X-rd part for a long time and finally found it.', 1],
  ['@itsekoo', '1 год назад', 'My old kiddos are from Houshou pirate-rs', 1],
  ['@MidoriIku', '1 год назад', 'Joe died.dazaii. dazai.', 0],
  ['@JaspersGarden75', '1 год назад', 'Best part the part where the music is somewhat helpful or supporting', 0],
  ['@Adventure23', '1 год назад', 'I dirt that you should buy bullets.', 7],
  ['@trapamore', '1 год назад', 'Bruh ..., the flute sends me to another reality', 5],
  ['@CrashRtwttr', '1 год назад', 'this is a bunky 5 baked.', 24],
  ['@KutterNicc', '1 год назад', 'The show is amazing first time here', 1],
]
const COMMENTS = [...BASE_COMMENTS, ...BASE_COMMENTS].map(([handle, time, text, likes], i) => ({ handle, time, text, likes, id: i }))

export default function Screen4Community() {
  const { showToast } = useContext(NavContext)
  const [activeTab, setActiveTab] = useState(0)
  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="community"/>
      <div className={s.main}>
        <h1 className={s.title}>Сообщество</h1>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button key={t} type="button" className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`} onClick={() => { setActiveTab(i); showToast(t) }}>{t}</button>
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

        <div className={s.commentList}>
          {COMMENTS.map((c) => (
            <div key={c.id} className={s.commentRow}>
              <div className={s.checkbox}/>
              <div className={s.avatar}><AnimeThumb/></div>
              <div className={s.body}>
                <div className={s.head}>
                  <span className={s.handle}>{c.handle}</span>
                  <span className={s.time}>· {c.time}</span>
                </div>
                <div className={s.text}>{c.text}</div>
                <div className={s.actions}>
                  <button type="button" className={s.actionBtn} onClick={() => showToast('Ответить')}>Ответить</button>
                  <span className={s.replyDrop}>Все ответы <ChevronDown size={12}/></span>
                  <span className={s.actionIcon}><ThumbUpIcon size={18}/> {c.likes || ''}</span>
                  <span className={s.actionIcon}><ThumbDownIcon size={18}/></span>
                  <span className={s.actionIcon}><HeartIcon size={18}/></span>
                  <span className={s.actionIcon}><KebabIcon size={16}/></span>
                </div>
              </div>
              <div className={s.right}>
                <div className={s.rightThumb}><AnimeThumb/></div>
                <div className={s.rightInfo}>
                  <div className={s.rightOn}>Комментарий к видео:</div>
                  <div className={s.rightTitle}>Itadori and Toudou vs Hanami OST song</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
