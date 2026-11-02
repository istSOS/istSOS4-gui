/** Selection stays distinct from series colours in Details and Edit/QC. */
export const SELECTION_COLOR = '#d946ef'

/** ECharts retains emphasis for the active brush tool, including after mouseout. */
export function brushToolStyle(activeColor = '#008374') {
  return {
    iconStyle: { borderColor: '#9ca3af' },
    emphasis: { iconStyle: { borderColor: activeColor } },
  }
}
