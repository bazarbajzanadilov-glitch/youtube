import { useState, useContext } from 'react'
import s from './Screen8bHomeTab.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { DragHandle, PlusIcon, HelpIcon } from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'

const TABS = ['Профиль', 'Вкладка "Главная"']

export default function Screen8bHomeTab() {
  const { go } = useContext(NavContext)
  const { videos } = useVideos()
  const [activeTab, setActiveTab] = useState(1)
  const previewVideos = videos.slice(0, 4)
  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="channel"/>
      <div className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Настройка канала</h1>
          <div className={s.actionsRight}>
            <button type="button" className={s.linkBtn}>Посмотреть на канале</button>
            <button type="button" className={s.cancel}>Отмена</button>
            <button type="button" className={s.publish}>Опубликовать</button>
          </div>
        </div>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`}
              onClick={() => {
                setActiveTab(i)
                if (i === 0) go('channel-profile')
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className={s.toggleSection}>
          <div className={s.toggleText}>
            <div className={s.toggleTitle}>Вкладка "Главная"</div>
            <div className={s.toggleSub}>На вкладке "Главная" можно упорядочивать разделы для ваших зрителей</div>
          </div>
          <button type="button" className={s.toggle} aria-label="Показывать вкладку Главная"><span className={s.toggleThumb}/></button>
        </div>

        <div className={s.layoutHead}>
          <div className={s.layoutTextWrap}>
            <div className={s.layoutTitle}>Разделы</div>
            <div className={s.layoutSub}>На главной странице канала можно добавить до 12 разделов. <HelpIcon size={14}/></div>
          </div>
          <button type="button" className={s.addBtn}><PlusIcon size={14}/>Добавить раздел</button>
        </div>

        <div className={s.sections}>
          <div className={s.section}>
            <span className={s.dragHandle}><DragHandle/></span>
            <div className={s.sectionBody}>
              <div className={s.sectionTitle2}>Для вас</div>
              <div className={s.sectionDesc}>В этом разделе зрителям показываются персональные рекомендации по вашим видео. <button type="button" className={s.linkInline}>Подробнее</button> <HelpIcon size={14}/></div>
            </div>
          </div>
          <div className={s.section}>
            <span className={s.dragHandle}><DragHandle/></span>
            <div className={s.sectionBody}><div className={s.sectionTitle2}>Видео ({videos.length})</div></div>
            <div className={s.thumbsRow}>
              {previewVideos.length === 0 ? (
                <span className={s.thumbsEmpty}>Нет видео</span>
              ) : previewVideos.map((v) => (
                <div className={s.thumb} key={v.id}>
                  {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                  <span className={s.thumbDur}>{v.duration}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={s.section}>
            <span className={s.dragHandle}><DragHandle/></span>
            <div className={s.sectionBody}><div className={s.sectionTitle2}>Shorts (0)</div><div className={s.sectionDesc}>Здесь будут показаны ваши видео Shorts, если они появятся на канале.</div></div>
          </div>
          <div className={s.section}>
            <span className={s.dragHandle}><DragHandle/></span>
            <div className={s.sectionBody}><div className={s.sectionTitle2}>Трансляции (0)</div><div className={s.sectionDesc}>В этом разделе можно показывать прямые эфиры, премьеры и записи трансляций.</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
