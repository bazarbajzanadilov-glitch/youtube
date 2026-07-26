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
import AdminGate from '../components/auth/AdminGate.jsx'
import {
  signOutAdmin,
  updateSitePassword,
} from '../data/adminRepository.js'
import {
  formatImageBytes,
  MAX_SOURCE_IMAGE_BYTES,
  MAX_STORED_IMAGE_BYTES,
  prepareStudioImage,
  STUDIO_IMAGE_ACCEPT,
} from '../lib/studioImage.js'
import { getAlmatyDateISO } from '../lib/almatyDate.js'
import ChannelAvatar from '../components/ChannelAvatar.jsx'
import { normalizeAverageViewPercentage } from '../lib/videoMetrics.js'

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

const ANALYTICS_PROFILES = [
  { value: 'gradualGrowth', label: 'Плавный рост' },
  { value: 'viralSpike', label: 'Вирусный всплеск' },
  { value: 'steady', label: 'Стабильный' },
  { value: 'decayAfterPeak', label: 'Спад после пика' },
  { value: 'seasonal', label: 'Сезонный' },
]

const todayISO = () => getAlmatyDateISO()
const analyticsYesterdayISO = () => getAlmatyDateISO(new Date(Date.now() - 86400000))
const blankForm = () => ({
  id: null,
  title: '',
  cover: null,
  coverPath: null,
  coverFile: null,
  removeCover: false,
  date: todayISO(),
  duration: '',
  type: 'video',
  profile: 'gradualGrowth',
  views: '',
  revenue: '',
  likes: '',
  dislikes: '',
  averageViewPercentage: '',
  autoViews: true,
  autoRevenue: true,
})

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

