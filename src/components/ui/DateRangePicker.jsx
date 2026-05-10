import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import s from './DateRangePicker.module.css'
import { ChevronDown } from '../../screens/icons.jsx'
import { RANGE_OPTIONS } from '../../lib/analyticsAggregator.js'

const RU_MONTHS = ['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.']

function formatRangeLabel(range) {
  if (!range) return 'Выбрать период'
  if (range.kind === 'lifetime') return 'За всё время'
  if (range.kind === 'custom' && range.from && range.to) {
    const f = new Date(range.from); const t = new Date(range.to)
    return `${f.getDate()} ${RU_MONTHS[f.getMonth()]} – ${t.getDate()} ${RU_MONTHS[t.getMonth()]} ${t.getFullYear()}`
  }
  const opt = RANGE_OPTIONS.find((r) => r.kind === range.kind)
  return opt?.label || 'Выбрать период'
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
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
    onChange?.({ kind: opt.kind })
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
  const sub = value?.kind === 'custom' ? 'Свой диапазон' : (value?.kind === 'lifetime' ? 'Все данные' : 'Период')

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
              <ul className={s.list}>
                {RANGE_OPTIONS.map((opt) => (
                  <li key={opt.kind}>
                    <button
                      type="button"
                      className={`${s.item} ${value?.kind === opt.kind ? s.itemActive : ''}`}
                      onClick={() => pick(opt)}
                    >
                      <span>{opt.label}</span>
                      {value?.kind === opt.kind ? <span className={s.dot} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={s.custom}>
                <div className={s.customTitle}>Свой диапазон</div>
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
