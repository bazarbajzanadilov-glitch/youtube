import { useState, useContext, useRef } from 'react'
import s from './Screen9AudioLibrary.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  InfoIcon, FilterIcon, PlayIcon, StarIcon, ChevronDown, ChevronLeft, ChevronRight,
  PageFirst, PageLast,
} from './icons.jsx'

const TABS = ['Музыка', 'Звуковые эффекты', 'Избранное']
const RAIL_WIDTH = 2050

const TRACKS = [
  { name: 'Tonight Again', genre: 'Поп', mood: 'Романтика', artist: 'Rod Kim (feat. Mostly Moss)', dur: '2:39', date: 'май 2026 г.' },
  { name: 'The Fog', genre: 'Поп', mood: 'Романтика', artist: 'Trey Xavier, Rod Kim', dur: '3:55', date: 'май 2026 г.' },
  { name: 'Taught Her How To Leave', genre: 'Кантри и фолк', mood: 'Романтика', artist: 'Bill Douglas', dur: '3:38', date: 'май 2026 г.' },
  { name: 'Working', genre: "R'n'B и соул", mood: 'Романтика', artist: 'Cory Barker (feat. Jordan King)', dur: '3:10', date: 'май 2026 г.' },
  { name: 'Tiny Shell', genre: 'Поп', mood: 'Романтика', artist: 'Blue Deer, Nyles Lannon', dur: '4:31', date: 'май 2026 г.' },
  { name: 'Turn In The Sun', genre: 'Альтернатива', mood: 'Вдохновение', artist: 'Simon Herody', dur: '3:27', date: 'май 2026 г.' },
  { name: 'To The End Of The World', genre: 'Поп', mood: 'Вдохновение', artist: 'National Sweetheart', dur: '4:04', date: 'май 2026 г.' },
  { name: 'Through The Night (feat. Devyn Rush)', genre: 'Поп', mood: 'Вдохновение', artist: 'Blue Deer', dur: '3:58', date: 'май 2026 г.' },
  { name: 'Scratches On The B-Side', genre: 'Поп', mood: 'Меланхолия', artist: 'National Sweetheart', dur: '3:06', date: 'май 2026 г.' },
  { name: 'Find My Way (feat. Luqman Frank)', genre: "R'n'B и соул", mood: 'Вдохновение', artist: 'Blue Deer', dur: '3:28', date: 'май 2026 г.' },
  { name: 'Chase The Sun', genre: 'Поп', mood: 'Вдохновение', artist: 'Bel Tempo', dur: '3:23', date: 'май 2026 г.' },
  { name: 'Ten', genre: 'Хип-хоп и рэп', mood: 'Романтика', artist: 'Anno Domini Beats', dur: '2:41', date: 'май 2026 г.' },
  { name: 'Bad Memory (feat. Devyn Rush)', genre: 'Поп', mood: 'Романтика', artist: 'Blue Deer', dur: '3:19', date: 'май 2026 г.' },
  { name: 'Be The One', genre: 'Поп', mood: 'Вдохновение', artist: 'Late Verb', dur: '3:21', date: 'май 2026 г.' },
  { name: 'Delirium', genre: 'Хип-хоп и рэп', mood: 'Вдохновение', artist: 'Anno Domini Beats', dur: '2:35', date: 'май 2026 г.' },
  { name: 'Way Back Home', genre: 'Альтернатива', mood: 'Вдохновение', artist: 'Simon Herody', dur: '3:41', date: 'май 2026 г.' },
  { name: 'Appearing Nowhere (feat. Rusty James Miller)', genre: 'Поп', mood: 'Вдохновение', artist: 'Zenith Bikini', dur: '4:28', date: 'апр. 2026 г.' },
  { name: 'Willow Gozilla (feat. Rusty James Miller)', genre: 'Поп', mood: 'Романтика', artist: 'Zenith Bikini', dur: '2:16', date: 'апр. 2026 г.' },
  { name: 'Back To The Start', genre: 'Танцы и электроника', mood: 'Меланхолия', artist: 'Patrick Jordan Patrikios', dur: '2:30', date: 'апр. 2026 г.' },
  { name: 'Eyes', genre: 'Танцы и электроника', mood: 'Меланхолия', artist: 'Patrick Jordan Patrikios', dur: '3:10', date: 'апр. 2026 г.' },
  { name: 'After all this time', genre: 'Танцы и электроника', mood: 'Меланхолия', artist: 'Patrick Jordan Patrikios', dur: '2:37', date: 'апр. 2026 г.' },
  { name: 'Visions', genre: 'Танцы и электроника', mood: 'Вдохновение', artist: 'Patrick Jordan Patrikios', dur: '2:28', date: 'апр. 2026 г.' },
  { name: 'Time of your life', genre: 'Танцы и электроника', mood: 'Меланхолия', artist: 'Patrick Jordan Patrikios', dur: '2:44', date: 'апр. 2026 г.' },
  { name: 'Yesterdays', genre: 'Кантри и фолк', mood: 'Романтика', artist: 'Blue Deer', dur: '3:38', date: 'апр. 2026 г.' },
  { name: 'Where I Stand (feat. Anahita Skye)', genre: 'Кантри и фолк', mood: 'Вдохновение', artist: 'Blue Deer', dur: '4:00', date: 'апр. 2026 г.' },
  { name: 'House Of Cards', genre: 'Кантри и фолк', mood: 'Романтика', artist: 'Blue Deer', dur: '3:18', date: 'апр. 2026 г.' },
  { name: 'Talk To Me (feat. Devyn Rush)', genre: 'Кантри и фолк', mood: 'Вдохновение', artist: 'Blue Deer', dur: '3:24', date: 'апр. 2026 г.' },
  { name: 'Foolish Notions', genre: 'Кантри и фолк', mood: 'Вдохновение', artist: 'Blue Deer', dur: '3:11', date: 'апр. 2026 г.' },
  { name: 'Highway whispers', genre: 'Рок и фолк', mood: 'Вдохновение', artist: 'Patrick Jordan Patrikios', dur: '3:48', date: 'апр. 2026 г.' },
  { name: 'Open Road', genre: 'Рок и фолк', mood: 'Вдохновение', artist: 'Patrick Jordan Patrikios', dur: '3:32', date: 'апр. 2026 г.' },
]

const LicenseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.276 4.001 12.073 4h-.349c-1.025.005-2.05.022-3.074.052-.885.027-1.829.067-2.655.127-.797.058-1.57.141-2.064.274a3.51 3.51 0 00-2.477 2.476l.966.26-.966-.258-.084.351c-.182.862-.271 1.966-.316 2.846-.03.573-.047 1.147-.053 1.72l-.001.11v.194c.006.573.024 1.147.054 1.72.052 1.004.16 2.303.4 3.197a3.51 3.51 0 002.477 2.477c.494.133 1.267.216 2.064.274.885.06 1.77.102 2.655.127 1.025.03 2.05.047 3.074.052l.203.001h.146l.203-.001c1.025-.005 2.05-.022 3.074-.052a65.9 65.9 0 002.655-.127c.797-.058 1.57-.141 2.064-.274a3.51 3.51 0 002.477-2.475c.24-.895.348-2.195.4-3.2.03-.573.048-1.147.053-1.72l.001-.11v-.082l-.001-.111a41.989 41.989 0 00-.053-1.72c-.052-1.004-.16-2.304-.4-3.198a3.51 3.51 0 00-2.477-2.476c-.494-.133-1.267-.216-2.064-.274a62.01 62.01 0 00-2.655-.127 124.41 124.41 0 00-3.074-.052Zm-.543 2L11.932 6h.335c1.008.005 2.016.022 3.023.052.857.023 1.713.064 2.568.123.813.059 1.406.134 1.692.211h.002a1.51 1.51 0 011.062 1.062v.002c.18.666.282 1.772.335 2.782.021.418.036.836.044 1.255.003.161.006.291.006.379l.001.102v.064l-.001.102c-.005.545-.022 1.09-.05 1.634-.053 1.01-.155 2.116-.335 2.782v.002a1.51 1.51 0 01-1.062 1.063h-.002c-.286.076-.879.15-1.692.21-.855.06-1.711.1-2.568.124-1.007.029-2.014.045-3.023.05l-.199.001h-.136l-.199-.001a122.855 122.855 0 01-3.023-.051 61.138 61.138 0 01-2.568-.123c-.813-.059-1.406-.134-1.692-.211h-.002a1.51 1.51 0 01-1.062-1.062v-.002c-.18-.666-.283-1.772-.335-2.782-.026-.49-.038-.935-.044-1.255-.003-.161-.006-.291-.006-.379L3 12.032v-.166c.006-.545.023-1.09.051-1.634.052-1.01.155-2.116.335-2.782v-.002a1.51 1.51 0 011.062-1.063h.002c.286-.076.879-.15 1.692-.21.855-.059 1.711-.1 2.568-.124 1.007-.03 2.014-.046 3.023-.05ZM15 12l-5-3v6l5-3Z"/>
  </svg>
)

