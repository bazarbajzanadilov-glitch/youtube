import { useMemo, useState, useContext } from 'react'
import s from './Screen5Subtitles.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { ChevronLeft, ChevronRight, PageFirst, PageLast } from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'
import { formatDate } from '../storage/videoStore.js'

const TABS = ['Все', 'Черновики', 'Опубликованные']

export default function Screen5Subtitles() {
  const { go } = useContext(NavContext)
  const { videos } = useVideos()
  const [activeTab, setActiveTab] = useState(0)
  const filteredVideos = useMemo(() => {
    if (activeTab === 1) return []
    return videos
  }, [videos, activeTab])

  const isDraftsTab = activeTab === 1
  const emptyLabel = isDraftsTab
    ? 'В разделе «Черновики» пока нет сохраненных субтитров.'
    : 'Нет видео для управления субтитрами.'

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="subtitles"/>
      <div className={s.main}>
        <h1 className={s.title}>Субтитры к видео на канале</h1>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button key={t} type="button" className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`} onClick={() => setActiveTab(i)}>
              {t}
            </button>
          ))}
        </div>

        {videos.length === 0 || filteredVideos.length === 0 ? (
          <div className={s.empty}>
            {emptyLabel}{' '}
            {!isDraftsTab ? <button type="button" className={s.emptyLink} onClick={() => go('admin')}>Добавьте видео в админке →</button> : null}
          </div>
        ) : (
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th>Видео</th>
                <th>Языки</th>
                <th>Дата изменения</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((v) => (
                <tr key={v.id} className={s.row}>
                  <td>
                    <div className={s.videoCell}>
                      <div className={s.thumb}>
                        {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                        <div className={s.thumbDur}>{v.duration}</div>
                      </div>
                      <div>
                        <div className={s.videoTitle}>{v.title}</div>
                        <div className={s.videoDesc}>Автоматические субтитры</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={s.langs}>Русский</span></td>
                  <td><span className={s.date}>{formatDate(v.date)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={s.pagination}>
          <span>{filteredVideos.length > 0 ? `1–${filteredVideos.length}` : '0'} из {filteredVideos.length}</span>
          <div className={s.pageNav}>
            <button type="button" className={s.pageBtn}><PageFirst/></button>
            <button type="button" className={s.pageBtn}><ChevronLeft/></button>
            <button type="button" className={s.pageBtn}><ChevronRight/></button>
            <button type="button" className={s.pageBtn}><PageLast/></button>
          </div>
        </div>
      </div>
    </div>
  )
}
