import { useContext, useMemo, useRef, useState } from 'react'
import s from './Screen11Admin.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  randomTitle, randomDuration,
  suggestRevenue, computeMetrics, generateVideoStats,
  formatNumber, formatMoney, formatLikePct,
} from '../storage/videoStore.js'
import { useVideos } from '../storage/useVideos.js'
import { useChannel } from '../storage/useChannel.js'
import { CHANNEL_DEFAULTS } from '../storage/channelStore.js'

const COUNTRIES = [
  { code: 'RU', label: 'Россия' },
  { code: 'US', label: 'США' },
  { code: 'DE', label: 'Германия' },
  { code: 'BR', label: 'Бразилия' },
  { code: 'IN', label: 'Индия' },
  { code: 'KZ', label: 'Казахстан' },
]

const CONTENT_TYPES = [
  { value: 'video', label: 'Видео' },
  { value: 'short', label: 'Shorts' },
  { value: 'live', label: 'Трансляция' },
]

const todayISO = () => new Date().toISOString().slice(0, 10)
const DEFAULT_AVATAR = '/studio-assets/trading-avatar.svg'
const blankForm = () => ({
  id: null,
  title: '',
  cover: null,
  date: todayISO(),
  duration: '',
  type: 'video',
  views: '',
  revenue: '',
})

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function makeAdminId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function downloadJsonFile(filename, value) {
  const data = JSON.stringify(value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function parseCount(value) {
  if (value === '' || value == null) return undefined
  return Math.max(0, parseInt(value, 10) || 0)
}

function parseRevenue(value) {
  if (value === '' || value == null) return undefined
  return Math.max(0, parseFloat(value) || 0)
}

export default function Screen11Admin() {
  const { showToast } = useContext(NavContext)
  const {
    videos, totals, add, update, remove, clear,
    removeMany, bulkAddRandom, importVideos, exportToFile, resetToBundled,
  } = useVideos()
  const { channel, update: updateChannel, replace: replaceChannel, reset: resetChannel } = useChannel()
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkCount, setBulkCount] = useState('5')
  const [confirmState, setConfirmState] = useState(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const fileInputRef = useRef(null)
  const projectFileInputRef = useRef(null)

  const dashboardComments = Array.isArray(channel.dashboardComments)
    ? channel.dashboardComments
    : CHANNEL_DEFAULTS.dashboardComments
  const recentSubscribers = Array.isArray(channel.recentSubscribers)
    ? channel.recentSubscribers
    : CHANNEL_DEFAULTS.recentSubscribers
  const avatarUrl = channel.avatar || DEFAULT_AVATAR

  const isEditing = form.id !== null
  const allSelected = videos.length > 0 && selected.size === videos.length

  const computed = useMemo(() => {
    const v = parseInt(form.views, 10)
    if (!Number.isFinite(v) || v <= 0) return null
    return computeMetrics(v, 0.5)
  }, [form.views])

  function askConfirm({ title, message, onConfirm }) {
    setConfirmChecked(false)
    setConfirmState({ title, message, onConfirm })
  }

  function closeConfirm() {
    setConfirmState(null)
    setConfirmChecked(false)
  }

  function runConfirm() {
    if (!confirmChecked || !confirmState) return
    const fn = confirmState.onConfirm
    closeConfirm()
    fn()
  }

  function setField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value }
      if (name === 'date' && (current.views === '' || current.revenue === '')) {
        const stats = generateVideoStats({
          id: current.id || undefined,
          title: next.title || 'video',
          date: value || todayISO(),
          duration: next.duration || undefined,
        })
        if (current.views === '') next.views = String(stats.views)
        if (current.revenue === '') {
          const revenueViews = next.views === '' ? stats.views : Math.max(0, parseInt(next.views, 10) || 0)
          next.revenue = String(suggestRevenue({
            views: revenueViews,
            date: value || todayISO(),
            title: next.title || 'video',
            duration: next.duration || undefined,
          }))
        }
      }
      return next
    })
  }

  function onRandomFill() {
    setForm((current) => {
      const base = {
        ...current,
        title: current.title || randomTitle(),
        date: current.date || todayISO(),
        duration: current.duration || randomDuration(),
      }
      const stats = generateVideoStats({
        id: base.id || undefined,
        title: base.title || 'video',
        date: base.date || todayISO(),
        duration: base.duration || undefined,
      })
      return { ...base, views: String(stats.views), revenue: String(stats.revenue) }
    })
  }

  async function onCoverChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setField('cover', await fileToBase64(file))
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    updateChannel({ avatar: await fileToBase64(file) })
  }

  function onAvatarRemove() {
    updateChannel({ avatar: null })
  }

  function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title.trim() || randomTitle(),
      cover: form.cover,
      date: form.date || todayISO(),
      duration: form.duration || randomDuration(),
      type: form.type || 'video',
      views: parseCount(form.views),
      revenue: parseRevenue(form.revenue),
      autoViews: form.views === '',
      autoRevenue: form.revenue === '',
    }
    if (isEditing) {
      update(form.id, payload)
      showToast('Видео обновлено')
    } else {
      add(payload)
      showToast('Видео добавлено')
    }
    setForm(blankForm())
    setSaving(false)
  }

  function onEdit(video) {
    setForm({
      id: video.id,
      title: video.title,
      cover: video.cover,
      date: video.date,
      duration: video.duration,
      type: video.type || 'video',
      views: String(video.views),
      revenue: String(video.revenue),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onCancelEdit() {
    setForm(blankForm())
  }

  function updateVideoField(video, patch) {
    update(video.id, patch)
  }

  function onDelete(id) {
    const video = videos.find((item) => item.id === id)
    askConfirm({
      title: 'Удалить видео?',
      message: video ? `«${video.title}». Это действие нельзя отменить.` : 'Это действие нельзя отменить.',
      onConfirm: () => {
        remove(id)
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (form.id === id) setForm(blankForm())
        showToast('Видео удалено')
      },
    })
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(videos.map((video) => video.id)))
  }

  function onDeleteSelected() {
    if (selected.size === 0) return
    const count = selected.size
    askConfirm({
      title: `Удалить выбранные (${count})?`,
      message: 'Эти видео будут удалены безвозвратно.',
      onConfirm: () => {
        removeMany(Array.from(selected))
        setSelected(new Set())
        showToast(`Удалено: ${count}`)
      },
    })
  }

  function onClearAll() {
    askConfirm({
      title: 'Удалить все видео?',
      message: `Будет удалено ${videos.length}. Действие нельзя отменить.`,
      onConfirm: () => {
        clear()
        setSelected(new Set())
        setForm(blankForm())
        showToast('Все видео удалены')
      },
    })
  }

  function onBulkAdd() {
    const count = Math.max(1, Math.min(500, parseInt(bulkCount, 10) || 0))
    bulkAddRandom(count)
    showToast(`Добавлено: ${count}`)
  }

  function onExport() {
    exportToFile()
    showToast('Скачивается videos.json')
  }

  function onExportProject() {
    downloadJsonFile('youtube-studio-project.json', {
      channel,
      videos,
      exportedAt: new Date().toISOString(),
    })
    showToast('Скачивается проект JSON')
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) throw new Error('not array')
      askConfirm({
        title: `Импортировать ${parsed.length} видео?`,
        message: 'Текущий список будет полностью заменен.',
        onConfirm: () => {
          importVideos(parsed)
          setSelected(new Set())
          showToast(`Импортировано: ${parsed.length}`)
        },
      })
    } catch {
      showToast('Не удалось прочитать JSON')
    }
  }

  async function onImportProjectFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.videos) || typeof parsed.channel !== 'object') {
        throw new Error('invalid project json')
      }
      askConfirm({
        title: 'Импортировать весь проект?',
        message: 'Будут заменены видео и настройки канала.',
        onConfirm: () => {
          importVideos(parsed.videos)
          replaceChannel(parsed.channel)
          setSelected(new Set())
          setForm(blankForm())
          showToast('Проект импортирован')
        },
      })
    } catch {
      showToast('Не удалось прочитать JSON проекта')
    }
  }

  function onResetVideos() {
    askConfirm({
      title: 'Сбросить видео к версии из кода?',
      message: 'Локальные изменения видео будут заменены содержимым public/data/videos.json.',
      onConfirm: async () => {
        await resetToBundled()
        setSelected(new Set())
        setForm(blankForm())
        showToast('Видео сброшены')
      },
    })
  }

  function onResetProject() {
    askConfirm({
      title: 'Сбросить весь проект?',
      message: 'Будут сброшены видео, канал и блоки главной Studio.',
      onConfirm: async () => {
        await resetToBundled()
        resetChannel()
        setSelected(new Set())
        setForm(blankForm())
        showToast('Проект сброшен')
      },
    })
  }

  function listSource(key, fallback) {
    return Array.isArray(channel[key]) ? channel[key] : fallback
  }

  function updateListItem(key, fallback, index, patch) {
    const source = listSource(key, fallback)
    updateChannel({ [key]: source.map((item, i) => (i === index ? { ...item, ...patch } : { ...item })) })
  }

  function addListItem(key, fallback, item) {
    const source = listSource(key, fallback)
    updateChannel({ [key]: [...source.map((entry) => ({ ...entry })), item] })
  }

  function removeListItem(key, fallback, index) {
    const source = listSource(key, fallback)
    updateChannel({ [key]: source.filter((_, i) => i !== index).map((item) => ({ ...item })) })
  }

  function onResetDashboardBlocks() {
    updateChannel({
      dashboardComments: CHANNEL_DEFAULTS.dashboardComments.map((item) => ({ ...item })),
      recentSubscribers: CHANNEL_DEFAULTS.recentSubscribers.map((item) => ({ ...item })),
    })
  }

  return (
    <div className={s.page}>
      <TopBar />
      <Sidebar active="admin" />
      <main className={s.main}>
        <div className={s.headerRow}>
          <div>
            <h1 className={s.title}>Админка видео</h1>
            <div className={s.subtitle}>Видео, канал и данные аналитики</div>
          </div>
          <div className={s.headerActions}>
            <button type="button" className={s.ghostBtn} onClick={onExportProject}>Экспорт проекта</button>
            <button type="button" className={s.ghostBtn} onClick={() => projectFileInputRef.current?.click()}>Импорт проекта</button>
            <button type="button" className={s.dangerBtn} onClick={onClearAll} disabled={videos.length === 0}>Удалить все</button>
          </div>
        </div>

        <div className={s.statsRow}>
          <div className={s.statCard}><span>Видео</span><strong>{totals.count}</strong></div>
          <div className={s.statCard}><span>Просмотры</span><strong>{formatNumber(totals.views)}</strong></div>
          <div className={s.statCard}><span>Лайки</span><strong>{formatNumber(totals.likes)}</strong></div>
          <div className={s.statCard}><span>Доход</span><strong>{formatMoney(totals.revenue)}</strong></div>
        </div>

        <div className={s.editorGrid}>
          <form className={s.videoPanel} onSubmit={onSubmit}>
            <div className={s.panelHead}>
              <div>
                <h2>{isEditing ? 'Редактировать видео' : 'Новое видео'}</h2>
                <span>{isEditing ? 'Изменения сохранятся в текущей записи' : 'Главная форма добавления'}</span>
              </div>
              <div className={s.formActions}>
                <button type="button" className={s.ghostBtn} onClick={onRandomFill}>Автозаполнить</button>
                {isEditing ? <button type="button" className={s.ghostBtn} onClick={onCancelEdit}>Отмена</button> : null}
              </div>
            </div>

            <div className={s.videoFormGrid}>
              <div className={s.coverCol}>
                <label className={s.coverDrop}>
                  {form.cover ? <img src={form.cover} alt="" /> : <span>Обложка 16:9</span>}
                  <input type="file" accept="image/*" onChange={onCoverChange} />
                </label>
                {form.cover ? <button type="button" className={s.linkBtn} onClick={() => setField('cover', null)}>Убрать обложку</button> : null}
              </div>

              <div className={s.fieldsCol}>
                <label className={`${s.field} ${s.fieldWide}`}>
                  <span>Название</span>
                  <input className={s.input} value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Например: Разбор сделки по BTC" />
                </label>
                <div className={s.fieldRow}>
                  <label className={s.field}>
                    <span>Дата публикации</span>
                    <input className={s.input} type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
                  </label>
                  <label className={s.field}>
                    <span>Длительность</span>
                    <input className={s.input} value={form.duration} onChange={(e) => setField('duration', e.target.value)} placeholder="4:06" />
                  </label>
                  <label className={s.field}>
                    <span>Тип</span>
                    <select className={s.input} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                      {CONTENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className={s.field}>
                    <span>Просмотры</span>
                    <input className={s.input} type="number" min="0" value={form.views} onChange={(e) => setField('views', e.target.value)} placeholder="авто" />
                  </label>
                  <label className={s.field}>
                    <span>Доход за видео ($)</span>
                    <input className={s.input} type="number" min="0" step="0.01" value={form.revenue} onChange={(e) => setField('revenue', e.target.value)} placeholder="авто" />
                  </label>
                </div>

                {computed ? (
                  <div className={s.previewBox}>
                    <div><span>Лайки</span><strong>{formatNumber(computed.likes)}</strong></div>
                    <div><span>Дизлайки</span><strong>{formatNumber(computed.dislikes)}</strong></div>
                    <div><span>Нравится</span><strong>{formatLikePct(computed.likePct)}</strong></div>
                  </div>
                ) : null}

                <button type="submit" className={s.submitBtn} disabled={saving}>
                  {isEditing ? 'Сохранить видео' : 'Добавить видео'}
                </button>
              </div>
            </div>
          </form>

          <aside className={s.sidePanel}>
            <div className={s.panelHead}>
              <div>
                <h2>Канал</h2>
                <span>Общие данные</span>
              </div>
              <button type="button" className={s.ghostBtn} onClick={() => resetChannel()}>Сбросить</button>
            </div>
            <div className={s.avatarRow}>
              <div className={s.avatarPreview} style={{ backgroundImage: `url(${avatarUrl})` }} />
              <div className={s.avatarActions}>
                <label className={s.uploadBtn}>
                  {channel.avatar ? 'Заменить' : 'Загрузить'}
                  <input type="file" accept="image/*" onChange={onAvatarChange} />
                </label>
                {channel.avatar ? <button type="button" className={s.linkBtn} onClick={onAvatarRemove}>Удалить</button> : null}
              </div>
            </div>
            <div className={s.channelFields}>
              <label className={s.field}>
                <span>Название канала</span>
                <input className={s.input} value={channel.channelName} onChange={(e) => updateChannel({ channelName: e.target.value })} />
              </label>
              <label className={s.field}>
                <span>Подписчики</span>
                <input className={s.input} type="number" min="0" value={channel.subscriberCount} onChange={(e) => updateChannel({ subscriberCount: parseCount(e.target.value) || 0 })} />
              </label>
              <label className={s.field}>
                <span>Страна</span>
                <select className={s.input} value={channel.country} onChange={(e) => updateChannel({ country: e.target.value })}>
                  {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </label>
              <label className={s.field}>
                <span>Дата создания</span>
                <input className={s.input} type="date" value={channel.joinDate} onChange={(e) => updateChannel({ joinDate: e.target.value })} />
              </label>
              <label className={s.toggleRow}>
                <input type="checkbox" checked={!!channel.monetizationEnabled} onChange={(e) => updateChannel({ monetizationEnabled: e.target.checked })} />
                <span className={s.toggleSwitch}><span /></span>
                <strong>Монетизация</strong>
              </label>
            </div>
          </aside>
        </div>

        <section className={s.librarySection}>
          <div className={s.libraryHead}>
            <h2>Видео ({videos.length})</h2>
            <div className={s.toolbar}>
              <button type="button" className={s.dangerGhostBtn} onClick={onDeleteSelected} disabled={selected.size === 0}>Удалить выбранные{selected.size ? ` (${selected.size})` : ''}</button>
              <input className={s.bulkInput} type="number" min="1" max="500" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} />
              <button type="button" className={s.ghostBtn} onClick={onBulkAdd}>Добавить случайные</button>
              <button type="button" className={s.ghostBtn} onClick={onExport}>Экспорт JSON</button>
              <button type="button" className={s.ghostBtn} onClick={() => fileInputRef.current?.click()}>Импорт JSON</button>
              <button type="button" className={s.ghostBtn} onClick={onResetVideos}>Сбросить видео</button>
              <button type="button" className={s.ghostBtn} onClick={onResetProject}>Сбросить проект</button>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className={s.empty}>Видео пока нет.</div>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.checkCol}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Выбрать все" /></th>
                    <th>Видео</th>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Длительность</th>
                    <th>Просмотры</th>
                    <th>Доход</th>
                    <th>Лайки</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => (
                    <tr key={video.id}>
                      <td><input type="checkbox" checked={selected.has(video.id)} onChange={() => toggleOne(video.id)} aria-label={`Выбрать ${video.title}`} /></td>
                      <td className={s.videoCell}>
                        <div className={s.thumb}>
                          {video.cover ? <img src={video.cover} alt="" /> : <div className={s.thumbBlank} />}
                        </div>
                        <div className={s.inlineTitle}>
                          <input defaultValue={video.title} onBlur={(e) => updateVideoField(video, { title: e.target.value })} />
                          <span>{video.id}</span>
                        </div>
                      </td>
                      <td><input className={s.tableInput} type="date" value={video.date} onChange={(e) => updateVideoField(video, { date: e.target.value })} /></td>
                      <td>
                        <select className={s.tableInput} value={video.type || 'video'} onChange={(e) => updateVideoField(video, { type: e.target.value })}>
                          {CONTENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                      </td>
                      <td><input className={s.tableInput} defaultValue={video.duration} onBlur={(e) => updateVideoField(video, { duration: e.target.value })} /></td>
                      <td><input className={s.tableInput} type="number" min="0" defaultValue={video.views} onBlur={(e) => updateVideoField(video, { views: parseCount(e.target.value) ?? 0 })} /></td>
                      <td><input className={s.tableInput} type="number" min="0" step="0.01" defaultValue={video.revenue} onBlur={(e) => updateVideoField(video, { revenue: parseRevenue(e.target.value) ?? 0 })} /></td>
                      <td className={s.readonlyCell}>
                        <strong>{formatNumber(video.likes)}</strong>
                        <span>{formatLikePct(video.likePct)}</span>
                      </td>
                      <td className={s.actionCell}>
                        <button type="button" className={s.tableBtn} onClick={() => onEdit(video)}>Открыть</button>
                        <button type="button" className={s.deleteBtn} onClick={() => onDelete(video.id)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <details className={s.extraSection}>
          <summary>Дополнительно: комментарии и новые подписчики</summary>
          <div className={s.extraGrid}>
            <section className={s.inlineEditor}>
              <div className={s.inlineEditorHead}>
                <h3>Комментарии</h3>
                <button type="button" className={s.ghostBtn} onClick={() => addListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, {
                  id: makeAdminId('comment'),
                  author: '@new.comment',
                  age: 'только что',
                  text: '',
                  avatarColor: '#525252',
                })}>Добавить</button>
              </div>
              {dashboardComments.map((comment, index) => (
                <div className={s.extraRow} key={comment.id || index}>
                  <input className={s.input} value={comment.author || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { author: e.target.value })} />
                  <input className={s.input} value={comment.age || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { age: e.target.value })} />
                  <input className={s.input} type="color" value={comment.avatarColor || '#525252'} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { avatarColor: e.target.value })} />
                  <textarea className={s.input} value={comment.text || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { text: e.target.value })} />
                  <button type="button" className={s.deleteBtn} onClick={() => removeListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index)}>Удалить</button>
                </div>
              ))}
            </section>

            <section className={s.inlineEditor}>
              <div className={s.inlineEditorHead}>
                <h3>Новые подписчики</h3>
                <button type="button" className={s.ghostBtn} onClick={() => addListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, {
                  id: makeAdminId('subscriber'),
                  name: 'Новый подписчик',
                  count: '0 подписчиков',
                  avatarColor: '#525252',
                })}>Добавить</button>
              </div>
              {recentSubscribers.map((subscriber, index) => (
                <div className={s.extraRowCompact} key={subscriber.id || index}>
                  <input className={s.input} value={subscriber.name || ''} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { name: e.target.value })} />
                  <input className={s.input} value={subscriber.count || ''} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { count: e.target.value })} />
                  <input className={s.input} type="color" value={subscriber.avatarColor || '#525252'} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { avatarColor: e.target.value })} />
                  <button type="button" className={s.deleteBtn} onClick={() => removeListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index)}>Удалить</button>
                </div>
              ))}
            </section>
          </div>
          <button type="button" className={s.ghostBtn} onClick={onResetDashboardBlocks}>Сбросить блоки главной</button>
        </details>

        <input type="file" accept="application/json,.json" ref={fileInputRef} className={s.inlineFile} onChange={onImportFile} />
        <input type="file" accept="application/json,.json" ref={projectFileInputRef} className={s.inlineFile} onChange={onImportProjectFile} />
      </main>

      {confirmState ? (
        <div className={s.confirmScrim} onClick={(e) => e.target === e.currentTarget && closeConfirm()}>
          <div className={s.confirmModal} role="dialog" aria-modal="true">
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <label className={s.confirmCheck}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span>Я понимаю последствия и хочу продолжить</span>
            </label>
            <div className={s.confirmActions}>
              <button type="button" className={s.ghostBtn} onClick={closeConfirm}>Отмена</button>
              <button type="button" className={s.confirmDelete} onClick={runConfirm} disabled={!confirmChecked}>Подтвердить</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
