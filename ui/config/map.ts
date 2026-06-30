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
import type { BasemapKey } from '@/types'

import { BASEMAPS } from '@/config/site'

// Defaults used when the matching env var is unset, empty, or still holds its
// build-time placeholder (see ui/environment_variables.sh for the runtime
// substitution applied to the standalone build).
const DEFAULT_CENTER: [number, number] = [46.005, 8.956]
const DEFAULT_ZOOM = 10
const DEFAULT_BASEMAP: BasemapKey = 'pixelGray'

const parseCenter = (raw: string | undefined): [number, number] => {
  const parts = raw?.split(',').map((value) => Number(value.trim())) ?? []
  return parts.length === 2 && parts.every((value) => Number.isFinite(value))
    ? [parts[0], parts[1]]
    : DEFAULT_CENTER
}

const parseZoom = (raw: string | undefined): number => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : DEFAULT_ZOOM
}

const parseBasemap = (raw: string | undefined): BasemapKey => {
  const key = raw?.trim()
  return key && key in BASEMAPS ? (key as BasemapKey) : DEFAULT_BASEMAP
}

export const mapConfig: {
  center: [number, number]
  zoom: number
  defaultBasemap: BasemapKey
} = {
  center: parseCenter(process.env.NEXT_PUBLIC_MAP_CENTER),
  zoom: parseZoom(process.env.NEXT_PUBLIC_MAP_ZOOM),
  defaultBasemap: parseBasemap(process.env.NEXT_PUBLIC_MAP_DEFAULT_BASEMAP),
}
