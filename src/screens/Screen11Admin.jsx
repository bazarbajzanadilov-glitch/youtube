import { useContext, useMemo, useRef, useState } from 'react'
import s from './Screen11Admin.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import {
  randomTitle, randomDuration,
  suggestRevenue, computeMetrics, generateVideoStats,
  formatNumber, formatMoney, formatLikePct, formatDate,
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
const DEFAULT_AVATAR = '/studio-assets/channel-avatar-reference.jpg'
const blankForm = () => ({
  id: null, title: '', cover: null, date: todayISO(),
  duration: '', type: 'video', views: '', revenue: '',
})

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function typeLabel(type) {
  return CONTENT_TYPES.find((item) => item.value === type)?.label || 'Видео'
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
  const fileInputRef = useRef(null)
  const projectFileInputRef = useRef(null)
  const [confirmState, setConfirmState] = useState(null)
  const [confirmChecked, setConfirmChecked] = useState(false)

  const dashboardComments = Array.isArray(channel.dashboardComments)
    ? channel.dashboardComments
    : CHANNEL_DEFAULTS.dashboardComments
  const recentSubscribers = Array.isArray(channel.recentSubscribers)
    ? channel.recentSubscribers
    : CHANNEL_DEFAULTS.recentSubscribers
  const avatarUrl = channel.avatar || DEFAULT_AVATAR

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

  const isEditing = form.id !== null
  const allSelected = videos.length > 0 && selected.size === videos.length

  const computed = useMemo(() => {
    const v = parseInt(form.views, 10)
    if (!Number.isFinite(v) || v <= 0) return null
    return computeMetrics(v, 0.5)
  }, [form.views])

  function setField(name, value) {
    setForm((f) => {
      const next = { ...f, [name]: value }
      if (name === 'date' && (f.views === '' || f.revenue === '')) {
        const stats = generateVideoStats({
          id: f.id || undefined,
          title: next.title || 'video',
          date: value || todayISO(),
          duration: next.duration || undefined,
        })
        if (f.views === '') next.views = String(stats.views)
        if (f.revenue === '') {
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

  function onChannelField(name, value) {
    updateChannel({ [name]: value })
  }
  function onResetChannel() {
    askConfirm({
      title: 'Сбросить настройки канала?',
      message: 'Название, страна и другие параметры вернутся к значениям по умолчанию.',
      onConfirm: () => { resetChannel(); showToast('Настройки канала сброшены') },
    })
  }
  function listSource(key, fallback) {
    return Array.isArray(channel[key]) ? channel[key] : fallback
  }
  function updateListItem(key, fallback, index, patch) {
    const source = listSource(key, fallback)
    const next = source.map((item, i) => (i === index ? { ...item, ...patch } : { ...item }))
    updateChannel({ [key]: next })
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
    showToast('Блоки главной сброшены')
  }

  async function onCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setField('cover', await fileToBase64(file))
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    /* Старая аватарка просто перезаписывается — base64 живёт только
       в одном поле channel.avatar, история не сохраняется. */
    const b64 = await fileToBase64(file)
    updateChannel({ avatar: b64 })
    showToast('Аватар обновлён')
  }
  function onAvatarRemove() {
    updateChannel({ avatar: null })
    showToast('Аватар удалён')
  }

  function onRandomFill() {
    setForm((f) => ({
      ...f,
      title: f.title || randomTitle(),
      date: f.date || todayISO(),
      duration: f.duration || randomDuration(),
    }))
    setForm((f) => {
      const stats = generateVideoStats({
        id: f.id || undefined,
        title: f.title || 'video',
        date: f.date || todayISO(),
        duration: f.duration || undefined,
      })
      return {
        ...f,
        views: String(stats.views),
        revenue: String(stats.revenue),
      }
    })
    showToast('Поля заполнены случайно')
  }

  function onEdit(v) {
    setForm({
      id: v.id, title: v.title, cover: v.cover, date: v.date,
      duration: v.duration, type: v.type || 'video', views: String(v.views), revenue: String(v.revenue),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function onCancelEdit() { setForm(blankForm()) }

  function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title.trim() || randomTitle(),
      cover: form.cover,
      date: form.date || todayISO(),
      duration: form.duration || randomDuration(),
      type: form.type || 'video',
      views: form.views === '' ? undefined : Math.max(0, parseInt(form.views, 10) || 0),
      revenue: form.revenue === '' ? undefined : Math.max(0, parseFloat(form.revenue) || 0),
      autoViews: form.views === '',
      autoRevenue: form.revenue === '',
    }
    if (isEditing) { update(form.id, payload); showToast('Видео обновлено') }
    else { add(payload); showToast('Видео добавлено') }
    setForm(blankForm())
    setSaving(false)
  }

  function onDelete(id) {
    const v = videos.find((x) => x.id === id)
    askConfirm({
      title: 'Удалить видео?',
      message: v ? `«${v.title}». Это действие нельзя отменить.` : 'Это действие нельзя отменить.',
      onConfirm: () => {
        remove(id)
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
        if (form.id === id) setForm(blankForm())
        showToast('Удалено')
      },
    })
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(videos.map((v) => v.id)))
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
      title: 'Удалить ВСЕ видео?',
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
    const n = Math.max(1, Math.min(500, parseInt(bulkCount, 10) || 0))
    bulkAddRandom(n)
    showToast(`Добавлено: ${n}`)
  }

  function onExport() {
    exportToFile()
    showToast('Скачивается videos.json')
  }
  function onImportClick() {
    fileInputRef.current?.click()
  }
  function onImportProjectClick() {
    projectFileInputRef.current?.click()
  }
  async function onImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const arr = JSON.parse(text)
      if (!Array.isArray(arr)) throw new Error('not array')
      askConfirm({
        title: `Импортировать ${arr.length} видео?`,
        message: 'Текущий список будет полностью заменён.',
        onConfirm: () => {
          importVideos(arr)
          setSelected(new Set())
          showToast(`Импортировано: ${arr.length}`)
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
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.videos) || typeof parsed.channel !== 'object') {
        throw new Error('invalid project json')
      }
      askConfirm({
        title: 'Импортировать весь проект?',
        message: 'Будут заменены видео, настройки канала, комментарии и новые подписчики.',
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
  function onReset() {
    askConfirm({
      title: 'Сбросить к версии из кода?',
      message: 'Все локальные изменения видео будут потеряны и заменены содержимым public/data/videos.json.',
      onConfirm: async () => {
        await resetToBundled()
        setSelected(new Set())
        showToast('Сброшено к коду')
      },
    })
  }
  function onResetProject() {
    askConfirm({
      title: 'Сбросить весь проект?',
      message: 'Будут сброшены и видео, и настройки канала, и блоки главной Studio.',
      onConfirm: async () => {
        await resetToBundled()
        resetChannel()
        setSelected(new Set())
        setForm(blankForm())
        showToast('Проект сброшен')
      },
    })
  }
  function onExportProject() {
    downloadJsonFile('youtube-studio-project.json', {
      channel,
      videos,
      exportedAt: new Date().toISOString(),
    })
    showToast('Скачивается проект JSON')
  }

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="admin"/>
      <div className={`${s.main} ${s.adminMain}`}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Админка проекта</h1>
          <button type="button" className={s.dangerBtn} onClick={onClearAll} disabled={videos.length === 0}>
            Удалить все ({videos.length})
          </button>
        </div>

        <div className={s.helpNote}>
          Админка — это источник данных для всего проекта: видео, канал, комментарии на главной, новые подписчики и аналитика.
          <b> «Экспорт проекта»</b> сохраняет всё текущее состояние целиком, <b>«Импорт проекта»</b> восстанавливает его одним файлом.
          Отдельный <b>«Экспорт JSON»</b> ниже сохраняет только массив видео для <code>public/data/videos.json</code>.
        </div>

        <div className={s.statsRow}>
          <div className={s.statCard}><div className={s.statLabel}>Всего видео</div><div className={s.statValue}>{totals.count}</div></div>
          <div className={s.statCard}><div className={s.statLabel}>Просмотры</div><div className={s.statValue}>{formatNumber(totals.views)}</div></div>
          <div className={s.statCard}><div className={s.statLabel}>Лайки</div><div className={s.statValue}>{formatNumber(totals.likes)}</div></div>
          <div className={s.statCard}><div className={s.statLabel}>Доход</div><div className={s.statValue}>{formatMoney(totals.revenue)}</div></div>
        </div>

        <section className={s.channelSection}>
          <div className={s.channelHead}>
            <div>
              <h2 className={s.formTitle}>Канал</h2>
              <p className={s.channelSub}>Параметры влияют на KPI и графики Аналитики и Монетизации</p>
            </div>
            <button type="button" className={s.ghostBtn} onClick={onResetChannel}>Сбросить</button>
          </div>
          <div className={s.avatarRow}>
            <div
              className={s.avatarPreview}
              style={{ backgroundImage: `url(${avatarUrl})` }}
              aria-label="Аватар канала"
            />
            <div className={s.avatarLabelBlock}>
              <label className={s.label}>Аватар канала</label>
              <div className={s.avatarActions}>
                <label className={s.avatarUploadBtn}>
                  {channel.avatar ? 'Заменить' : 'Загрузить'}
                  <input type="file" accept="image/*" onChange={onAvatarChange} />
                </label>
                {channel.avatar ? (
                  <button type="button" className={s.avatarRemoveBtn} onClick={onAvatarRemove}>Удалить</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className={s.channelGrid}>
            <div className={s.field}><label className={s.label}>Название канала</label>
              <input type="text" className={s.input} value={channel.channelName} onChange={(e) => onChannelField('channelName', e.target.value)}/></div>
            <div className={s.field}><label className={s.label}>Подписчики</label>
              <input type="number" min="0" step="1" className={s.input} value={channel.subscriberCount} onChange={(e) => onChannelField('subscriberCount', Math.max(0, parseInt(e.target.value, 10) || 0))}/></div>
            <div className={s.field}><label className={s.label}>Страна</label>
              <select className={s.input} value={channel.country} onChange={(e) => onChannelField('country', e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select></div>
            <div className={s.field}><label className={s.label}>Создан</label>
              <input type="date" className={s.input} value={channel.joinDate} onChange={(e) => onChannelField('joinDate', e.target.value)}/></div>
            <div className={`${s.field} ${s.fieldToggle}`}>
              <label className={s.toggleRow}>
                <input type="checkbox" checked={!!channel.monetizationEnabled} onChange={(e) => onChannelField('monetizationEnabled', e.target.checked)}/>
                <span className={s.toggleSwitch} aria-hidden="true"><span className={s.toggleKnob}/></span>
                <span className={s.toggleLabel}><strong>Монетизация</strong><span className={s.toggleHint}>Влияет на отображение «Монетизации»</span></span>
              </label>
            </div>
          </div>

          <div className={s.dashboardDataHead}>
            <div>
              <h3 className={s.subFormTitle}>Главная Studio</h3>
              <p className={s.channelSub}>Эти строки попадают в блоки «Комментарии» и «Новые подписчики» на панели управления.</p>
            </div>
            <button type="button" className={s.ghostBtn} onClick={onResetDashboardBlocks}>Сбросить блоки</button>
          </div>
          <div className={s.dashboardDataGrid}>
            <section className={s.inlineEditor}>
              <h4 className={s.inlineEditorTitle}>Комментарии</h4>
              {dashboardComments.length > 0 ? dashboardComments.map((comment, index) => (
                <div className={s.inlineEditorRow} key={comment.id || index}>
                  <div className={s.field}><label className={s.label}>Автор</label>
                    <input type="text" className={s.input} value={comment.author || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { author: e.target.value })}/></div>
                  <div className={s.field}><label className={s.label}>Возраст</label>
                    <input type="text" className={s.input} value={comment.age || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { age: e.target.value })}/></div>
                  <div className={s.field}><label className={s.label}>Цвет аватара</label>
                    <input type="color" className={`${s.input} ${s.colorInput}`} value={comment.avatarColor || '#525252'} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { avatarColor: e.target.value })}/></div>
                  <div className={s.inlineEditorActions}>
                    <button type="button" className={s.inlineRemoveBtn} onClick={() => removeListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index)}>Удалить</button>
                  </div>
                  <div className={`${s.field} ${s.fieldWide}`}><label className={s.label}>Текст</label>
                    <textarea className={`${s.input} ${s.textarea}`} value={comment.text || ''} onChange={(e) => updateListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, index, { text: e.target.value })}/></div>
                </div>
              )) : <div className={s.inlineEditorEmpty}>Список пуст. Добавьте комментарий ниже.</div>}
              <div className={s.inlineEditorTools}>
                <button
                  type="button"
                  className={s.ghostBtn}
                  onClick={() => addListItem('dashboardComments', CHANNEL_DEFAULTS.dashboardComments, {
                    id: makeAdminId('comment'),
                    author: '@new.comment',
                    age: 'только что',
                    text: '',
                    avatarColor: '#525252',
                  })}
                >
                  Добавить комментарий
                </button>
              </div>
            </section>
            <section className={s.inlineEditor}>
              <h4 className={s.inlineEditorTitle}>Новые подписчики</h4>
              {recentSubscribers.length > 0 ? recentSubscribers.map((subscriber, index) => (
                <div className={s.inlineEditorRow} key={subscriber.id || index}>
                  <div className={s.field}><label className={s.label}>Имя</label>
                    <input type="text" className={s.input} value={subscriber.name || ''} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { name: e.target.value })}/></div>
                  <div className={s.field}><label className={s.label}>Подпись</label>
                    <input type="text" className={s.input} value={subscriber.count || ''} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { count: e.target.value })}/></div>
                  <div className={s.field}><label className={s.label}>Цвет аватара</label>
                    <input type="color" className={`${s.input} ${s.colorInput}`} value={subscriber.avatarColor || '#525252'} onChange={(e) => updateListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index, { avatarColor: e.target.value })}/></div>
                  <div className={s.inlineEditorActions}>
                    <button type="button" className={s.inlineRemoveBtn} onClick={() => removeListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, index)}>Удалить</button>
                  </div>
                </div>
              )) : <div className={s.inlineEditorEmpty}>Список пуст. Добавьте подписчика ниже.</div>}
              <div className={s.inlineEditorTools}>
                <button
                  type="button"
                  className={s.ghostBtn}
                  onClick={() => addListItem('recentSubscribers', CHANNEL_DEFAULTS.recentSubscribers, {
                    id: makeAdminId('subscriber'),
                    name: 'Новый подписчик',
                    count: '0 подписчиков',
                    avatarColor: '#525252',
                  })}
                >
                  Добавить подписчика
                </button>
              </div>
            </section>
          </div>
        </section>

        <form className={s.form} onSubmit={onSubmit}>
          <div className={s.formHead}>
            <h2 className={s.formTitle}>{isEditing ? 'Редактирование' : 'Добавить видео'}</h2>
            <div className={s.formActions}>
              <button type="button" className={s.ghostBtn} onClick={onRandomFill}>✨ Случайные данные</button>
              {isEditing ? <button type="button" className={s.ghostBtn} onClick={onCancelEdit}>Отмена</button> : null}
            </div>
          </div>

          <div className={s.formGrid}>
            <div className={s.coverCol}>
              <label className={s.label}>Обложка</label>
              <label className={s.coverDrop}>
                {form.cover ? <img src={form.cover} alt=""/> : <span className={s.coverPlaceholder}>Нажмите, чтобы выбрать файл</span>}
                <input type="file" accept="image/*" onChange={onCoverChange} className={s.fileInput}/>
              </label>
              {form.cover ? <button type="button" className={s.linkBtn} onClick={() => setField('cover', null)}>Убрать обложку</button> : null}
            </div>

            <div className={s.fieldsCol}>
              <div className={s.field}><label className={s.label}>Название</label>
                <input type="text" className={s.input} placeholder="Будет сгенерировано, если пусто" value={form.title} onChange={(e) => setField('title', e.target.value)}/></div>
              <div className={s.fieldRow}>
                <div className={s.field}><label className={s.label}>Дата публикации</label>
                  <input type="date" className={s.input} value={form.date} onChange={(e) => setField('date', e.target.value)}/></div>
                <div className={s.field}><label className={s.label}>Длительность</label>
                  <input type="text" className={s.input} placeholder="например 4:06" value={form.duration} onChange={(e) => setField('duration', e.target.value)}/></div>
              </div>
              <div className={s.fieldRow}>
                <div className={s.field}><label className={s.label}>Тип контента</label>
                  <select className={s.input} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                    {CONTENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select></div>
                <div className={s.field}><label className={s.label}>Статус</label>
                  <select className={s.input} value="public" disabled>
                    <option value="public">Опубликовано</option>
                  </select></div>
              </div>
              <div className={s.fieldRow}>
                <div className={s.field}><label className={s.label}>Просмотры</label>
                  <input type="number" min="0" className={s.input} placeholder="случайное 1000–500 000" value={form.views} onChange={(e) => setField('views', e.target.value)}/></div>
                <div className={s.field}><label className={s.label}>Доход за видео ($)</label>
                  <input type="number" min="0" step="0.01" className={s.input} placeholder="расчетный доход" value={form.revenue} onChange={(e) => setField('revenue', e.target.value)}/></div>
              </div>
              {computed ? (
                <div className={s.previewBox}>
                  <span className={s.label}>Авто-расчет</span>
                  <div className={s.previewGrid}>
                    <div><span className={s.previewLabel}>Лайки</span><span className={s.previewValue}>{formatNumber(computed.likes)}</span></div>
                    <div><span className={s.previewLabel}>Дизлайки</span><span className={s.previewValue}>{formatNumber(computed.dislikes)}</span></div>
                    <div><span className={s.previewLabel}>«Нравится»</span><span className={s.previewValue}>{formatLikePct(computed.likePct)}</span></div>
                  </div>
                </div>
              ) : null}
              <div className={s.submitRow}>
                <button type="submit" className={s.submitBtn} disabled={saving}>{isEditing ? 'Сохранить' : 'Добавить видео'}</button>
              </div>
            </div>
          </div>
        </form>

        <h2 className={s.tableTitle}>Список видео ({videos.length})</h2>

        <div className={s.toolbar}>
          <button type="button" className={`${s.toolbarBtn} ${s.toolbarBtnDanger}`} onClick={onDeleteSelected} disabled={selected.size === 0}>
            🗑 Удалить выбранные{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <span className={s.toolbarLabel}>Создать массово:</span>
          <input type="number" min="1" max="500" className={s.bulkInput} value={bulkCount} onChange={(e) => setBulkCount(e.target.value)}/>
          <button type="button" className={s.toolbarBtn} onClick={onBulkAdd}>+ Случайных</button>
          <span className={s.toolbarSpacer}/>
          <button type="button" className={`${s.toolbarBtn} ${s.toolbarBtnPrimary}`} onClick={onExportProject}>⬇ Экспорт проекта</button>
          <button type="button" className={`${s.toolbarBtn} ${s.toolbarBtnPrimary}`} onClick={onImportProjectClick}>⬆ Импорт проекта</button>
          <button type="button" className={s.toolbarBtn} onClick={onResetProject}>⟲ Сбросить проект</button>
          <button type="button" className={s.toolbarBtn} onClick={onExport}>⬇ Экспорт JSON</button>
          <button type="button" className={s.toolbarBtn} onClick={onImportClick}>⬆ Импорт JSON</button>
          <button type="button" className={s.toolbarBtn} onClick={onReset}>⟲ Сбросить к коду</button>
          <input type="file" accept="application/json,.json" ref={fileInputRef} className={s.inlineFile} onChange={onImportFile}/>
          <input type="file" accept="application/json,.json" ref={projectFileInputRef} className={s.inlineFile} onChange={onImportProjectFile}/>
        </div>

        {videos.length === 0 ? (
          <div className={s.empty}>
            Пока нет ни одного видео. Заполните форму выше, нажмите «Случайные данные» или «+ Случайных» в массовом блоке.
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" className={s.checkbox} checked={allSelected} onChange={toggleAll} aria-label="Выбрать все"/>
                  </th>
                  <th>Видео</th>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th className={s.right}>Просмотры</th>
                  <th className={s.right}>Лайки</th>
                  <th className={s.right}>«Нравится»</th>
                  <th className={s.right}>Доход</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <input type="checkbox" className={s.checkbox} checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} aria-label={`Выбрать ${v.title}`}/>
                    </td>
                    <td>
                      <div className={s.videoCell}>
                        <div className={s.thumb}>
                          {v.cover ? <img src={v.cover} alt=""/> : <div className={s.thumbBlank}/>}
                          <span className={s.dur}>{v.duration}</span>
                        </div>
                        <div className={s.videoInfo}>
                          <div className={s.videoTitle}>{v.title}</div>
                          <div className={s.videoId}>{v.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(v.date)}</td>
                    <td>{typeLabel(v.type)}</td>
                    <td className={s.right}>{formatNumber(v.views)}</td>
                    <td className={s.right}>{formatNumber(v.likes)}</td>
                    <td className={s.right}>{formatLikePct(v.likePct)}</td>
                    <td className={s.right}>{formatMoney(v.revenue)}</td>
                    <td className={s.actionCell}>
                      <button type="button" className={s.iconBtn} onClick={() => onEdit(v)} aria-label="Редактировать">✏️</button>
                      <button type="button" className={s.iconBtn} onClick={() => onDelete(v.id)} aria-label="Удалить">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmState ? (
        <div className={s.confirmScrim} onClick={(e) => e.target === e.currentTarget && closeConfirm()}>
          <div className={s.confirmModal} role="dialog" aria-modal="true">
            <h3 className={s.confirmTitle}>{confirmState.title}</h3>
            <p className={s.confirmMsg}>{confirmState.message}</p>
            <label className={s.confirmCheck}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span>Я понимаю последствия и хочу продолжить</span>
            </label>
            <div className={s.confirmActions}>
              <button type="button" className={s.confirmCancel} onClick={closeConfirm}>Отмена</button>
              <button type="button" className={s.confirmDelete} onClick={runConfirm} disabled={!confirmChecked}>Подтвердить</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
