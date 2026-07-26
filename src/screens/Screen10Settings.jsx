import { useState, useContext, useId } from 'react'
import s from './Screen10Settings.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { HelpIcon, ChevronDown } from './icons.jsx'
import { useChannel } from '../storage/useChannel.js'
import ChannelAvatar from '../components/ChannelAvatar.jsx'

const MENU = ['Общие', 'Канал', 'Загрузка видео', 'Разрешения', 'Модерация сообщества', 'Соглашения']

const Toggle = ({ on, label }) => (
  <div className={s.toggleRow}>
    <span className={s.toggleLabel}>{label}</span>
    <button
      type="button"
      className={`${s.toggle} ${on ? s.toggleOn : ''}`}
      aria-pressed={on}
      aria-readonly="true"
      disabled
    >
      <span className={s.toggleThumb}/>
    </button>
  </div>
)

const Field = ({ label, hint, children }) => (
  <div className={s.field}>
    <div className={s.fieldLabel}>{label}</div>
    {children}
    {hint ? <div className={s.fieldHint}>{hint}</div> : null}
  </div>
)

const Select = ({ label, value }) => (
  <button type="button" className={s.selectField} disabled>
    <span className={s.selectLabel}>{label}</span>
    <span className={s.selectValue}>
      {value}
      <span className={s.selectChev}><ChevronDown size={20}/></span>
    </span>
  </button>
)

const COUNTRY_LABELS = {
  KZ: 'Казахстан',
  RU: 'Россия',
  US: 'США',
  DE: 'Германия',
  BR: 'Бразилия',
  IN: 'Индия',
}

function PaneGeneral({ showToast }) {
  return (
    <>
      <div className={s.fieldLabel}>
        Единицы измерения по умолчанию{' '}
        <button type="button" className={s.helpIconBtn} onClick={() => showToast('Справка')} aria-label="Справка">
          <HelpIcon size={14}/>
        </button>
      </div>
      <Select label="Валюта" value="доллар США (USD)"/>
    </>
  )
}

function PaneChannel({ channel }) {
  return (
    <>
      <Field label="Название канала">
        <input
          type="text"
          className={s.input}
          value={channel.channelName}
          readOnly
        />
      </Field>
      <Field label="Страна проживания" hint="Выберите страну, в которой вы зарегистрированы как пользователь.">
        <Select label="Страна" value={COUNTRY_LABELS[channel.country] || 'Казахстан'}/>
      </Field>
      <Field label="Ключевые слова" hint="Через запятую укажите слова, которые описывают содержание канала.">
        <input type="text" className={s.input} defaultValue="trading, income, market breakdown" readOnly/>
      </Field>
    </>
  )
}

function PaneUpload() {
  return (
    <>
      <Field label="Описание по умолчанию" hint="Шаблон описания, который будет применяться к новым видео.">
        <textarea className={s.textarea} rows="3" defaultValue="Подпишитесь на канал, чтобы не пропускать новые видео!" readOnly/>
      </Field>
      <Field label="Видимость" hint="Этот параметр будет применяться по умолчанию.">
        <Select label="Доступ" value="Доступ по ссылке"/>
      </Field>
      <Toggle on label="Разрешить комментарии"/>
      <Toggle on label="Уведомлять подписчиков"/>
    </>
  )
}

function PanePermissions({ channel }) {
  return (
    <>
      <div className={s.note}>
        Управляйте тем, кто может работать с вашим каналом. Чтобы пригласить пользователя, добавьте его как менеджера в Brand Account.
      </div>
      <Field label="Текущие пользователи">
        <div className={s.userRow}>
          <ChannelAvatar className={s.userAvatar} src={channel.avatar} />
          <div className={s.userInfo}>
            <div className={s.userName}>{channel.channelName}</div>
            <div className={s.userEmail}>creator@trading.local</div>
          </div>
          <span className={s.userRole}>Владелец</span>
        </div>
      </Field>
      <button type="button" className={s.linkBtn}>Управлять разрешениями</button>
    </>
  )
}

function PaneModeration() {
  return (
    <>
      <Toggle on label="Удерживать потенциально неуместные комментарии для проверки"/>
      <Toggle on={false} label="Удерживать комментарии со ссылками"/>
      <Field label="Заблокированные слова" hint="Через запятую укажите слова или фразы, которые будут блокироваться.">
        <textarea className={s.textarea} rows="2" placeholder="спам, реклама" readOnly/>
      </Field>
    </>
  )
}

function PaneAgreements() {
  return (
    <>
      <div className={s.note}>
        Здесь хранятся ваши соглашения с YouTube — Условия использования, Политика конфиденциальности и партнёрское соглашение.
      </div>
      <div className={s.agrRow}>
        <span>Условия использования YouTube</span>
        <button type="button" className={s.linkBtn}>Открыть</button>
      </div>
      <div className={s.agrRow}>
        <span>Партнёрская программа YouTube</span>
        <button type="button" className={s.linkBtn}>Открыть</button>
      </div>
      <div className={s.agrRow}>
        <span>Политика конфиденциальности</span>
        <button type="button" className={s.linkBtn}>Открыть</button>
      </div>
    </>
  )
}

export default function Screen10Settings() {
  const { showToast, go } = useContext(NavContext)
  const { channel } = useChannel()
  const [menuIdx, setMenuIdx] = useState(0)
  const modalTitleId = useId()
  const closeModal = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    go('dashboard')
  }

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="settings"/>
      <div className={s.main}>
        <div className={s.backdropHeader}>
          <div className={s.backdropTitle}/>
          <div className={s.backdropAction}/>
        </div>
        <div className={s.backdropTabs}>
          <span className={`${s.backdropTab} ${s.backdropTabWide}`}/>
          <span className={`${s.backdropTab} ${s.backdropTabNarrow}`}/>
          <span className={`${s.backdropTab} ${s.backdropTabMedium}`}/>
        </div>
        <div className={s.backdropRow}>
          <div className={s.backdropCard}/>
          <div className={s.backdropCard}/>
        </div>
        <div className={s.backdropTable}/>
      </div>

      <div className={s.scrim} role="presentation" onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div
          className={s.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={s.modalHeader} id={modalTitleId}>Настройки</div>
          <div className={s.modalBody}>
            <div className={s.modalLeft}>
              {MENU.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className={`${s.menuItem} ${i === menuIdx ? s.menuItemActive : ''}`}
                  onClick={() => setMenuIdx(i)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className={s.modalRight}>
              {menuIdx === 0 && <PaneGeneral showToast={showToast}/>}
              {menuIdx === 1 && <PaneChannel channel={channel}/>}
              {menuIdx === 2 && <PaneUpload/>}
              {menuIdx === 3 && <PanePermissions channel={channel}/>}
              {menuIdx === 4 && <PaneModeration/>}
              {menuIdx === 5 && <PaneAgreements/>}
            </div>
          </div>
          <div className={s.modalFooter}>
            <button type="button" className={s.btnGhost} onClick={closeModal}>Закрыть</button>
            <button type="button" className={s.btnSave} onClick={() => go('admin')}>Открыть админку</button>
          </div>
        </div>
      </div>
    </div>
  )
}
