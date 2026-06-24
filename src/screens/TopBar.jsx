import { useContext, useRef } from 'react'
import s from './TopBar.module.css'
import { NavContext } from './NavContext.js'
import { YTLogo, Hamburger, SearchIcon, SupportChatIcon, HelpIcon, SparkleIcon, BellIcon, PlusBoxIcon } from './icons.jsx'
import { useChannel } from '../storage/useChannel.js'
import { beginDoubleHardReset } from '../lib/hardResetSite.js'

export default function TopBar() {
  const { showToast, toggleSidebar, go } = useContext(NavContext)
  const { channel } = useChannel()
  const searchRef = useRef(null)
  const avatarUrl = channel.avatar || '/studio-assets/trading-avatar.svg'

  async function handleHardReset() {
    showToast('Сброс кеша сайта')
    await new Promise((resolve) => setTimeout(resolve, 120))
    await beginDoubleHardReset()
  }

  return (
    <div className={s.topbar}>
      <button type="button" className={s.hamburger} onClick={toggleSidebar} aria-label="Меню">
        <Hamburger size={24}/>
      </button>
      <div className={s.logoWrap}>
        <YTLogo/>
      </div>
      <div className={s.searchWrap} role="search" onClick={() => searchRef.current?.focus()}>
        <span className={s.searchIcon}><SearchIcon size={20}/></span>
        <input
          ref={searchRef}
          className={s.searchInput}
          placeholder="Поиск на канале"
          aria-label="Поиск на канале"
          onKeyDown={(e) => e.key === 'Enter' && showToast('Поиск на канале')}
        />
      </div>
      <div className={s.topRight}>
        <button type="button" className={s.iconBtn} onClick={() => showToast('Чат с командой поддержки авторов')} aria-label="Чат с командой поддержки авторов"><SupportChatIcon size={24}/></button>
        <button type="button" className={s.iconBtn} onClick={() => showToast('Справка')} aria-label="Справка"><HelpIcon size={24}/></button>
        <button type="button" className={`${s.iconBtn} ${s.sparkleBtn}`} onClick={() => showToast('Спросить у Студии')} aria-label="Спросить у Студии"><SparkleIcon size={24}/></button>
        <button type="button" className={s.iconBtn} onClick={handleHardReset} aria-label="Уведомления"><BellIcon size={24}/></button>
        <button type="button" className={s.createBtn} onClick={() => go('admin')}><PlusBoxIcon size={24}/>Создать</button>
        <button type="button" className={s.avatarBtn} onClick={() => showToast('Аккаунт')} aria-label="Аккаунт">
          <div className={s.avatar} style={{ backgroundImage: `url(${avatarUrl})` }}/>
        </button>
      </div>
    </div>
  )
}
