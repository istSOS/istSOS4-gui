export function createClusterGroup({
  L,
  color,
  options,
}: {
  L: any
  color: string
  options?: Partial<{
    spiderfyDistanceMultiplier: number
    maxClusterRadius: number
    disableClusteringAtZoom: number
  }> &
    Record<string, any>
}) {
  return L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,

    spiderfyDistanceMultiplier: 1.2,

    ...(options ?? {}),

    iconCreateFunction: (cl: any) => {
      const total = cl.getChildCount()
      const size = total < 10 ? 'small' : total < 100 ? 'medium' : 'large'

      return L.divIcon({
        html: `<div class="marker-cluster-net-inner" style="background:${color};"><span>${total}</span></div>`,
        className: `marker-cluster marker-cluster-${size} marker-cluster-net`,
        iconSize: L.point(40, 40),
      })
    },
  })
}
