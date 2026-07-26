import { useContext } from 'react'
import s from './SidebarCompact.module.css'
import { NavContext } from './NavContext.js'
import { useChannel } from '../storage/useChannel.js'
import ChannelAvatar from '../components/ChannelAvatar.jsx'
import { SIDEBAR_ITEMS, SidebarFeedbackIcon } from './sidebarItems.js'

export default function SidebarCompact({ active = 'home' }) {
  const { go, showToast } = useContext(NavContext)
  const { channel } = useChannel()
  return (
    <div className={s.sidebar}>
      <ChannelAvatar className={s.sideAvatar} src={channel.avatar} />
      <div className={s.sideScroll}>
        {SIDEBAR_ITEMS.map(({ key, label, Icon, ActiveIcon }) => {
          const CurrentIcon = active === key ? ActiveIcon : Icon
          return (
            <button
              key={key}
              type="button"
              title={label}
              className={`${s.sideItem} ${active === key ? s.sideActive : ''}`}
              onClick={() => go(key)}
              aria-label={label}
              aria-current={active === key ? 'page' : undefined}
            >
              <CurrentIcon />
            </button>
          )
        })}
        <button
          type="button"
          className={s.sideItem}
          onClick={() => showToast('Отправить отзыв')}
          aria-label="Отправить отзыв"
          title="Отправить отзыв"
        >
          <SidebarFeedbackIcon />
        </button>
      </div>
    </div>
  )
}
