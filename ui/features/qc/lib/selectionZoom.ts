import type { QcRow } from './types'

/** null means the full series. A single observation retains nearby context. */
export function selectionZoom(
  rows: QcRow[],
  selected: string[]
): {
  startValue: number
  endValue: number
} | null {
  const ordered = rows
    .filter((row) => Number.isFinite(row.ts))
    .sort((a, b) => a.ts - b.ts)
  if (ordered.length < 2 || !selected.length) return null
  const keys = new Set(selected)
  const targets = ordered.filter((row) => keys.has(row.key))
  if (!targets.length || targets.length === ordered.length) return null
  const gaps = ordered
    .slice(1)
    .map((row, index) => row.ts - ordered[index].ts)
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b)
  const step = gaps[Math.floor(gaps.length / 2)] ?? 60000
  const from = targets[0].ts
  const to = targets.at(-1)!.ts
  const padding = from === to ? 2 * step : Math.max(step, (to - from) * 0.1)
  const startValue = Math.max(ordered[0].ts, from - padding)
  const endValue = Math.min(ordered.at(-1)!.ts, to + padding)
  return endValue > startValue ? { startValue, endValue } : null
}
