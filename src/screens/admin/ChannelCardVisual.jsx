import c from './ChannelCardVisual.module.css'
import { InlineNumber, InlineText } from './InlineEdit.jsx'
import ChannelAvatar from '../../components/ChannelAvatar.jsx'
import { EditIcon } from '../icons.jsx'
import { buildChannelHandle } from '../../lib/channelHandle.js'
import { formatDateLong } from '../../lib/analyticsFormat.js'
import { getAlmatyDateISO } from '../../lib/almatyDate.js'
import { STUDIO_IMAGE_ACCEPT } from '../../lib/studioImage.js'

const COUNTRIES = [
  { code: 'KZ', label: 'Казахстан' },
  { code: 'RU', label: 'Россия' },
  { code: 'US', label: 'США' },
  { code: 'DE', label: 'Германия' },
  { code: 'BR', label: 'Бразилия' },
  { code: 'IN', label: 'Индия' },
]

function declineSubscribers(count) {
  const value = Math.abs(Math.round(Number(count) || 0))
  const lastTwo = value % 100
  const last = value % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'подписчиков'
  if (last === 1) return 'подписчик'
  if (last >= 2 && last <= 4) return 'подписчика'
  return 'подписчиков'
}

/**
 * Канал в виде шапки канала: аватар, название, подписчики, страна, дата,
 * монетизация — всё меняется кликом прямо здесь.
 */
export default function ChannelCardVisual({
  channel,
  dirty,
  saving,
  processing,
  onChange,
  onAvatarChange,
  onAvatarRemove,
  onSave,
}) {
  return (
    <div className={c.card}>
      <div className={c.top}>
        <label className={c.avatar} title="Сменить аватар">
          <ChannelAvatar className={c.avatarImg} src={channel.avatar} />
          <span className={c.avatarBadge} aria-hidden="true"><EditIcon size={14} /></span>
          {processing ? <span className={c.avatarBusy}>…</span> : null}
          <input type="file" accept={STUDIO_IMAGE_ACCEPT} onChange={onAvatarChange} disabled={processing} />
        </label>
        <div className={c.info}>
          <InlineText className={c.name} value={channel.channelName || ''} placeholder="Название канала" onChange={(channelName) => onChange({ channelName })} />
          <span className={c.meta}>{buildChannelHandle(channel)}</span>
          <span className={c.subs}>
            <InlineNumber
              value={Number(channel.subscriberCount) || 0}
              format={(value) => value.toLocaleString('ru-RU')}
              label="Подписчики"
              onChange={(subscriberCount) => onChange({ subscriberCount })}
            />{' '}
            {declineSubscribers(channel.subscriberCount)}
          </span>
          {channel.avatar ? <button type="button" className={c.textBtn} onClick={onAvatarRemove}>Убрать аватар</button> : null}
        </div>
      </div>

      <div className={c.row}>
        <span className={c.rowLabel}>Страна</span>
        <div className={c.chips}>
          {COUNTRIES.map((country) => (
            <button
              key={country.code}
              type="button"
              className={`${c.chip} ${channel.country === country.code ? c.chipActive : ''}`}
              aria-pressed={channel.country === country.code}
              onClick={() => onChange({ country: country.code })}
              title={country.label}
            >
              {country.label}
            </button>
          ))}
        </div>
      </div>

      <div className={c.row}>
        <span className={c.rowLabel}>На YouTube с</span>
        <label className={c.date}>
          {channel.joinDate ? formatDateLong(channel.joinDate) : 'выбрать дату'}
          <span className={c.pencil} aria-hidden="true"><EditIcon size={12} /></span>
          <input
            type="date"
            max={getAlmatyDateISO()}
            value={channel.joinDate || ''}
            onChange={(event) => event.target.value && onChange({ joinDate: event.target.value })}
            aria-label="Дата создания канала"
          />
        </label>
      </div>

      <div className={c.row}>
        <span className={c.rowLabel}>Монетизация</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!channel.monetizationEnabled}
          className={`${c.switch} ${channel.monetizationEnabled ? c.switchOn : ''}`}
          onClick={() => onChange({ monetizationEnabled: !channel.monetizationEnabled })}
        >
          <span className={c.knob} />
          {channel.monetizationEnabled ? 'Включена $' : 'Выключена'}
        </button>
      </div>

      <button type="button" className={`${c.save} ${dirty ? c.saveDirty : ''}`} onClick={onSave} disabled={!dirty || saving || processing}>
        {saving ? 'Сохранение…' : dirty ? 'Сохранить канал' : 'Сохранено ✓'}
      </button>
    </div>
  )
}
