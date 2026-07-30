function normalizeRows(stats) {
  const byDate = new Map()
  for (const item of Array.isArray(stats) ? stats : []) {
    const date = String(item?.date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    byDate.set(date, {
      ...item,
      date,
      gained: Math.max(0, Math.trunc(Number(item.gained) || 0)),
      lost: 0,
    })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function allocateByWeights(weights, total) {
  const target = Math.max(0, Math.trunc(Number(total) || 0))
  if (weights.length === 0 || target === 0) {
    return new Array(weights.length).fill(0)
  }

  const safeWeights = weights.map((value) => Math.max(0, Number(value) || 0))
  let weightTotal = safeWeights.reduce((sum, value) => sum + value, 0)
  if (weightTotal <= 0) {
    safeWeights.fill(1)
    weightTotal = safeWeights.length
  }

  const exact = safeWeights.map((weight) => (target * weight) / weightTotal)
  const allocated = exact.map(Math.floor)
  let remainder = target - allocated.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let index = 0; remainder > 0; index += 1) {
    allocated[order[index % order.length].index] += 1
    remainder -= 1
  }
  return allocated
}

function recentWeights(rows, startIndex) {
  return rows.slice(startIndex).map((row, offset) => {
    const sourceIndex = startIndex + offset
    const averageStart = Math.max(0, sourceIndex - 6)
    const source = rows.slice(averageStart, sourceIndex + 1)
    const average = source.reduce((sum, item) => sum + item.gained, 0)
      / Math.max(1, source.length)
    return Math.max(1, average)
  })
}

function dateOrdinal(date) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)
}

function targetTemporalTilt(date, target) {
  const ordinal = dateOrdinal(date)
  const phase = Math.log1p(Math.max(0, target)) * 0.83
  return Math.exp(
    (0.24 * Math.sin(((2 * Math.PI * ordinal) / 83) + phase))
    + (0.08 * Math.sin(((2 * Math.PI * ordinal) / 29) - (phase * 0.37))),
  )
}

function protectedFloorIndices(rowCount, windowDays, target) {
  const comparisonDays = Math.max(1, windowDays)
  const protectedStart = Math.max(0, rowCount - (comparisonDays * 2))
  const currentStart = Math.max(protectedStart, rowCount - comparisonDays)
  const current = Array.from(
    { length: rowCount - currentStart },
    (_, index) => currentStart + index,
  )
  const previous = Array.from(
    { length: currentStart - protectedStart },
    (_, index) => protectedStart + index,
  )
  const priority = []
  const priorityLength = Math.max(current.length, previous.length)

  for (let index = 0; index < priorityLength; index += 1) {
    if (current[index] != null) priority.push(current[index])
    if (previous[index] != null) priority.push(previous[index])
  }

  return priority.slice(0, Math.min(priority.length, target))
}

function repairCollapsedComparisonWeights(rows, windowDays) {
  const comparisonStart = Math.max(0, rows.length - (windowDays * 2))
  const sourceDailyAverage = Math.max(
    1,
    Math.round(
      rows.reduce((sum, row) => sum + row.gained, 0)
      / Math.max(1, rows.length),
    ),
  )

  return rows.map((row, index) => (
    index >= comparisonStart && row.gained === 0
      ? { ...row, gained: sourceDailyAverage }
      : row
  ))
}

function redistributeSubscriberHistory(rows, target, windowDays) {
  const floors = new Array(rows.length).fill(0)
  const protectedIndices = protectedFloorIndices(
    rows.length,
    windowDays,
    target,
  )
  protectedIndices.forEach((index) => {
    floors[index] = 1
  })

  const remaining = target - protectedIndices.length
  const allocations = allocateByWeights(
    rows.map((row) => (
      Math.max(1, row.gained) * targetTemporalTilt(row.date, target)
    )),
    remaining,
  )

  return rows.map((row, index) => ({
    ...row,
    gained: floors[index] + allocations[index],
    lost: 0,
  }))
}

/**
 * Reconciles stored positive subscriber gains to an authoritative channel
 * total. Only the newest window absorbs an increase, so changing the channel
 * total changes the current-period KPI and comparison instead of scaling both
 * adjacent periods by the same percentage.
 */
export function reconcileSubscriberHistoryToTotal(
  stats,
  targetTotal,
  { windowDays = 28 } = {},
) {
  const rows = normalizeRows(stats)
  if (rows.length === 0) return rows

  const target = Math.max(0, Math.trunc(Number(targetTotal) || 0))
  const current = rows.reduce((sum, row) => sum + row.gained, 0)
  let delta = target - current
  const comparisonDays = Math.max(1, windowDays)
  const currentStart = Math.max(0, rows.length - comparisonDays)
  const previousStart = Math.max(0, currentStart - comparisonDays)
  const currentWindowTotal = rows
    .slice(currentStart)
    .reduce((sum, row) => sum + row.gained, 0)
  const previousWindowTotal = rows
    .slice(previousStart, currentStart)
    .reduce((sum, row) => sum + row.gained, 0)
  const needsCollapsedHistoryRepair = (
    target > 0
    && currentWindowTotal === 0
    && previousWindowTotal > 0
  )
  if (delta === 0 && !needsCollapsedHistoryRepair) return rows

  const recentStart = Math.max(0, rows.length - Math.max(1, windowDays))
  const recentIndices = Array.from(
    { length: rows.length - recentStart },
    (_, index) => recentStart + index,
  )

  if (delta > 0) {
    const additions = allocateByWeights(
      recentWeights(rows, recentStart),
      delta,
    )
    recentIndices.forEach((rowIndex, index) => {
      rows[rowIndex].gained += additions[index]
    })
    return rows
  }

  const redistributionSource = needsCollapsedHistoryRepair
    ? repairCollapsedComparisonWeights(rows, comparisonDays)
    : rows
  return redistributeSubscriberHistory(
    redistributionSource,
    target,
    comparisonDays,
  )
}
