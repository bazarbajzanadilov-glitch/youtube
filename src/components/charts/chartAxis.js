const NICE_STEPS = [1, 2, 2.5, 3, 4, 5, 10]
// Как в YouTube Studio: верх оси прижат к пику (0 / 125 тыс. / 250 тыс. / 375 тыс.),
// чтобы график не сплющивался.
const TIGHT_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]
const STEP_EPSILON = 1e-8

function cleanTick(value) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(8))
}

function stepCandidates(maxDisplayValue, steps = NICE_STEPS) {
  const safeMax = Math.max(0, Number(maxDisplayValue) || 0)
  if (safeMax === 0) return [1]
  const magnitude = 10 ** Math.floor(Math.log10(safeMax))
  const candidates = []
  for (let power = magnitude / 100; power <= magnitude * 10; power *= 10) {
    steps.forEach((step) => candidates.push(step * power))
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
  const safeTickCount = Math.max(2, Number(targetTickCount) || 2)
  if (displayMax === 0) {
    return Array.from({ length: safeTickCount }, (_, index) => cleanTick(index / safeScale))
  }

  const intervalCount = safeTickCount - 1
  const step = stepCandidates(displayMax, TIGHT_STEPS)
    .find((candidate) => (candidate * intervalCount) >= displayMax - STEP_EPSILON)
    || niceStep(displayMax, safeTickCount)

  return Array.from({ length: safeTickCount }, (_, index) => cleanTick((index * step) / safeScale))
}

export function buildSignedAxisTicks(minValue, maxValue, { targetTickCount = 5 } = {}) {
  const safeMin = Math.min(0, Number(minValue) || 0)
  const safeMax = Math.max(0, Number(maxValue) || 0)
  const safeTickCount = Math.max(3, Number(targetTickCount) || 3)
  const span = safeMax - safeMin
  if (span === 0) return [-1, 0, 1]

  const step = niceStep(span, safeTickCount)
  const axisMin = Math.floor(safeMin / step) * step
  const axisMax = Math.ceil(safeMax / step) * step
  const ticks = []
  for (let value = axisMin; value <= axisMax + STEP_EPSILON; value += step) {
    ticks.push(cleanTick(value))
  }
  return ticks.length >= 2 ? ticks : [cleanTick(axisMin), cleanTick(axisMax || step)]
}

export function projectValueToPeakAxis(value, ticks) {
  const numericValue = Number(value) || 0
  if (!Array.isArray(ticks) || ticks.length < 2) return numericValue
  const lastIndex = ticks.length - 1
  const minValue = Number(ticks[0]) || 0
  const maxValue = Number(ticks[lastIndex]) || 0
  if (numericValue <= minValue) return 0
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

export function minByDataKey(data, key) {
  if (!Array.isArray(data)) return 0
  return data.reduce((min, row) => Math.min(min, Number(row?.[key]) || 0), 0)
}
