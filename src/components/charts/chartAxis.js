const NICE_STEPS = [1, 2, 2.5, 5, 10]

function cleanTick(value) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(8))
}

function stepCandidates(maxDisplayValue) {
  const safeMax = Math.max(0, Number(maxDisplayValue) || 0)
  if (safeMax === 0) return [1]
  const magnitude = 10 ** Math.floor(Math.log10(safeMax))
  const candidates = []
  for (let power = magnitude / 100; power <= magnitude * 10; power *= 10) {
    NICE_STEPS.forEach((step) => candidates.push(step * power))
  }
  return candidates
    .filter((step) => Number.isFinite(step) && step > 0)
    .sort((a, b) => a - b)
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

export function buildPeakAxisTicks(maxValue, { scale = 1, targetTickCount = 5, maxTickCount = 6 } = {}) {
  const safeScale = Number(scale) > 0 ? Number(scale) : 1
  const displayMax = Math.max(0, Number(maxValue) || 0) * safeScale
  if (displayMax === 0) return [0, cleanTick(1 / safeScale)]

  const candidates = stepCandidates(displayMax)
  const fallback = niceStep(displayMax, targetTickCount)
  const maxCount = Math.max(3, Number(maxTickCount) || targetTickCount + 1)
  const step = candidates
    .map((candidate) => ({
      step: candidate,
      tickCount: Math.floor(displayMax / candidate) + 2,
    }))
    .filter((candidate) => (
      candidate.step < displayMax &&
      candidate.tickCount >= 3 &&
      candidate.tickCount <= maxCount
    ))
    .sort((a, b) => {
      const aDistance = Math.abs(a.tickCount - targetTickCount)
      const bDistance = Math.abs(b.tickCount - targetTickCount)
      if (aDistance !== bDistance) return aDistance - bDistance
      return b.step - a.step
    })[0]?.step || fallback

  const displayTicks = []
  for (let value = 0; value < displayMax; value += step) {
    displayTicks.push(cleanTick(value))
  }
  const last = displayTicks[displayTicks.length - 1]
  if (last == null || Math.abs(last - displayMax) > Math.max(1e-8, displayMax * 1e-10)) {
    displayTicks.push(cleanTick(displayMax))
  }

  return displayTicks.map((value) => cleanTick(value / safeScale))
}

export function projectValueToPeakAxis(value, ticks) {
  const numericValue = Math.max(0, Number(value) || 0)
  if (!Array.isArray(ticks) || ticks.length < 2) return numericValue
  const lastIndex = ticks.length - 1
  const maxValue = Number(ticks[lastIndex]) || 0
  if (numericValue >= maxValue) return lastIndex

  for (let index = 0; index < lastIndex; index += 1) {
    const low = Number(ticks[index]) || 0
    const high = Number(ticks[index + 1]) || 0
    if (numericValue <= high) {
      if (high <= low) return index + 1
      return cleanTick(index + ((numericValue - low) / (high - low)))
    }
  }

  return lastIndex
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
