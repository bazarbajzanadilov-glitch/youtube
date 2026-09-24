import { useMemo } from 'react'
import v from './AdminVisual.module.css'
import b from './DashboardBlocksVisual.module.css'
import { InlineText, SaveStatus } from './InlineEdit.jsx'
import { useAutoSavedDraft } from './useAutoSavedDraft.js'

function avatarLetter(name) {
  return String(name || '').replace(/^@/, '').trim().slice(0, 1).toUpperCase() || '?'
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function Avatar({ color, name, onColor }) {
  return (
    <label className={b.avatar} style={{ backgroundColor: color || '#525252' }} title="Цвет аватара">
      {avatarLetter(name)}
      <input type="color" value={color || '#525252'} onChange={(event) => onColor(event.target.value)} />
    </label>
  )
}

/**
 * Карточки «Комментарии» и «Новые подписчики» с главной страницы:
 * правятся прямо на карточке и сохраняются сами.
 */
export default function DashboardBlocksVisual({ comments, subscribers, defaults, onSave, onOpen }) {
  const serverValue = useMemo(() => ({ comments, subscribers }), [comments, subscribers])
  const [draft, setDraft, status] = useAutoSavedDraft(serverValue, (value) => onSave({
    dashboardComments: value.comments,
    recentSubscribers: value.subscribers,
  }))
  const setList = (key, index, patch) => setDraft((current) => ({
    ...current,
    [key]: current[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
  }))
  const removeItem = (key, index) => setDraft((current) => ({
    ...current,
    [key]: current[key].filter((_, i) => i !== index),
  }))
  const addItem = (key, item) => setDraft((current) => ({ ...current, [key]: [...current[key], item] }))

  return (
    <div>
      <div className={v.bar}>
        <span className={v.where}>На сайте: «Главная», правая часть страницы. Видны первые 3 записи.</span>
        <div className={v.barRight}>
          <SaveStatus status={status} />
          <button
            type="button"
            className={b.textBtn}
            onClick={() => setDraft({ comments: defaults.comments.map((item) => ({ ...item })), subscribers: defaults.subscribers.map((item) => ({ ...item })) })}
          >
            Вернуть по умолчанию
          </button>
          <button type="button" className={v.openLink} onClick={onOpen}>Открыть главную →</button>
        </div>
      </div>
      <div className={b.grid}>
        <div className={b.card}>
          <h3 className={b.title}>Комментарии</h3>
          {draft.comments.map((comment, index) => (
            <div className={`${b.row} ${index >= 3 ? b.hidden : ''}`} key={comment.id || index}>
              <Avatar color={comment.avatarColor} name={comment.author} onColor={(avatarColor) => setList('comments', index, { avatarColor })} />
              <div className={b.body}>
                <div className={b.head}>
                  <InlineText className={b.author} value={comment.author || ''} placeholder="@автор" onChange={(author) => setList('comments', index, { author })} />
                  <span>•</span>
                  <InlineText className={b.age} value={comment.age || ''} placeholder="когда" onChange={(age) => setList('comments', index, { age })} />
                </div>
                <InlineText multiline value={comment.text || ''} placeholder="Текст комментария" onChange={(text) => setList('comments', index, { text })} />
              </div>
              <button type="button" className={v.remove} aria-label="Удалить комментарий" onClick={() => removeItem('comments', index)}>×</button>
            </div>
          ))}
          <button
            type="button"
            className={v.addSource}
            onClick={() => addItem('comments', { id: makeId('comment'), author: '@new.comment', age: 'только что', text: '', avatarColor: '#525252' })}
          >
            + Добавить комментарий
          </button>
        </div>

        <div className={b.card}>
          <h3 className={b.title}>Новые подписчики</h3>
          <div className={b.sub}>Последние 90 дней</div>
          {draft.subscribers.map((subscriber, index) => (
            <div className={`${b.row} ${index >= 3 ? b.hidden : ''}`} key={subscriber.id || index}>
              <Avatar color={subscriber.avatarColor} name={subscriber.name} onColor={(avatarColor) => setList('subscribers', index, { avatarColor })} />
              <div className={b.body}>
                <InlineText className={b.author} value={subscriber.name || ''} placeholder="Имя" onChange={(name) => setList('subscribers', index, { name })} />
                <InlineText className={b.age} value={subscriber.count || ''} placeholder="0 подписчиков" onChange={(count) => setList('subscribers', index, { count })} />
              </div>
              <button type="button" className={v.remove} aria-label="Удалить подписчика" onClick={() => removeItem('subscribers', index)}>×</button>
            </div>
          ))}
          <button
            type="button"
            className={v.addSource}
            onClick={() => addItem('subscribers', { id: makeId('subscriber'), name: 'Новый подписчик', count: '0 подписчиков', avatarColor: '#525252' })}
          >
            + Добавить подписчика
          </button>
        </div>
      </div>
    </div>
  )
}
