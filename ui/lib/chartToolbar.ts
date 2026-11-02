export function hoverTooltipTool(
  enabled: boolean,
  title: string,
  onToggle: () => void,
  activeColor = '#008374'
) {
  return {
    show: true,
    title,
    icon:
      'path://M2 12C6 4 18 4 22 12C18 20 6 20 2 12Z' +
      (enabled ? 'M15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12' : 'M3 3L21 21'),
    iconStyle: { borderColor: enabled ? activeColor : '#9ca3af' },
    emphasis: { iconStyle: { borderColor: activeColor } },
    onclick: onToggle,
  }
}

export function resetZoomTool(
  title: string,
  onReset: () => void,
  activeColor = '#008374'
) {
  return {
    show: true,
    title,
    icon: 'path://M4 10a8 8 0 1 1 1 8M4 4v6h6',
    iconStyle: { borderColor: activeColor },
    onclick: onReset,
  }
}
