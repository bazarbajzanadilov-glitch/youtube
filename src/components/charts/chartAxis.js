const NICE_STEPS = [1, 2, 2.5, 5, 10]

function cleanTick(value) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(8))
}

function niceStep(maxDisplayValue, targetTickCount) {
  const safeMax = Math.max(0, Number(maxDisplayValue) || 0)
  if (safeMax === 0) return 1
  const roughStep = safeMax / Math.max(1, targetTickCount - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const fraction = roughStep / magnitude
  const niceFraction = NICE_STEPS.find((step) => fraction <= step) || 10
  return niceFraction * magnitude
}

export function buildNiceAxisTicks(maxValue, { scale = 1, targetTickCount = 5 } = {}) {
  const safeScale = Number(scale) > 0 ? Number(scale) : 1
  const displayMax = Math.max(0, Number(maxValue) || 0) * safeScale
  if (displayMax === 0) return [0, cleanTick(1 / safeScale)]

  const step = niceStep(displayMax, targetTickCount)
  const axisMax = Math.max(step, Math.ceil(displayMax / step) * step)
  const count = Math.max(1, Math.round(axisMax / step))

  return Array.from({ length: count + 1 }, (_, index) => cleanTick((index * step) / safeScale))
}

export function maxByDataKey(data, key) {
  if (!Array.isArray(data)) return 0
  return data.reduce((max, row) => Math.max(max, Number(row?.[key]) || 0), 0)
}

export function maxByStackedBars(data, bars) {
  if (!Array.isArray(data) || !Array.isArray(bars)) return 0
  return data.reduce((max, row) => {
    const total = bars.reduce((sum, bar) => sum + (Number(row?.[bar.key]) || 0), 0)
    return Math.max(max, total)
  }, 0)
}
