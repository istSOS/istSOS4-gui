type ObservedMarkerMeta = {
  __sourceColor?: string
  __freshnessStatus?: string
}

export function getDominantSourceColor(
  children: ObservedMarkerMeta[],
  fallbackColor = '#ff0000'
) {
  const counts = new Map<string, number>()

  for (const child of children) {
    const color = String(child?.__sourceColor ?? '').trim()
    if (!color) continue
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }

  let dominantColor = fallbackColor
  let bestCount = 0
  for (const [color, count] of counts.entries()) {
    if (count > bestCount) {
      dominantColor = color
      bestCount = count
    }
  }
  return dominantColor
}

export function getObservedClusterBorderColor(children: ObservedMarkerMeta[]) {
  let hasFresh = false
  let hasStale = false
  let hasUnknown = false

  for (const child of children) {
    const status = String(child?.__freshnessStatus ?? '').trim()
    if (status === 'fresh') hasFresh = true
    else if (status === 'stale') hasStale = true
    else if (status === 'mixed') {
      hasFresh = true
      hasStale = true
    } else hasUnknown = true
  }

  if (hasFresh && hasStale) return '#f59e0b'
  if (hasStale) return '#dc2626'
  if (hasFresh && hasUnknown) return '#f59e0b'
  if (hasFresh) return '#16a34a'
  return '#64748b'
}
