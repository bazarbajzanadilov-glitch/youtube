import { useEffect, useRef, useState } from 'react'

/**
 * Черновик, который сам сохраняется через `delay` мс после последней правки.
 * serverValue — то же значение в форме черновика, собранное из данных сервера.
 * Пока черновик не трогали, он следует за сервером; после сохранения сервер
 * обновится и черновик снова станет «чистым». При уходе со страницы
 * несохранённая правка отправляется сразу.
 */
export function useAutoSavedDraft(serverValue, save, { delay = 700 } = {}) {
  const serverKey = JSON.stringify(serverValue)
  const [state, setState] = useState({ draft: serverValue, baseKey: serverKey })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const saveRef = useRef(save)
  const pendingRef = useRef(null)
  const [lastSavedKey, setLastSavedKey] = useState(null)

  let { draft } = state
  if (state.baseKey !== serverKey) {
    const dirtyAgainstOld = JSON.stringify(state.draft) !== state.baseKey
    draft = dirtyAgainstOld ? state.draft : serverValue
    setState({ draft, baseKey: serverKey })
  }

  const draftKey = JSON.stringify(draft)
  const dirty = draftKey !== serverKey && draftKey !== lastSavedKey

  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    if (!dirty) {
      pendingRef.current = null
      return undefined
    }
    pendingRef.current = draft
    const timer = setTimeout(async () => {
      pendingRef.current = null
      setSaving(true)
      try {
        await saveRef.current(draft)
        setLastSavedKey(draftKey)
        setError(null)
      } catch (saveError) {
        setError(saveError)
      } finally {
        setSaving(false)
      }
    }, delay)
    return () => clearTimeout(timer)
    // draftKey описывает draft целиком
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, dirty, delay])

  useEffect(() => () => {
    if (pendingRef.current) saveRef.current(pendingRef.current)?.catch?.(() => {})
  }, [])

  const setDraft = (update) => setState((current) => ({
    ...current,
    draft: typeof update === 'function' ? update(current.draft) : update,
  }))

  const status = error ? 'error' : saving ? 'saving' : dirty ? 'pending' : 'saved'
  return [draft, setDraft, status]
}
