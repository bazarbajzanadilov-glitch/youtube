import { useContext } from 'react'
import s from './SidebarExpanded.module.css'
import { NavContext } from './NavContext.js'
import { useChannel } from '../storage/useChannel.js'
import {
  SideHome, SideContent, SideAnalytics, SideCommunity, SideSubtitles,
  SideCopyright, SideMonetize, SideMagic, SideAudio, SideSettings, SideFeedback,
} from './icons.jsx'

const ITEMS = [
  { key: 'home', label: 'Главная', Icon: SideHome },
  { key: 'content', label: 'Контент', Icon: SideContent },
  { key: 'analytics', label: 'Аналитика', Icon: SideAnalytics },
  { key: 'community', label: 'Сообщество', Icon: SideCommunity },
  { key: 'subtitles', label: 'Субтитры', Icon: SideSubtitles },
  { key: 'copyright', label: 'Обнаружение контен...', Icon: SideCopyright },
  { key: 'monetize', label: 'Монетизация', Icon: SideMonetize },
  { key: 'channel', label: 'Настройка канала', Icon: SideMagic },
  { key: 'audio', label: 'Фонотека', Icon: SideAudio },
]

export default function SidebarExpanded({ active = 'monetize' }) {
  const { go, showToast } = useContext(NavContext)
  const { channel } = useChannel()
  const avatarUrl = channel.avatar || '/studio-assets/channel-avatar-reference.jpg'
  return (
    <div className={s.sidebar}>
      <div className={s.channel}>
        <div className={s.channelAvatar} style={{ backgroundImage: `url(${avatarUrl})` }}/>
        <div className={s.channelName}>Ваш канал</div>
        <div className={s.channelHandle}>{channel.channelName}</div>
      </div>
      <div className={s.itemsScroll}>
        <div className={s.items}>
          {ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`${s.item} ${active === key ? s.active : ''}`}
              onClick={() => go(key)}
              aria-current={active === key ? 'page' : undefined}
            >
              <span className={s.itemIcon}><Icon/></span>
              <span className={s.itemLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.bottom}>
        <button type="button" className={`${s.item} ${active === 'settings' ? s.active : ''}`} onClick={() => go('settings')}>
          <span className={s.itemIcon}><SideSettings/></span>
          <span className={s.itemLabel}>Настройки</span>
        </button>
        <button type="button" className={s.item} onClick={() => showToast('Отправить отзыв')}>
          <span className={s.itemIcon}><SideFeedback/></span>
          <span className={s.itemLabel}>Отправить отзыв</span>
        </button>
      </div>
    </div>
  )
}