export default function Screen9AudioLibrary() {
  const { showToast } = useContext(NavContext)
  const [activeTab, setActiveTab] = useState(0)
  const tableScrollRef = useRef(null)
  const fixedScrollRef = useRef(null)
  const syncLockRef = useRef(false)

  const syncScroll = (source, target) => {
    if (!source?.current || !target?.current) return
    if (syncLockRef.current) return
    syncLockRef.current = true
    target.current.scrollLeft = source.current.scrollLeft
    requestAnimationFrame(() => {
      syncLockRef.current = false
    })
  }

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="audio"/>
      <div className={s.main}>
        <h1 className={s.title}>Фонотека</h1>

        <div className={s.hScroll} ref={tableScrollRef} onScroll={() => syncScroll(tableScrollRef, fixedScrollRef)}>
          <div className={s.contentRail}>
            <div className={s.banner}>
              <span className={s.bannerIcon}><InfoIcon/></span>
              <span className={s.bannerText}>Бесплатная музыка и звуковые эффекты, которые можно использовать в своих видео на YouTube.</span>
              <div className={s.bannerActions}>
                <button type="button" className={s.bannerBtn} onClick={() => showToast('Подробнее')}>Подробнее</button>
                <button type="button" className={s.bannerBtn} onClick={() => showToast('OK')}>OK</button>
              </div>
            </div>

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

            <button type="button" className={s.searchRow} onClick={() => showToast('Поиск и фильтры')}>
              <span className={s.filterIcon} aria-hidden><FilterIcon/></span>
              <span className={s.searchPlaceholder}>Поиск и фильтры</span>
            </button>

            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.iconCell}/>
                  <th className={s.starCell}/>
                  <th>Название трека</th>
                  <th>Жанр</th>
                  <th>Настроение</th>
                  <th>Исполнитель</th>
                  <th>Длительность</th>
                  <th>Тип лицензии</th>
                  <th className={s.sorted}>Дата добавления v</th>
                </tr>
              </thead>
              <tbody>
                {TRACKS.map((track, i) => (
                  <tr key={`${track.name}-${i}`} className={s.row}>
                    <td className={s.iconCell}>
                      <button type="button" className={s.iconBtn} onClick={() => showToast(`Воспроизведение: ${track.name}`)} aria-label="Воспроизвести">
                        <PlayIcon size={18}/>
                      </button>
                    </td>
                    <td className={s.starCell}>
                      <button type="button" className={s.iconBtn} onClick={() => showToast(`В избранное: ${track.name}`)} aria-label="В избранное">
                        <StarIcon size={16}/>
                      </button>
                    </td>
                    <td className={s.trackName}>{track.name}</td>
                    <td>{track.genre}</td>
                    <td>{track.mood}</td>
                    <td>{track.artist}</td>
                    <td>{track.dur}</td>
                    <td><span className={s.licenseIcon}><LicenseIcon/></span></td>
                    <td>{track.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={s.pagination}>
              <div className={s.footerLinks}>
                <button type="button" className={s.footerLink} onClick={() => showToast('Условия использования')}>Условия использования</button>
                <button type="button" className={s.footerLink} onClick={() => showToast('Отзыв о Фонотеке')}>Отзыв о Фонотеке</button>
              </div>
              <div className={s.paginationRight}>
                <div className={s.perPage}>
                  <span>Строк на странице:</span>
                  <button type="button" className={s.perPageVal} onClick={() => showToast('Строк на странице')}>
                    30 <ChevronDown size={14}/>
                  </button>
                </div>
                <span>1-30 из примерно 877</span>
                <div className={s.pageNav}>
                  <button type="button" className={s.pageBtn} onClick={() => showToast('Первая страница')} aria-label="Первая страница"><PageFirst/></button>
                  <button type="button" className={s.pageBtn} onClick={() => showToast('Назад')} aria-label="Назад"><ChevronLeft/></button>
                  <button type="button" className={s.pageBtn} onClick={() => showToast('Вперед')} aria-label="Вперед"><ChevronRight/></button>
                  <button type="button" className={s.pageBtn} onClick={() => showToast('Последняя страница')} aria-label="Последняя страница"><PageLast/></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={s.fixedScrollbar}>
          <div className={s.fixedScrollbarTrack} ref={fixedScrollRef} onScroll={() => syncScroll(fixedScrollRef, tableScrollRef)}>
            <div className={s.fixedScrollbarContent} style={{ width: `${RAIL_WIDTH}px` }}/>
          </div>
        </div>
      </div>
    </div>
  )
}
