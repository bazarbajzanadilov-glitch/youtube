import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import s from './DateRangePicker.module.css'
import { ChevronDown } from '../../screens/icons.jsx'
import { RANGE_OPTIONS } from '../../lib/analyticsAggregator.js'

const RU_MONTHS = ['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.']
const RU_MONTH_LABELS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function formatRangeLabel(range) {
  if (!range) return 'Выбрать период'
  if (range.kind === 'lifetime') return 'Все время'
  const yearMatch = /^year-(\d{4})$/.exec(range.kind || '')
  if (yearMatch) return yearMatch[1]
  const monthMatch = /^month-(\d{4})-(\d{2})$/.exec(range.kind || '')
  if (monthMatch) return RU_MONTH_LABELS[Number(monthMatch[2]) - 1] || range.label || 'Месяц'
  if (range.kind === 'custom' && range.from && range.to) {
    const f = new Date(range.from); const t = new Date(range.to)
    return `${f.getDate()} ${RU_MONTHS[f.getMonth()]} – ${t.getDate()} ${RU_MONTHS[t.getMonth()]} ${t.getFullYear()}`
  }
  const opt = RANGE_OPTIONS.find((r) => r.kind === range.kind)
  return opt?.label || 'Выбрать период'
}

function formatDateShort(date) {
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`
}

function formatDateRangeSub(range) {
  if (!range) return ''
  if (range.kind === 'lifetime') return 'Все данные'
  const fixedRange = getFixedRange(range)
  if (fixedRange) return formatDateRange(fixedRange.from, fixedRange.to)
  if (range.kind === 'custom' && range.from && range.to) {
    const from = new Date(range.from)
    const to = new Date(range.to)
    return formatDateRange(from, to)
  }
  const opt = RANGE_OPTIONS.find((r) => r.kind === range.kind)
  const days = opt?.days
  if (!days) return 'Выбранный период'
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - (days - 1))
  return formatDateRange(from, to)
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateRange(from, to) {
  return `${formatDateShort(from)} – ${formatDateShort(to)} ${to.getFullYear()} г.`
}

function getFixedRange(range, today = new Date()) {
  const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yearMatch = /^year-(\d{4})$/.exec(range?.kind || '')
  if (yearMatch) {
    const year = Number(yearMatch[1])
    const from = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    const to = end > todayD && from <= todayD ? todayD : end
    return { from, to }
  }
  const monthMatch = /^month-(\d{4})-(\d{2})$/.exec(range?.kind || '')
  if (monthMatch) {
    const year = Number(monthMatch[1])
    const month = Number(monthMatch[2]) - 1
    const from = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    const to = end > todayD && from <= todayD ? todayD : end
    return { from, to }
  }
  return null
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function buildMenuGroups(today = new Date()) {
  const year = today.getFullYear()
  const monthGroups = []
  for (let i = 0; i < 3; i += 1) {
    const date = new Date(year, today.getMonth() - i, 1)
    const optionYear = date.getFullYear()
    const optionMonth = date.getMonth()
    monthGroups.push({
      kind: `month-${optionYear}-${pad2(optionMonth + 1)}`,
      label: RU_MONTH_LABELS[optionMonth],
    })
  }
  return [
    RANGE_OPTIONS.filter((opt) => ['7d', '28d', '90d', '365d', 'lifetime'].includes(opt.kind)),
    [
      { kind: `year-${year}`, label: String(year) },
      { kind: `year-${year - 1}`, label: String(year - 1) },
    ],
    monthGroups,
    [{ kind: 'custom', label: 'Другой диапазон дат' }],
  ]
}

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(value?.from || isoToday())
  const [customTo, setCustomTo] = useState(value?.to || isoToday())
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) {
        setOpen(false)
        setShowCustom(false)
      }
    }
    function onEsc(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function pick(opt) {
    if (opt.kind === 'custom') {
      setShowCustom(true)
      return
    }
    onChange?.({ kind: opt.kind, label: opt.label })
    setOpen(false)
    setShowCustom(false)
  }

  function applyCustom() {
    if (customFrom && customTo) {
      onChange?.({ kind: 'custom', from: customFrom, to: customTo })
      setOpen(false)
      setShowCustom(false)
    }
  }

  const label = formatRangeLabel(value)
  const sub = formatDateRangeSub(value)
  const menuGroups = buildMenuGroups()

  return (
    <div className={s.wrap} ref={ref}>
      <button type="button" className={s.trigger} onClick={() => setOpen((o) => !o)}>
        <span className={s.sub}>{sub}</span>
        <span className={s.main}>
          {label} <ChevronDown size={16}/>
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={s.menu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {!showCustom ? (
              <div className={s.list}>
                {menuGroups.map((group, groupIndex) => (
                  <div className={s.group} key={group.map((opt) => opt.kind).join('-')}>
                    {group.map((opt) => (
                    <button
                      key={opt.kind}
                      type="button"
                      className={`${s.item} ${value?.kind === opt.kind ? s.itemActive : ''}`}
                      onClick={() => pick(opt)}
                    >
                      <span>{opt.label}</span>
                    </button>
                    ))}
                    {groupIndex < menuGroups.length - 1 ? <span className={s.separator} aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className={s.custom}>
                <div className={s.customTitle}>Другой диапазон дат</div>
                <label className={s.customField}>
                  <span>С</span>
                  <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
                </label>
                <label className={s.customField}>
                  <span>По</span>
                  <input type="date" value={customTo} min={customFrom} max={isoToday()} onChange={(e) => setCustomTo(e.target.value)} />
                </label>
                <div className={s.customActions}>
                  <button type="button" className={s.cancelBtn} onClick={() => setShowCustom(false)}>Назад</button>
                  <button type="button" className={s.applyBtn} onClick={applyCustom}>Применить</button>
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
