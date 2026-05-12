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

const COUNTRIES = [
  { code: 'RU', label: 'Россия' },
  { code: 'US', label: 'США' },
  { code: 'DE', label: 'Германия' },
  { code: 'BR', label: 'Бразилия' },
  { code: 'IN', label: 'Индия' },
  { code: 'KZ', label: 'Казахстан' },
]

const todayISO = () => new Date().toISOString().slice(0, 10)
const blankForm = () => ({
  id: null, title: '', cover: null, date: todayISO(),
  duration: '', views: '', revenue: '',
})

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Screen11Admin() {
  const { showToast } = useContext(NavContext)
  const {
    videos, totals, add, update, remove, clear,
    removeMany, bulkAddRandom, importVideos, exportToFile, resetToBundled,
  } = useVideos()
  const { channel, update: updateChannel, reset: resetChannel } = useChannel()
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkCount, setBulkCount] = useState('5')
  const fileInputRef = useRef(null)
  const [confirmState, setConfirmState] = useState(null)
  const [confirmChecked, setConfirmChecked] = useState(false)

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
      duration: v.duration, views: String(v.views), revenue: String(v.revenue),
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

  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="admin"/>
      <div className={`${s.main} ${s.adminMain}`}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Админка · фейк-видео</h1>
          <button type="button" className={s.dangerBtn} onClick={onClearAll} disabled={videos.length === 0}>
            Удалить все ({videos.length})
          </button>
        </div>

        <div className={s.helpNote}>
          Видео хранятся в <code>localStorage</code>, а стартовый набор лежит в <code>public/data/videos.json</code>.
          Кнопка <b>«Экспорт JSON»</b> скачивает текущее состояние — положите этот файл в <code>public/data/videos.json</code> вашего репо,
          и при следующем «чистом» открытии сайта (или после кнопки <b>«Сбросить к коду»</b>) он подгрузится заново.
          Папка <code>public/data/</code> при обновлении кода не трогается — добавленные видео не удаляются.
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
              style={channel.avatar ? { backgroundImage: `url(${channel.avatar})` } : undefined}
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
                <div className={s.field}><label className={s.label}>Просмотры</label>
                  <input type="number" min="0" className={s.input} placeholder="случайное 1000–500 000" value={form.views} onChange={(e) => setField('views', e.target.value)}/></div>
                <div className={s.field}><label className={s.label}>Доход за видео ($)</label>
                  <input type="number" min="0" step="0.01" className={s.input} placeholder="расчётный доход" value={form.revenue} onChange={(e) => setField('revenue', e.target.value)}/></div>
              </div>
              {computed ? (
                <div className={s.previewBox}>
                  <span className={s.label}>Авто-расчёт</span>
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
          <button type="button" className={s.toolbarBtn} onClick={onExport}>⬇ Экспорт JSON</button>
          <button type="button" className={s.toolbarBtn} onClick={onImportClick}>⬆ Импорт JSON</button>
          <button type="button" className={s.toolbarBtn} onClick={onReset}>⟲ Сбросить к коду</button>
          <input type="file" accept="application/json,.json" ref={fileInputRef} className={s.inlineFile} onChange={onImportFile}/>
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
