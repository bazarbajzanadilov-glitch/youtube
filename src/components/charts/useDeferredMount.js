/**
 * Графики монтируются сразу: вкладки аналитики больше не прячутся в AnimatePresence,
 * поэтому отложенный mount может оставить chart пустым в фоновой панели браузера.
 */
export function useDeferredMount() {
  return true
}
