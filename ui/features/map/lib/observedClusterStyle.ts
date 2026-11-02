type ObservedMarkerMeta = {
  __sourceColor?: string
}

export function getDominantSourceColor(
  children: ObservedMarkerMeta[],
  fallbackColor = '#64748b'
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
