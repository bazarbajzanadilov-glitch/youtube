import { useState } from 'react'
import s from './InlineEdit.module.css'
import { parseHumanAmount } from '../../lib/humanAmount.js'
import { KpiDownCircleIcon, KpiUpCircleIcon } from '../icons.jsx'

function plain(value, decimals) {
  return (Number(value) || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Число, которое выглядит как на сайте, а по клику превращается в поле.
 * Понимает «5,9 млн», «250 тыс», «1 253 155,42». Enter — принять, Esc — отмена.
 */
export function InlineNumber({ value, onChange, format, decimals = 0, className = '', label, max }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  const start = () => {
    setText(plain(value, decimals))
    setEditing(true)
  }
  const commit = () => {
    const parsed = parseHumanAmount(text)
    setEditing(false)
    if (parsed == null) return
    const factor = 10 ** decimals
    let next = Math.round(parsed * factor) / factor
    if (max != null) next = Math.min(max, next)
    if (next !== value) onChange(next)
  }

  if (editing) {
    return (
      <input
        className={`${s.numberInput} ${className}`}
        autoFocus
        inputMode="decimal"
        value={text}
        aria-label={label}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setEditing(false)
        }}
        onFocus={(event) => event.currentTarget.select()}
      />
    )
  }
  return (
    <button type="button" className={`${s.editable} ${className}`} onClick={start} aria-label={label ? `${label}: изменить` : 'Изменить'}>
      {format ? format(value) : plain(value, decimals)}
    </button>
  )
}

/** Текст, который редактируется прямо на месте, без рамки. */
export function InlineText({ value, onChange, placeholder, className = '', multiline = false, label }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      className={`${s.textInput} ${multiline ? s.textArea : ''} ${className}`}
      value={value}
      placeholder={placeholder}
      aria-label={label || placeholder}
      rows={multiline ? 2 : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

const STATUS_TEXT = {
  saved: 'Сохранено',
  pending: 'Изменено…',
  saving: 'Сохранение…',
  error: 'Не сохранилось',
}

/** Маленький индикатор автосохранения. */
export function SaveStatus({ status }) {
  return (
    <span className={`${s.status} ${s[`status_${status}`] || ''}`} role="status">
      <i aria-hidden="true" />
      {STATUS_TEXT[status] || STATUS_TEXT.saved}
    </span>
  )
}

/**
 * Подпись «На 5,9 млн больше, чем обычно», где стрелка и слово «больше/меньше»
 * переключаются кликом, а цифра меняется по клику. diff — со знаком.
 */
export function DiffControl({ diff, onChange, format, decimals = 0, maxUp, label }) {
  const up = diff >= 0
  const amount = Math.abs(diff)
  const toggle = () => onChange(up ? -amount : Math.min(amount, maxUp ?? amount))
  return (
    <span className={s.diff}>
      <button type="button" className={s.diffArrow} onClick={toggle} aria-label={up ? 'Сделать «меньше»' : 'Сделать «больше»'}>
        {up ? <KpiUpCircleIcon size={18} color="#2ba640" /> : <KpiDownCircleIcon size={18} color="#909090" />}
      </button>
      <span>
        На{' '}
        <InlineNumber
          value={amount}
          decimals={decimals}
          format={format}
          label={label}
          max={up ? maxUp : undefined}
          onChange={(next) => onChange(up ? next : -next)}
        />{' '}
        <button type="button" className={s.diffWord} onClick={toggle}>{up ? 'больше' : 'меньше'}</button>, чем обычно
      </span>
    </span>
  )
}

/**
 * «На 999 % больше, чем за предыдущие 28 дней»: стрелка и слово переключают
 * «больше/меньше», цифра процента меняется по клику. percent — со знаком.
 */
export function PercentControl({ percent, onChange, label, periodLabel = 'за предыдущие 28 дней' }) {
  const up = percent >= 0
  const amount = Math.abs(percent)
  const toggle = () => onChange(up ? -Math.min(amount, 100) : amount)
  return (
    <span className={s.diff}>
      <button type="button" className={s.diffArrow} onClick={toggle} aria-label={up ? 'Сделать «меньше»' : 'Сделать «больше»'}>
        {up ? <KpiUpCircleIcon size={18} color="#2ba640" /> : <KpiDownCircleIcon size={18} color="#909090" />}
      </button>
      <span>
        На{' '}
        <InlineNumber
          value={amount}
          decimals={0}
          label={label}
          max={up ? undefined : 100}
          format={(value) => `${Math.round(value).toLocaleString('ru-RU')} %`}
          onChange={(next) => onChange(up ? next : -next)}
        />{' '}
        <button type="button" className={s.diffWord} onClick={toggle}>{up ? 'больше' : 'меньше'}</button>, чем {periodLabel}
      </span>
    </span>
  )
}
