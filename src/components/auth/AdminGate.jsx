import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAdminSession,
  isCurrentUserAdmin,
  restoreAdminSiteSession,
  signInAdmin,
  signOutAdmin,
  subscribeAdminAuth,
  updateAdminPassword,
} from '../../data/adminRepository.js'
import { loadRemoteProject } from '../../data/projectStore.js'
import { isSupabaseConfigured } from '../../lib/supabaseClient.js'
import s from './AdminGate.module.css'

export default function AdminGate({ children }) {
  const configured = isSupabaseConfigured()
  const setupRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('adminSetup') === '1'
  const directAdminEntry = typeof window !== 'undefined'
    && window.location.pathname.replace(/\/+$/, '') === '/admin'
  const [status, setStatus] = useState(configured ? 'checking' : 'signed-out')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState(configured ? '' : 'Supabase не настроен для этого окружения')
  const completionRef = useRef(null)

  const completeAdminSession = useCallback((session, { finishSetup = false } = {}) => {
    if (!session) return Promise.resolve()
    if (setupRequested && !finishSetup) {
      setStatus('setup')
      return Promise.resolve()
    }
    if (!directAdminEntry && !finishSetup) {
      setStatus('ready')
      return Promise.resolve()
    }
    if (completionRef.current) return completionRef.current

    setStatus('loading-data')
    const completion = (async () => {
      await restoreAdminSiteSession(session)
      await loadRemoteProject({ force: true })
      window.history.replaceState(null, '', '/#/admin')
      setStatus('ready')
    })().finally(() => {
      completionRef.current = null
    })
    completionRef.current = completion
    return completion
  }, [directAdminEntry, setupRequested])

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
      if (allowed) await completeAdminSession(session)
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

    const handleVerificationError = (nextError) => {
      if (!active) return
      setError(nextError.message || 'Не удалось проверить сессию')
      setStatus('signed-out')
    }

    getAdminSession()
      .then(verify)
      .catch(handleVerificationError)

    const unsubscribe = subscribeAdminAuth((session) => {
      verify(session).catch(handleVerificationError)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [completeAdminSession, configured])

  async function onSubmit(event) {
    event.preventDefault()
    if (!password) return
    setStatus('signing-in')
    setError('')
    try {
      const session = await signInAdmin(password)
      await completeAdminSession(session)
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
      const session = await getAdminSession()
      await completeAdminSession(session, { finishSetup: true })
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
        <label>
          <span>{isSetupForm ? 'Новый пароль' : 'Пароль'}</span>
          <input
            type="password"
            autoComplete={isSetupForm ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={status === 'checking' || status === 'signing-in' || status === 'loading-data' || status === 'setting-password'}
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
          disabled={!password || status === 'checking' || status === 'signing-in' || status === 'loading-data' || status === 'setting-password'}
        >
          {status === 'checking'
            ? 'Проверка…'
            : status === 'signing-in'
              ? 'Вход…'
              : status === 'loading-data'
                ? 'Загрузка…'
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
