type Rect = { left: number; top: number; right: number; bottom: number }

export function overlapsMapLabel(a: Rect, b: Rect, gap = 4) {
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  )
}

/** Greedy decluttering only hides labels; station anchors remain visible. */
export function layoutMapValueLabels(container: HTMLElement) {
  const bounds = container.getBoundingClientRect()
  const obstacles = Array.from(
    container.querySelectorAll<HTMLElement>(
      '.map-station-dot, .map-cluster-count, [data-map-controls], .leaflet-control'
    ),
    (element) => element.getBoundingClientRect()
  )
  const labels = Array.from(
    container.querySelectorAll<HTMLElement>('.map-station-value')
  ).sort(
    (a, b) =>
      Number(!!b.closest('.map-marker-selected')) -
      Number(!!a.closest('.map-marker-selected'))
  )
  const placed: Rect[] = []
  for (const label of labels) {
    const rect = label.getBoundingClientRect()
    const hidden =
      rect.width === 0 ||
      rect.left < bounds.left ||
      rect.right > bounds.right ||
      rect.top < bounds.top ||
      rect.bottom > bounds.bottom ||
      [...obstacles, ...placed].some((obstacle) =>
        overlapsMapLabel(rect, obstacle)
      )
    label.classList.toggle('map-value-hidden', hidden)
    if (!hidden) placed.push(rect)
  }
}
