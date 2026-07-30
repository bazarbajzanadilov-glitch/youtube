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

function reduceRange(rows, indices, amount) {
  const available = indices.reduce((sum, index) => sum + rows[index].gained, 0)
  const batch = Math.min(Math.max(0, amount), available)
  if (batch <= 0) return 0

  const reductions = allocateByWeights(
    indices.map((index) => rows[index].gained),
    batch,
  )
  indices.forEach((rowIndex, index) => {
    rows[rowIndex].gained = Math.max(0, rows[rowIndex].gained - reductions[index])
  })
  return batch
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
  if (delta === 0) return rows

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

  delta = -delta
  delta -= reduceRange(rows, recentIndices, delta)
  if (delta > 0 && recentStart > 0) {
    const olderIndices = Array.from(
      { length: recentStart },
      (_, index) => recentStart - index - 1,
    )
    delta -= reduceRange(rows, olderIndices, delta)
  }

  if (delta > 0) {
    throw new Error('Subscriber history cannot be reconciled to the requested total')
  }
  return rows
}
