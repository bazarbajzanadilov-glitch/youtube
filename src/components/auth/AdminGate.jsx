import { useEffect, useState } from 'react'
import {
  getAdminSession,
  isCurrentUserAdmin,
  signInAdmin,
  signOutAdmin,
  subscribeAdminAuth,
  updateAdminPassword,
} from '../../data/adminRepository.js'
import { isSupabaseConfigured } from '../../lib/supabaseClient.js'
import s from './AdminGate.module.css'

const ADMIN_EMAIL = 'bazarbajzanadilov@gmail.com'

export default function AdminGate({ children }) {
  const configured = isSupabaseConfigured()
  const setupRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('adminSetup') === '1'
  const [status, setStatus] = useState(configured ? 'checking' : 'signed-out')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState(configured ? '' : 'Supabase не настроен для этого окружения')

  useEffect(() => {
    let active = true

    const verify = async (session) => {
      if (!active) return
      if (!session) {
        setStatus('signed-out')
        return
      }
      const allowed = await isCurrentUserAdmin()
      if (!active) return
      if (allowed) setStatus(setupRequested ? 'setup' : 'ready')
      else {
        await signOutAdmin().catch(() => {})
        setError('У этой учётной записи нет доступа к админке')
        setStatus('signed-out')
      }
    }

    if (!configured) {
      return () => {
        active = false
      }
    }

    getAdminSession()
      .then(verify)
      .catch((nextError) => {
        if (!active) return
        setError(nextError.message || 'Не удалось проверить сессию')
        setStatus('signed-out')
      })

    const unsubscribe = subscribeAdminAuth(verify)
    return () => {
      active = false
      unsubscribe()
    }
  }, [configured, setupRequested])

  async function onSubmit(event) {
    event.preventDefault()
    if (!password) return
    setStatus('signing-in')
    setError('')
    try {
      const session = await signInAdmin(ADMIN_EMAIL, password)
      if (!(await isCurrentUserAdmin())) {
        await signOutAdmin()
        throw new Error('У этой учётной записи нет доступа к админке')
      }
      if (session) setStatus('ready')
    } catch (nextError) {
      setError(nextError.message || 'Неверный пароль')
      setStatus('signed-out')
    }
  }

  async function onPasswordSetup(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов')
      return
    }
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают')
      return
    }
    setStatus('setting-password')
    setError('')
    try {
      await updateAdminPassword(password)
      window.location.replace('/#/admin')
    } catch (nextError) {
      setError(nextError.message || 'Не удалось установить пароль')
      setStatus('setup')
    }
  }

  if (status === 'ready') return children
  const isSetupForm = setupRequested && (status === 'setup' || status === 'setting-password')

  return (
    <div className={s.shell}>
      <form className={s.card} onSubmit={isSetupForm ? onPasswordSetup : onSubmit}>
        <div className={s.mark}>YT</div>
        <h1>{isSetupForm ? 'Создайте пароль админки' : 'Вход в админку'}</h1>
        <p>{ADMIN_EMAIL}</p>
        <label>
          <span>{isSetupForm ? 'Новый пароль' : 'Пароль'}</span>
          <input
            type="password"
            autoComplete={isSetupForm ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={status === 'checking' || status === 'signing-in' || status === 'setting-password'}
            autoFocus
          />
        </label>
        {isSetupForm ? (
          <label className={s.confirmField}>
            <span>Повторите пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              disabled={status === 'setting-password'}
            />
          </label>
        ) : null}
        {error ? <div className={s.error}>{error}</div> : null}
        <button
          type="submit"
          disabled={!password || status === 'checking' || status === 'signing-in' || status === 'setting-password'}
        >
          {status === 'checking'
            ? 'Проверка…'
            : status === 'signing-in'
              ? 'Вход…'
              : status === 'setting-password'
                ? 'Сохранение…'
                : isSetupForm
                  ? 'Установить пароль'
                  : 'Войти'}
        </button>
      </form>
    </div>
  )
}
