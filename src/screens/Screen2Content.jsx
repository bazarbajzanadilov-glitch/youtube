import { useState, useContext } from 'react'
import s from './Screen2Content.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { FilterIcon, ChevronDown, ChevronLeft, ChevronRight, PageFirst, PageLast } from './icons.jsx'
import { useVideos } from '../storage/useVideos.js'
import { formatDate, formatNumber, formatLikePct } from '../storage/videoStore.js'

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9"/>
    <path d="M3 12h18 M12 3a14 14 0 010 18 M12 3a14 14 0 000 18"/>
  </svg>
)

const TABS = ['Видео', 'Shorts', 'Трансляции', 'Записи', 'Плейлисты', 'Подкасты', 'Курсы', 'Рекламные кампании', 'Коллаборации']

export default function Screen2Content() {
  const { showToast, go } = useContext(NavContext)
  const { videos } = useVideos()
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="content"/>
      <div className={s.main}>
        <h1 className={s.pageTitle}>Контент на канале</h1>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`}
              onClick={() => { setActiveTab(i); showToast(t) }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className={s.filterRow}>
          <button type="button" className={s.filterIcon} onClick={() => showToast('Фильтр')} aria-label="Фильтр"><FilterIcon/></button>
          <span className={s.filterText}>Фильтр</span>
        </div>

        {videos.length === 0 ? (
          <div className={s.empty}>
            На канале пока нет видео.{' '}
            <button type="button" className={s.emptyLink} onClick={() => go('admin')}>Добавьте первое в админке →</button>
          </div>
        ) : (
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.checkCol}><div className={s.checkbox}/></th>
                <th>Видео</th>
                <th>Доступ</th>
                <th>Ограничения</th>
                <th className={s.thDate}>Дата ↓</th>
                <th className={s.right}>Просмотры</th>
                <th className={s.right}>Комментарии</th>
                <th className={s.right}>% «Нравится»</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className={s.row}>
                  <td className={s.checkCol}><div className={s.checkbox}/></td>
                  <td>
                    <div className={s.videoCell}>
                      <div className={s.thumb}>
                        {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                        <div className={s.thumbDur}>{v.duration}</div>
                      </div>
                      <div>
                        <div className={s.videoTitle}>{v.title}</div>
                        <div className={s.videoDesc}>Добавьте описание</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={s.accessCell}>
                      <span className={s.accessIcon}><GlobeIcon/></span>
                      Для всех
                    </div>
                  </td>
                  <td><span className={s.restriction}>Нет</span></td>
                  <td>
                    <div className={s.dateCell}>
                      <div className={s.d}>{formatDate(v.date)}</div>
                      <div className={s.pub}>Публикация</div>
                    </div>
                  </td>
                  <td className={s.numCell}>{formatNumber(v.views)}</td>
                  <td className={s.numCell}>0</td>
                  <td className={s.likeCell}>
                    {v.likePct == null ? (
                      <div className={s.likePct}>—</div>
                    ) : (
                      <>
                        <div className={s.likePct}>{formatLikePct(v.likePct)}</div>
                        <div className={s.likeBar}>
                          <div className={s.likeBarFill} style={{ width: `${(v.likePct * 100).toFixed(0)}%` }}/>
                        </div>
                        <div className={s.likeCount}>{formatNumber(v.likes)} отметок «Нравится»</div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={s.pagination}>
          <div className={s.perPage}>
            <span>Строк на странице:</span>
            <span className={s.perPageVal}>30 <ChevronDown size={14}/></span>
          </div>
          <span>1–{videos.length} из {videos.length}</span>
          <div className={s.pageNav}>
            <button type="button" className={s.pageBtn} onClick={() => showToast('Первая страница')} aria-label="Первая страница"><PageFirst/></button>
            <button type="button" className={s.pageBtn} onClick={() => showToast('Назад')} aria-label="Назад"><ChevronLeft/></button>
            <button type="button" className={s.pageBtn} onClick={() => showToast('Вперёд')} aria-label="Вперёд"><ChevronRight/></button>
            <button type="button" className={s.pageBtn} onClick={() => showToast('Последняя страница')} aria-label="Последняя страница"><PageLast/></button>
          </div>
        </div>
      </div>
    </div>
  )
}
