// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
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