function previousISO(value) {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function revokeBlobUrl(value) {
  if (String(value || '').startsWith('blob:')) URL.revokeObjectURL(value)
}

function Screen11AdminContent() {
  const { showToast } = useContext(NavContext)
  const {
    videos, totals, add, update, remove, clear,
    removeMany, bulkAddRandom, importVideos, exportToFile,
  } = useVideos()
  const {
    channel,
    update: updateChannel,
    updateSubscriberDailyStats,
    replace: replaceProject,
  } = useChannel()
  const [form, setForm] = useState(blankForm())
  const [channelDraft, setChannelDraft] = useState(null)
  const [subscriberStatsDraft, setSubscriberStatsDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingSubscriberStats, setSavingSubscriberStats] = useState(false)
  const [sitePassword, setSitePassword] = useState('')
  const [sitePasswordConfirm, setSitePasswordConfirm] = useState('')
  const [savingSitePassword, setSavingSitePassword] = useState(false)
  const [processingImage, setProcessingImage] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkCount, setBulkCount] = useState('5')
  const [confirmState, setConfirmState] = useState(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const fileInputRef = useRef(null)
  const projectFileInputRef = useRef(null)

  const editableChannel = channelDraft || channel
  const dashboardComments = Array.isArray(editableChannel.dashboardComments)
    ? editableChannel.dashboardComments
    : CHANNEL_DEFAULTS.dashboardComments
  const recentSubscribers = Array.isArray(editableChannel.recentSubscribers)
    ? editableChannel.recentSubscribers
    : CHANNEL_DEFAULTS.recentSubscribers
  const subscriberDailyStats = useMemo(
    () => (
      Array.isArray(subscriberStatsDraft)
        ? subscriberStatsDraft
        : (Array.isArray(channel.subscriberDailyStats) ? channel.subscriberDailyStats : [])
    ),
    [channel.subscriberDailyStats, subscriberStatsDraft],
  )
  const subscriberStatsRows = useMemo(
    () => subscriberDailyStats
      .map((row, sourceIndex) => ({ ...row, sourceIndex }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [subscriberDailyStats],
  )

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

  async function runConfirm() {
    if (!confirmChecked || !confirmState) return
    const fn = confirmState.onConfirm
    closeConfirm()
    try {
      await fn()
    } catch (error) {
      showToast(error.message || 'Не удалось выполнить действие')
    }
  }

  function setField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value }
      if (name === 'views') next.autoViews = false
      if (name === 'revenue') next.autoRevenue = false
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
    setProcessingImage('cover')
    try {
      const prepared = await prepareStudioImage(file, 'cover')
      const previewUrl = URL.createObjectURL(prepared.file)
      setForm((current) => {
        revokeBlobUrl(current.cover)
        return {
          ...current,
          cover: previewUrl,
          coverFile: prepared.file,
          removeCover: false,
        }
      })
      showToast(`Обложка: ${formatImageBytes(prepared.originalBytes)} → ${formatImageBytes(prepared.outputBytes)} WebP`)
    } catch (error) {
      showToast(error.message || 'Не удалось обработать обложку')
    } finally {
      setProcessingImage(null)
    }
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProcessingImage('avatar')
    try {
      const prepared = await prepareStudioImage(file, 'avatar')
      const previewUrl = URL.createObjectURL(prepared.file)
      setChannelDraft((current) => {
        const source = current || channel
        revokeBlobUrl(source.avatar)
        return {
          ...source,
          avatar: previewUrl,
          avatarFile: prepared.file,
          removeAvatar: false,
        }
      })
      showToast(`Аватар: ${formatImageBytes(prepared.originalBytes)} → ${formatImageBytes(prepared.outputBytes)} WebP`)
    } catch (error) {
      showToast(error.message || 'Не удалось обработать аватар')
    } finally {
      setProcessingImage(null)
    }
  }

  function onAvatarRemove() {
    setChannelDraft((current) => {
      const source = current || channel
      revokeBlobUrl(source.avatar)
      return {
        ...source,
        avatar: null,
        avatarFile: null,
        removeAvatar: true,
      }
    })
  }

  function onCoverRemove() {
    setForm((current) => {
      revokeBlobUrl(current.cover)
      return {
        ...current,
        cover: null,
        coverFile: null,
        removeCover: true,
      }
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title.trim() || randomTitle(),
      cover: form.cover,
      coverPath: form.coverPath,
      coverFile: form.coverFile,
      removeCover: form.removeCover,
      date: form.date || todayISO(),
      duration: form.duration || randomDuration(),
      type: form.type || 'video',
      profile: form.profile || 'gradualGrowth',
      views: form.autoViews ? undefined : parseCount(form.views),
      revenue: form.autoRevenue ? undefined : parseRevenue(form.revenue),
      likes: parseCount(form.likes),
      dislikes: parseCount(form.dislikes),
      averageViewPercentage: normalizeAverageViewPercentage(form.averageViewPercentage),
      autoViews: form.autoViews,
      autoRevenue: form.autoRevenue,
    }
    try {
      if (isEditing) {
        await update(form.id, payload)
        showToast('Видео обновлено')
      } else {
        await add(payload)
        showToast('Видео добавлено')
      }
      revokeBlobUrl(form.cover)
      setForm(blankForm())
    } catch (error) {
      showToast(error.message || 'Не удалось сохранить видео')
    } finally {
      setSaving(false)
    }
  }

  function onEdit(video) {
    revokeBlobUrl(form.cover)
    setForm({
      id: video.id,
      title: video.title,
      cover: video.cover,
      coverPath: video.coverPath || null,
      coverFile: null,
      removeCover: false,
      date: video.date,
      duration: video.duration,
      type: video.type || 'video',
      profile: video.profile || 'gradualGrowth',
      views: String(video.views),
      revenue: String(video.revenue),
      likes: String(video.likes ?? 0),
      dislikes: String(video.dislikes ?? 0),
      averageViewPercentage: video.averageViewPercentage == null
        ? ''
        : String(video.averageViewPercentage),
      autoViews: video._autoStats?.views === true,
      autoRevenue: video._autoStats?.revenue === true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onCancelEdit() {
    revokeBlobUrl(form.cover)
    setForm(blankForm())
  }

  async function updateVideoField(video, patch) {
    try {
      await update(video.id, patch)
    } catch (error) {
      showToast(error.message || 'Не удалось обновить видео')
    }
  }

  function onDelete(id) {
    const video = videos.find((item) => item.id === id)
    askConfirm({
      title: 'Удалить видео?',
      message: video ? `«${video.title}». Это действие нельзя отменить.` : 'Это действие нельзя отменить.',
      onConfirm: async () => {
        await remove(id)
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
      onConfirm: async () => {
        await removeMany(Array.from(selected))
        setSelected(new Set())
        showToast(`Удалено: ${count}`)
      },
    })
  }

  function onClearAll() {
    askConfirm({
      title: 'Удалить все видео?',
      message: `Будет удалено ${videos.length}. Действие нельзя отменить.`,
      onConfirm: async () => {
        await clear()
        setSelected(new Set())
        setForm(blankForm())
        showToast('Все видео удалены')
      },
    })
  }

  async function onBulkAdd() {
    const count = Math.max(1, Math.min(500, parseInt(bulkCount, 10) || 0))
    try {
      await bulkAddRandom(count)
      showToast(`Добавлено: ${count}`)
    } catch (error) {
      showToast(error.message || 'Не удалось добавить видео')
    }
  }

  function onExport() {
    exportToFile()
    showToast('Скачивается videos.json')
  }

  function onExportProject() {
    downloadJsonFile('youtube-studio-project.json', {
      channel: { ...editableChannel, subscriberDailyStats },
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
        onConfirm: async () => {
          await importVideos(parsed)
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
        onConfirm: async () => {
          await replaceProject(parsed.channel, parsed.videos)
          setChannelDraft(null)
          setSelected(new Set())
          setForm(blankForm())
          showToast('Проект импортирован')
        },
      })
    } catch {
      showToast('Не удалось прочитать JSON проекта')
    }
  }

  function listSource(key, fallback) {
    return Array.isArray(editableChannel[key]) ? editableChannel[key] : fallback
  }

  function updateChannelDraft(patch) {
    setChannelDraft((current) => ({ ...(current || channel), ...patch }))
  }

  function updateListItem(key, fallback, index, patch) {
    const source = listSource(key, fallback)
    updateChannelDraft({ [key]: source.map((item, i) => (i === index ? { ...item, ...patch } : { ...item })) })
  }

  function addListItem(key, fallback, item) {
    const source = listSource(key, fallback)
    updateChannelDraft({ [key]: [...source.map((entry) => ({ ...entry })), item] })
  }

  function removeListItem(key, fallback, index) {
    const source = listSource(key, fallback)
    updateChannelDraft({ [key]: source.filter((_, i) => i !== index).map((item) => ({ ...item })) })
  }

  function onResetDashboardBlocks() {
    updateChannelDraft({
      dashboardComments: CHANNEL_DEFAULTS.dashboardComments.map((item) => ({ ...item })),
      recentSubscribers: CHANNEL_DEFAULTS.recentSubscribers.map((item) => ({ ...item })),
    })
  }

  async function onSaveChannel() {
    setSaving(true)
    try {
      await updateChannel(editableChannel)
      revokeBlobUrl(editableChannel.avatar)
      setChannelDraft(null)
      showToast('Канал и блоки главной сохранены')
    } catch (error) {
      showToast(error.message || 'Не удалось сохранить канал')
    } finally {
      setSaving(false)
    }
  }

  function updateSubscriberStat(sourceIndex, patch) {
    setSubscriberStatsDraft((current) => {
      const source = Array.isArray(current) ? current : subscriberDailyStats
      return source.map((row, index) => (
        index === sourceIndex ? { ...row, ...patch } : { ...row }
      ))
    })
  }

  function addSubscriberStat() {
    const occupiedDates = new Set(subscriberDailyStats.map((row) => row.date))
    let date = analyticsYesterdayISO()
    while (occupiedDates.has(date)) date = previousISO(date)
    setSubscriberStatsDraft([
      ...subscriberDailyStats.map((row) => ({ ...row })),
      { date, gained: 0, lost: 0 },
    ])
  }

  function removeSubscriberStat(sourceIndex) {
    setSubscriberStatsDraft(
      subscriberDailyStats
        .filter((_, index) => index !== sourceIndex)
        .map((row) => ({ ...row })),
    )
  }

  async function onSaveSubscriberStats() {
    setSavingSubscriberStats(true)
    try {
      await updateSubscriberDailyStats(subscriberDailyStats)
      setSubscriberStatsDraft(null)
      showToast('История подписчиков сохранена и аналитика обновлена')
    } catch (error) {
      showToast(error.message || 'Не удалось сохранить историю подписчиков')
    } finally {
      setSavingSubscriberStats(false)
    }
  }

  async function onAdminSignOut() {
    try {
      await signOutAdmin()
      showToast('Вы вышли из админки')
    } catch (error) {
      showToast(error.message || 'Не удалось выйти из админки')
    }
  }

  async function onSitePasswordChange(event) {
    event.preventDefault()
    if (sitePassword.length < 4) {
      showToast('Пароль сайта должен содержать не менее 4 символов')
      return
    }
    if (sitePassword !== sitePasswordConfirm) {
      showToast('Пароли сайта не совпадают')
      return
    }

    setSavingSitePassword(true)
    try {
      await updateSitePassword(sitePassword)
      setSitePassword('')
      setSitePasswordConfirm('')
      showToast('Общий пароль сайта изменён')
    } catch (error) {
      showToast(error.message || 'Не удалось изменить пароль сайта')
    } finally {
      setSavingSitePassword(false)
    }
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
            <button type="button" className={s.ghostBtn} onClick={onAdminSignOut}>Выйти из админки</button>
            <button type="button" className={s.dangerBtn} onClick={onClearAll} disabled={videos.length === 0}>Удалить все</button>
          </div>
        </div>

        <div className={s.statsRow}>
          <div className={s.statCard}><span>Видео</span><strong>{totals.count}</strong></div>
          <div className={s.statCard}><span>Просмотры</span><strong>{formatNumber(totals.views)}</strong></div>
          <div className={s.statCard}><span>Лайки</span><strong>{formatNumber(totals.likes)}</strong></div>
          <div className={s.statCard}><span>Доход</span><strong>{formatMoney(totals.revenue)}</strong></div>
        </div>

        <section className={s.securityPanel}>
          <div className={s.panelHead}>
            <div>
              <h2>Доступ к сайту</h2>
              <span>Общий пароль для всех посетителей. Пароль админки от него не зависит.</span>
            </div>
          </div>
          <form className={s.securityForm} onSubmit={onSitePasswordChange}>
            <label className={s.field}>
              <span>Новый пароль сайта</span>
              <input
                className={s.input}
                type="password"
                autoComplete="new-password"
                value={sitePassword}
                onChange={(event) => setSitePassword(event.target.value)}
              />
            </label>
            <label className={s.field}>
              <span>Повторите пароль сайта</span>
              <input
                className={s.input}
                type="password"
                autoComplete="new-password"
                value={sitePasswordConfirm}
                onChange={(event) => setSitePasswordConfirm(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className={s.submitBtn}
              disabled={!sitePassword || savingSitePassword}
            >
              {savingSitePassword ? 'Сохранение…' : 'Сменить пароль сайта'}
            </button>
          </form>
        </section>

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
                  {processingImage === 'cover'
                    ? <span>Сжимаем в WebP…</span>
                    : form.cover
                      ? <img src={form.cover} alt="" />
                      : <span>Обложка 16:9</span>}
                  <input
                    type="file"
                    accept={STUDIO_IMAGE_ACCEPT}
                    onChange={onCoverChange}
                    disabled={processingImage !== null}
                  />
                </label>
                <div className={s.mediaHint}>
                  JPEG, PNG или WebP · до {formatImageBytes(MAX_SOURCE_IMAGE_BYTES)} · после обработки до {formatImageBytes(MAX_STORED_IMAGE_BYTES)}
                </div>
                {form.cover ? (
                  <button
                    type="button"
                    className={s.linkBtn}
                    onClick={onCoverRemove}
                  >
                    Убрать обложку
                  </button>
                ) : null}
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
                    <span>Средний процент просмотра</span>
                    <input
                      className={s.input}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.averageViewPercentage}
                      onChange={(e) => setField('averageViewPercentage', e.target.value)}
                      placeholder="45.1"
                    />
                  </label>
                  <label className={s.field}>
                    <span>Тип</span>
                    <select className={s.input} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                      {CONTENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className={s.field}>
                    <span>Профиль аналитики</span>
                    <select className={s.input} value={form.profile} onChange={(e) => setField('profile', e.target.value)}>
                      {ANALYTICS_PROFILES.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}
                    </select>
                  </label>
                  <label className={s.field}>
                    <span>Просмотры</span>
                    <input className={s.input} type="number" min="0" value={form.views} onChange={(e) => setField('views', e.target.value)} placeholder="авто" disabled={form.autoViews} />
                    <span className={s.autoCheck}>
                      <input type="checkbox" checked={form.autoViews} onChange={(e) => setField('autoViews', e.target.checked)} />
                      Автоматически пересчитывать
                    </span>
                  </label>
                  <label className={s.field}>
                    <span>Доход за видео ($)</span>
                    <input className={s.input} type="number" min="0" step="0.01" value={form.revenue} onChange={(e) => setField('revenue', e.target.value)} placeholder="авто" disabled={form.autoRevenue} />
                    <span className={s.autoCheck}>
                      <input type="checkbox" checked={form.autoRevenue} onChange={(e) => setField('autoRevenue', e.target.checked)} />
                      Автоматически пересчитывать
                    </span>
                  </label>
                  <label className={s.field}>
                    <span>Лайки</span>
                    <input className={s.input} type="number" min="0" value={form.likes} onChange={(e) => setField('likes', e.target.value)} placeholder="авто" />
                  </label>
                  <label className={s.field}>
                    <span>Дизлайки</span>
                    <input className={s.input} type="number" min="0" value={form.dislikes} onChange={(e) => setField('dislikes', e.target.value)} placeholder="авто" />
                  </label>
                </div>

                {computed ? (
                  <div className={s.previewBox}>
                    <div><span>Лайки</span><strong>{formatNumber(computed.likes)}</strong></div>
                    <div><span>Дизлайки</span><strong>{formatNumber(computed.dislikes)}</strong></div>
                    <div><span>Нравится</span><strong>{formatLikePct(computed.likePct)}</strong></div>
                  </div>
                ) : null}

                <button type="submit" className={s.submitBtn} disabled={saving || processingImage !== null}>
                  {isEditing ? 'Сохранить видео' : 'Добавить видео'}
                </button>
              </div>
            </div>
          </form>

          <aside className={s.sidePanel}>
            <div className={s.panelHead}>
              <div>
                <h2>Канал</h2>
                <span>Изменения применяются после сохранения</span>
              </div>
              <button type="button" className={s.ghostBtn} onClick={() => setChannelDraft({
                ...CHANNEL_DEFAULTS,
                dashboardComments: CHANNEL_DEFAULTS.dashboardComments.map((item) => ({ ...item })),
                recentSubscribers: CHANNEL_DEFAULTS.recentSubscribers.map((item) => ({ ...item })),
              })}>Заполнить по умолчанию</button>
            </div>
            <div className={s.avatarRow}>
              <ChannelAvatar className={s.avatarPreview} src={editableChannel.avatar} />
              <div className={s.avatarActions}>
                <label className={s.uploadBtn}>
                  {processingImage === 'avatar'
                    ? 'Сжимаем…'
                    : editableChannel.avatar
                      ? 'Заменить'
                      : 'Загрузить'}
                  <input
                    type="file"
                    accept={STUDIO_IMAGE_ACCEPT}
                    onChange={onAvatarChange}
                    disabled={processingImage !== null}
                  />
                </label>
                {editableChannel.avatar ? <button type="button" className={s.linkBtn} onClick={onAvatarRemove}>Удалить</button> : null}
                <div className={s.mediaHint}>
                  До {formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}, хранится как WebP до {formatImageBytes(MAX_STORED_IMAGE_BYTES)}
                </div>
              </div>
            </div>
            <div className={s.channelFields}>
              <label className={s.field}>
                <span>Название канала</span>
                <input className={s.input} value={editableChannel.channelName} onChange={(e) => updateChannelDraft({ channelName: e.target.value })} />
              </label>
              <label className={s.field}>
                <span>Подписчики</span>
                <input className={s.input} type="number" min="0" value={editableChannel.subscriberCount} onChange={(e) => updateChannelDraft({ subscriberCount: parseCount(e.target.value) || 0 })} />
              </label>
              <label className={s.field}>
                <span>Страна</span>
                <select className={s.input} value={editableChannel.country} onChange={(e) => updateChannelDraft({ country: e.target.value })}>
                  {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </label>
              <label className={s.field}>
                <span>Дата создания</span>
                <input className={s.input} type="date" value={editableChannel.joinDate} onChange={(e) => updateChannelDraft({ joinDate: e.target.value })} />
              </label>
              <label className={s.toggleRow}>
                <input type="checkbox" checked={!!editableChannel.monetizationEnabled} onChange={(e) => updateChannelDraft({ monetizationEnabled: e.target.checked })} />
                <span className={s.toggleSwitch}><span /></span>
                <strong>Монетизация</strong>
              </label>
              <button type="button" className={s.submitBtn} onClick={onSaveChannel} disabled={saving || processingImage !== null}>Сохранить канал</button>
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
                    <th>Средний %</th>
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
                      <td>
                        <input
                          className={s.tableInput}
                          aria-label="Средний процент просмотра"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={video.averageViewPercentage ?? ''}
                          onBlur={(e) => updateVideoField(video, {
                            averageViewPercentage: normalizeAverageViewPercentage(e.target.value),
                          })}
                        />
                      </td>
                      <td><input className={s.tableInput} type="number" min="0" defaultValue={video.views} onBlur={(e) => updateVideoField(video, { views: parseCount(e.target.value) ?? 0 })} /></td>
                      <td><input className={s.tableInput} type="number" min="0" step="0.01" defaultValue={video.revenue} onBlur={(e) => updateVideoField(video, { revenue: parseRevenue(e.target.value) ?? 0 })} /></td>
                      <td className={s.metricInputs}>
                        <input className={s.tableInput} aria-label="Лайки" type="number" min="0" defaultValue={video.likes} onBlur={(e) => updateVideoField(video, { likes: parseCount(e.target.value) ?? 0 })} />
                        <input className={s.tableInput} aria-label="Дизлайки" type="number" min="0" defaultValue={video.dislikes} onBlur={(e) => updateVideoField(video, { dislikes: parseCount(e.target.value) ?? 0 })} />
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

        <section className={`${s.librarySection} ${s.subscriberHistorySection}`}>
          <div className={s.libraryHead}>
            <div>
              <h2>История подписчиков ({subscriberDailyStats.length})</h2>
              <span className={s.sectionHint}>
                Укажите дневной прирост. При изменении общего числа подписчиков история автоматически масштабируется и сохраняется в Supabase.
              </span>
            </div>
            <div className={s.toolbar}>
              <button type="button" className={s.ghostBtn} onClick={addSubscriberStat}>Добавить день</button>
              <button
                type="button"
                className={s.submitBtn}
                onClick={onSaveSubscriberStats}
                disabled={savingSubscriberStats || subscriberStatsDraft === null}
              >
                {savingSubscriberStats ? 'Сохранение…' : 'Сохранить историю'}
              </button>
            </div>
          </div>

          {subscriberStatsRows.length === 0 ? (
            <div className={s.empty}>Истории пока нет. Добавьте первый день.</div>
          ) : (
            <div className={`${s.tableWrap} ${s.subscriberStatsTableWrap}`}>
              <table className={`${s.table} ${s.subscriberStatsTable}`}>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Прирост</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subscriberStatsRows.map((row) => {
                    return (
                      <tr key={`${row.date}-${row.sourceIndex}`}>
                        <td>
                          <input
                            className={s.tableInput}
                            type="date"
                            max={analyticsYesterdayISO()}
                            value={row.date}
                            onChange={(event) => updateSubscriberStat(row.sourceIndex, { date: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className={s.tableInput}
                            type="number"
                            min="0"
                            value={row.gained}
                            onChange={(event) => updateSubscriberStat(row.sourceIndex, { gained: parseCount(event.target.value) ?? 0 })}
                          />
                        </td>
                        <td className={s.actionCell}>
                          <button type="button" className={s.deleteBtn} onClick={() => removeSubscriberStat(row.sourceIndex)}>Удалить</button>
                        </td>
                      </tr>
                    )
                  })}
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
          <div className={s.dashboardActions}>
            <button type="button" className={s.ghostBtn} onClick={onResetDashboardBlocks}>Заполнить блоки по умолчанию</button>
            <button type="button" className={s.submitBtn} onClick={onSaveChannel} disabled={saving}>Сохранить блоки</button>
          </div>
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

export default function Screen11Admin() {
  return (
    <AdminGate>
      <Screen11AdminContent />
    </AdminGate>
  )
}
