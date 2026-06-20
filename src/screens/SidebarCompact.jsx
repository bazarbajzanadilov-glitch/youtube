import { useContext } from 'react'
import s from './SidebarCompact.module.css'
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
  { key: 'copyright', label: 'Обнаружение контента', Icon: SideCopyright },
  { key: 'monetize', label: 'Монетизация', Icon: SideMonetize },
  { key: 'channel', label: 'Настройка канала', Icon: SideMagic },
  { key: 'audio', label: 'Фонотека', Icon: SideAudio },
]

export default function SidebarCompact({ active = 'home' }) {
  const { go, showToast } = useContext(NavContext)
  const { channel } = useChannel()
  const avatarUrl = channel.avatar || '/studio-assets/channel-avatar-reference.jpg'
  return (
    <div className={s.sidebar}>
      <div className={s.sideAvatar} style={{ backgroundImage: `url(${avatarUrl})` }}/>
      <div className={s.sideScroll}>
        {ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            className={`${s.sideItem} ${active === key ? s.sideActive : ''}`}
            onClick={() => go(key)}
            aria-label={label}
            aria-current={active === key ? 'page' : undefined}
          >
            <Icon/>
          </button>
        ))}
      </div>
      <div className={s.sideBottom}>
        <button type="button" className={s.sideItem} onClick={() => go('settings')} aria-label="Настройки" title="Настройки">
          <SideSettings/>
        </button>
        <button
          type="button"
          className={s.sideItem}
          onClick={() => showToast('Отправить отзыв')}
          aria-label="Отправить отзыв"
          title="Отправить отзыв"
        >
          <SideFeedback/>
        </button>
      </div>
    </div>
  )
}
