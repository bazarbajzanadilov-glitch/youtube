import { useContext } from 'react'
import s from './SidebarExpanded.module.css'
import { NavContext } from './NavContext.js'
import { useChannel } from '../storage/useChannel.js'
import ChannelAvatar from '../components/ChannelAvatar.jsx'
import { SIDEBAR_ITEMS, SidebarFeedbackIcon } from './sidebarItems.js'

export default function SidebarExpanded({ active = 'monetize' }) {
  const { go, showToast } = useContext(NavContext)
  const { channel } = useChannel()
  return (
    <div className={s.sidebar}>
      <div className={s.channel}>
        <ChannelAvatar className={s.channelAvatar} src={channel.avatar} />
        <div className={s.channelName}>Ваш канал</div>
        <div className={s.channelHandle}>{channel.channelName}</div>
      </div>
      <div className={s.itemsScroll}>
        <div className={s.items}>
          {SIDEBAR_ITEMS.map(({ key, label, expandedLabel, Icon, ActiveIcon }) => {
            const CurrentIcon = active === key ? ActiveIcon : Icon
            return (
              <button
                key={key}
                type="button"
                className={`${s.item} ${active === key ? s.active : ''}`}
                onClick={() => go(key)}
                aria-current={active === key ? 'page' : undefined}
              >
                <span className={s.itemIcon}><CurrentIcon /></span>
                <span className={s.itemLabel}>{expandedLabel || label}</span>
              </button>
            )
          })}
          <button type="button" className={s.item} onClick={() => showToast('Отправить отзыв')}>
            <span className={s.itemIcon}><SidebarFeedbackIcon /></span>
            <span className={s.itemLabel}>Отправить отзыв</span>
          </button>
        </div>
      </div>
    </div>
  )
}
