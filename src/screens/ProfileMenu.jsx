import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MdArrowBack,
  MdCheck,
  MdChevronRight,
  MdLogout,
  MdOutlineAccountBox,
  MdOutlineDarkMode,
  MdOutlineFeedback,
  MdOutlineHome,
  MdSwitchAccount,
} from 'react-icons/md'
import styles from './ProfileMenu.module.css'

const THEME_LABELS = {
  system: 'как на устройстве',
  dark: 'тёмная',
  light: 'светлая',
}

const THEME_OPTIONS = [
  { value: 'system', label: 'Как на устройстве' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'light', label: 'Светлая' },
]

function MenuRow({ icon: Icon, label, trailing = null, onClick, href }) {
  const content = (
    <>
      <span className={styles.itemIcon} aria-hidden="true"><Icon size={24} /></span>
      <span className={styles.itemLabel}>{label}</span>
      {trailing ? <span className={styles.itemTrailing} aria-hidden="true">{trailing}</span> : null}
    </>
  )

  if (href) {
    return (
      <a className={styles.item} href={href} role="menuitem">
        {content}
      </a>
    )
  }

  return (
    <button className={styles.item} type="button" role="menuitem" onClick={onClick}>
      {content}
    </button>
  )
}

function buildChannelHandle(channel) {
  const storedHandle = channel.handle || channel.channelHandle || channel.customUrl
  if (storedHandle) return storedHandle.startsWith('@') ? storedHandle : `@${storedHandle}`

  const compactName = String(channel.channelName || 'YouTube')
    .trim()
    .replace(/\s+/g, '_')
  return `@${compactName}`
}

export default function ProfileMenu({
  avatarUrl,
  channel,
  themePreference,
  onThemeChange,
  onNavigate,
  onToast,
  onClose,
}) {
  const [view, setView] = useState('account')
  const menuRef = useRef(null)
  const handle = useMemo(() => buildChannelHandle(channel), [channel])

  useEffect(() => {
    const firstItem = menuRef.current?.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }, [view])

  const navigate = (target) => {
    onNavigate(target)
    onClose()
  }

  const notify = (message) => {
    onToast(message)
    onClose()
  }

  if (view === 'theme') {
    return (
      <div ref={menuRef} className={`${styles.menu} ${styles.themeMenu}`} role="menu" aria-label="Выбор темы">
        <div className={styles.themeHeader}>
          <button
            className={styles.backButton}
            type="button"
            role="menuitem"
            aria-label="Назад"
            onClick={() => setView('account')}
          >
            <MdArrowBack size={24} />
          </button>
          <h2>Тема</h2>
        </div>
        <p className={styles.themeHint}>Настройка будет применена только в этом браузере.</p>
        <div className={styles.themeOptions}>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={styles.themeOption}
              type="button"
              role="menuitemradio"
              aria-checked={themePreference === option.value}
              onClick={() => {
                onThemeChange(option.value)
                onClose()
              }}
            >
              <span className={styles.checkSlot} aria-hidden="true">
                {themePreference === option.value ? <MdCheck size={22} /> : null}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={menuRef} className={styles.menu} role="menu" aria-label="Меню аккаунта">
      <div className={styles.accountHeader}>
        <div className={styles.accountAvatar} style={{ backgroundImage: `url(${avatarUrl})` }} aria-hidden="true" />
        <div className={styles.accountMeta}>
          <div className={styles.accountName}>{channel.channelName || 'YouTube Studio'}</div>
          <div className={styles.accountHandle}>{handle}</div>
        </div>
      </div>

      <div className={styles.section}>
        <MenuRow icon={MdOutlineAccountBox} label="Мой канал" onClick={() => navigate('channel')} />
        <MenuRow icon={MdOutlineHome} label="Главная" onClick={() => navigate('home')} />
        <MenuRow
          icon={MdSwitchAccount}
          label="Сменить аккаунт"
          trailing={<MdChevronRight size={24} />}
          onClick={() => notify('Смена аккаунта')}
        />
        <MenuRow icon={MdLogout} label="Выйти" href="/api/site-logout" />
      </div>

      <div className={styles.section}>
        <MenuRow
          icon={MdOutlineDarkMode}
          label={`Тема: ${THEME_LABELS[themePreference] || THEME_LABELS.dark}`}
          trailing={<MdChevronRight size={24} />}
          onClick={() => setView('theme')}
        />
        <MenuRow icon={MdOutlineFeedback} label="Отправить отзыв" onClick={() => notify('Отправить отзыв')} />
      </div>
    </div>
  )
}
