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
import { Datastream, Thing } from '@/types/domain'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import utc from 'dayjs/plugin/utc'

import {
  type SelectableMapLayer,
  createClusterGroup,
  createThingMarkerIcon,
  setMarkerSelected,
  showClusterHullPreview,
} from './leafletCluster'
import { phenomenonTimeTimestamp } from '../../../lib/phenomenonTime'
import { getThingKey } from './leafletMapHelpers'

dayjs.extend(duration)
dayjs.extend(utc)

const EPSG_2056 =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +units=m +no_defs'
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs'

// proj4 source definitions for the non-WGS84 CRS we can reproject from.
// EPSG:4326 (WGS84) and EPSG:3857 (Web Mercator) are built into proj4, so an
// EPSG code not listed here is still passed straight to proj4 as a fallback.
const PROJ_DEFS: Record<string, string> = {
  'EPSG:2056': EPSG_2056,
}

// Extracts a normalized "EPSG:<code>" string from a GeoJSON named CRS, handling
// both "EPSG:2056" and "urn:ogc:def:crs:EPSG::2056" forms. Returns null when no
// usable name is present.
function normalizeCrsName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // CRS84 / "WGS 84" aliases are equivalent to EPSG:4326.
  if (/CRS84|WGS\s*84/i.test(trimmed)) return 'EPSG:4326'
  const match =
    trimmed.match(/EPSG[^0-9]*(\d{3,6})/i) ?? trimmed.match(/(\d{3,6})\s*$/)
  return match ? `EPSG:${match[1]}` : null
}

// Resolves the proj4 source for a geometry, or null when its coordinates are
// already WGS84 lon/lat (no crs, or a crs that resolves to EPSG:4326).
function resolveSourceProj(geom: {
  crs?: { properties?: { name?: string } }
}): string | null {
  const name = normalizeCrsName(geom?.crs?.properties?.name)
  if (!name || name === 'EPSG:4326') return null
  return PROJ_DEFS[name] ?? name
}

export const SOURCE_COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#7c3aed',
  '#db2777',
  '#0ea5e9',
  '#84cc16',
  '#f59e0b',
  '#14b8a6',
]
const TOOLTIP_VERTICAL_OFFSET = -14
/** Opacity of a snapshot marker whose position is not known to be historical. */
const APPROXIMATE_OPACITY = 0.5

export const UNSPECIFIED_NETWORK_KEY = '__unspecified__'

type TooltipLabels = {
  unspecifiedNetwork: string
  sameLocation: string
  dataSource: string
  network: string
  things: string
  /** Shown on a snapshot marker whose position is not known to be historical. */
  approximatePosition?: string
  delayedReadings?: string
  stations?: string
  noReading?: string
  moreReadings?: (count: number) => string
}

type TooltipRow = {
  source: string
  name: string
  network: string
  note?: string
}

type FreshnessStatus = 'fresh' | 'stale' | 'mixed' | 'unknown'

export function networkKey(name: unknown) {
  return String(name ?? '').trim() || UNSPECIFIED_NETWORK_KEY
}

export function buildSourceColorMapWithOverrides(
  keys: string[],
  overrides?: Record<string, string>
) {
  const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b))
  const colorMap = new Map<string, string>()
  for (const [index, key] of sortedKeys.entries()) {
    colorMap.set(key, SOURCE_COLOR_PALETTE[index % SOURCE_COLOR_PALETTE.length])
  }

  if (!overrides) return colorMap

  for (const key of sortedKeys) {
    const override = overrides[key]
    if (typeof override !== 'string' || !override.trim()) continue
    colorMap.set(key, override)
  }
  return colorMap
}

function groupKeyFor(sourceKey: string, netKey: string) {
  return `${sourceKey}||${netKey}`
}

function thingSourceKey(thing: Thing) {
  return String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
}

function thingSourceLabel(thing: Thing) {
  const sourceName = String(thing?.__sourceName ?? '').trim()
  const sourceId = String(
    thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0'
  ).trim()

  if (sourceName) {
    return sourceName
  }

  return sourceId || '0'
}

function thingDisplayName(thing: Thing) {
  return String(thing?.name ?? '').trim() || 'Unnamed thing'
}

type ClickableLayer = {
  on: (event: string, handler: (event: unknown) => void) => void
}

type TooltipLayer = ClickableLayer & {
  bindTooltip: (
    mount: HTMLElement | string,
    options: Record<string, unknown>
  ) => void
}
type BoundsLayer = {
  getBounds: () => { getCenter: () => { lat: number; lng: number } }
}
type MarkerLike = TooltipLayer & MarkerWithMeta
type VectorLike = TooltipLayer
type LayerGroupLike = {
  addLayer: (layer: unknown) => void
  remove?: () => void
}
type MarkerWithMeta = SelectableMapLayer & {
  __sourceColor?: string
  __freshnessStatus?: FreshnessStatus
  __tooltipRow?: TooltipRow
}
type ClusterEvent = {
  originalEvent?: { preventDefault?: () => void; stopPropagation?: () => void }
  layer?: {
    closeTooltip?: () => void
    spiderfy?: () => void
    getAllChildMarkers?: () => unknown[]
    getTooltip?: () => unknown
    setTooltipContent?: (content: HTMLElement) => void
    bindTooltip?: (
      content: HTMLElement,
      options: Record<string, unknown>
    ) => void
    openTooltip?: () => void
  } & { getConvexHull?: () => unknown[] }
}

function resolveTooltipLabels(labels?: TooltipLabels): Required<TooltipLabels> {
  return {
    unspecifiedNetwork: labels?.unspecifiedNetwork ?? 'Unspecified',
    sameLocation: labels?.sameLocation ?? 'Same location',
    dataSource: labels?.dataSource ?? 'Data source',
    network: labels?.network ?? 'Network',
    things: labels?.things ?? 'Things',
    approximatePosition:
      labels?.approximatePosition ?? 'Position not historical',
    delayedReadings: labels?.delayedReadings ?? 'Some readings are delayed',
    stations: labels?.stations ?? 'Stations',
    noReading: labels?.noReading ?? 'No reading available',
    moreReadings:
      labels?.moreReadings ?? ((count) => `+${count} more`),
  }
}

function buildTooltipMount(
  rows: TooltipRow[],
  labels?: TooltipLabels,
  options?: {
    heading?: string
    showSource?: boolean
  }
) {
  const t = resolveTooltipLabels(labels)
  const showSource = options?.showSource ?? false

  const mount = document.createElement('div')
  mount.className = 'thing-tooltip-card'

  if (options?.heading) {
    const heading = document.createElement('div')
    heading.className = 'thing-tooltip-heading'
    heading.textContent = options.heading
    mount.appendChild(heading)
  }

  for (const rowData of rows) {
    const networkLabel =
      rowData.network === UNSPECIFIED_NETWORK_KEY || !rowData.network
        ? t.unspecifiedNetwork
        : rowData.network

    const row = document.createElement('div')
    row.className = 'thing-tooltip-row'

    const title = document.createElement('div')
    title.className = 'thing-tooltip-name'
    title.textContent = rowData.name

    const details = document.createElement('div')
    details.className = 'thing-tooltip-meta'

    if (showSource) {
      const sourceLine = document.createElement('div')
      sourceLine.className = 'thing-tooltip-meta-line'
      sourceLine.textContent = `${t.dataSource}: ${rowData.source}`
      details.appendChild(sourceLine)
    }

    const networkLine = document.createElement('div')
    networkLine.className = 'thing-tooltip-meta-line'
    networkLine.textContent = `${t.network}: ${networkLabel}`
    details.appendChild(networkLine)

    if (rowData.note) {
      const noteLine = document.createElement('div')
      noteLine.className = 'thing-tooltip-meta-line'
      noteLine.style.fontStyle = 'italic'
      noteLine.textContent = rowData.note
      details.appendChild(noteLine)
    }

    row.appendChild(title)
    row.appendChild(details)
    mount.appendChild(row)
  }

  return mount
}

function bindSelectThing(
  layer: ClickableLayer,
  thing: Thing,
  onThingSelect?: (
    t: Thing,
    selection?: { observedPropertyName?: string; datastreamId?: string }
  ) => void,
  selection?: { observedPropertyName?: string; datastreamId?: string }
) {
  if (!onThingSelect) return
  layer.on('click', (e: unknown) => {
    const event = e as {
      originalEvent?: {
        preventDefault?: () => void
        stopPropagation?: () => void
      }
    }
    event.originalEvent?.preventDefault?.()
    event.originalEvent?.stopPropagation?.()
    onThingSelect(thing, selection)
  })
}

/**
 * True for a snapshot Thing drawn at a position not known to be the one it had
 * at the instant: only its current Location link is known ('link'), or the
 * snapshot could not be read and this is live data ('live').
 */
function hasApproximatePosition(thing: Thing) {
  return (
    thing?.__asOfLocationSource === 'link' ||
    thing?.__asOfLocationSource === 'live'
  )
}

function bindHeroTooltip(
  layer: TooltipLayer,
  thing: Thing,
  options?: {
    labels?: TooltipLabels
  }
) {
  const name = thingDisplayName(thing)
  if (!name) return

  const mount = buildTooltipMount(
    [
      {
        source: thingSourceLabel(thing),
        name,
        network: String(thing?.Datastreams?.[0]?.Network?.name ?? '').trim(),
        note: hasApproximatePosition(thing)
          ? resolveTooltipLabels(options?.labels).approximatePosition
          : undefined,
      },
    ],
    options?.labels,
    {
      showSource: false,
    }
  )

  layer.bindTooltip(mount, {
    sticky: false,
    interactive: false,
    direction: 'top',
    offset: [0, TOOLTIP_VERTICAL_OFFSET],
    opacity: 1,
    className: 'thing-tooltip',
  })
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function latestObservationOfDatastream(
  ds: Datastream
): Datastream['Observations'][number] | null {
  const obsArr = Array.isArray(ds?.Observations) ? ds.Observations : []
  if (!obsArr.length) return null

  let best: Datastream['Observations'][number] | null = null
  let bestT = -Infinity

  for (const obs of obsArr) {
    // By phenomenonTime, the order the reads request; they may $select it
    // without resultTime.
    const t =
      phenomenonTimeTimestamp(obs?.phenomenonTime) ??
      (obs?.resultTime ? Date.parse(obs.resultTime) : NaN)
    if (!Number.isFinite(t)) continue
    if (t > bestT) {
      bestT = t
      best = obs
    }
  }
  return best
}

export function valueTextForDatastream(ds: Datastream): string | null {
  const obs = latestObservationOfDatastream(ds)
  if (!obs) return null

  const val = obs?.result
  if (val === undefined || val === null) return null

  const uom = ds?.unitOfMeasurement?.symbol ?? ds?.unitOfMeasurement?.name
  const v =
    typeof val === 'number' ? String(Math.round(val * 100) / 100) : String(val)

  return uom ? `${v} ${uom}` : v
}

function parsePhenomenonEndRaw(phenomenonTime?: string | null) {
  if (!phenomenonTime) return undefined
  const [, endRaw] = phenomenonTime.split('/')
  return endRaw
}

function isoDurationToMs(iso?: string) {
  if (!iso) return 0
  const ms = dayjs.duration(iso).asMilliseconds()
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/**
 * Whether a datastream was reporting on time — as of now, or, given a
 * `referenceMs`, as of that snapshot instant.
 *
 * A snapshot cannot use the datastream's own `phenomenonTime`: the versioning
 * trigger ignores that column, so it is updated in place and even an old
 * version carries today's value. The latest reading that existed at the
 * instant says when the datastream last reported then.
 */
function datastreamFreshness(
  ds: Datastream,
  referenceMs: number | null
): 'fresh' | 'stale' | 'unknown' {
  const latest = referenceMs !== null ? latestObservationOfDatastream(ds) : null
  const endRaw =
    referenceMs !== null
      ? (parsePhenomenonEndRaw(latest?.phenomenonTime) ??
        latest?.phenomenonTime ??
        latest?.resultTime ??
        undefined)
      : parsePhenomenonEndRaw(ds?.phenomenonTime)
  if (!endRaw) return 'unknown'

  const endMs = dayjs.utc(endRaw).valueOf()
  if (!Number.isFinite(endMs)) return 'unknown'

  const thresholdMs = isoDurationToMs(ds?.properties?.acquisitionFrequency) * 2
  if (thresholdMs <= 0) return 'unknown'

  return (referenceMs ?? Date.now()) - endMs < thresholdMs ? 'fresh' : 'stale'
}

function thingFreshnessStatus(
  thing: Thing,
  referenceMs: number | null
): FreshnessStatus {
  const dss = Array.isArray(thing?.Datastreams) ? thing.Datastreams : []
  const statuses = dss
    .map((ds) => datastreamFreshness(ds, referenceMs))
    .filter((status) => status !== 'unknown') as Array<'fresh' | 'stale'>

  if (!statuses.length) return 'unknown'
  if (statuses.every((status) => status === 'fresh')) return 'fresh'
  if (statuses.every((status) => status === 'stale')) return 'stale'
  return 'mixed'
}

export function bindClusterTooltips(
  cluster: { on: (event: string, handler: (event: unknown) => void) => void },
  labels?: TooltipLabels
) {
  cluster.on('clustermouseover', (e: unknown) => {
    const layer = (e as ClusterEvent).layer
    const children = (layer?.getAllChildMarkers?.() ?? []) as MarkerWithMeta[]
    const groups = new Map<string, { color: string; names: string[] }>()
    for (const child of children) {
      const row = child.__tooltipRow
      if (!row) continue
      const group = groups.get(row.source) ?? {
        color: child.__sourceColor ?? '#64748b',
        names: [],
      }
      group.names.push(row.name)
      groups.set(row.source, group)
    }
    if (!groups.size || !layer) return
    const text = resolveTooltipLabels(labels)
    const mount = document.createElement('div')
    mount.className = 'thing-tooltip-card'
    const heading = document.createElement('div')
    heading.className = 'thing-tooltip-heading'
    heading.textContent = `${text.stations}: ${children.length}`
    mount.appendChild(heading)
    for (const [source, group] of [...groups].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const row = document.createElement('div')
      row.className = 'map-cluster-source'
      const dot = document.createElement('span')
      dot.className = 'map-source-dot'
      dot.style.backgroundColor = group.color
      const name = document.createElement('span')
      name.className = 'map-cluster-source-name'
      name.textContent = source
      const count = document.createElement('span')
      count.className = 'map-cluster-source-count'
      count.textContent = String(group.names.length)
      row.append(dot, name, count)
      mount.appendChild(row)
      const names = document.createElement('div')
      names.className = 'map-cluster-station-names'
      names.textContent =
        group.names.slice(0, 3).join(', ') + (group.names.length > 3 ? '…' : '')
      mount.appendChild(names)
    }
    if (
      children.some((child) =>
        ['stale', 'mixed'].includes(child.__freshnessStatus)
      )
    ) {
      const note = document.createElement('div')
      note.className = 'map-tooltip-warning'
      note.textContent = text.delayedReadings
      mount.appendChild(note)
    }
    if (children.some((child) => child.__tooltipRow?.note)) {
      const note = document.createElement('div')
      note.className = 'map-tooltip-warning'
      note.textContent = text.approximatePosition
      mount.appendChild(note)
    }
    if (layer.getTooltip?.()) layer.setTooltipContent?.(mount)
    else
      layer.bindTooltip?.(mount, {
        sticky: false,
        interactive: false,
        direction: 'top',
        offset: [0, TOOLTIP_VERTICAL_OFFSET],
        opacity: 1,
        className: 'thing-tooltip',
      })
    layer.openTooltip?.()
  })
  cluster.on('clustermouseout', (e: unknown) =>
    (e as ClusterEvent).layer?.closeTooltip?.()
  )
}

export function drawNetworkLayers(args: {
  L: {
    marker: (...args: unknown[]) => MarkerLike
    divIcon: (...args: unknown[]) => unknown
    polyline: (...args: unknown[]) => VectorLike & BoundsLayer
    polygon: (
      ...args: unknown[]
    ) => VectorLike & BoundsLayer & { addTo?: (map: unknown) => void }
    layerGroup: (...args: unknown[]) => LayerGroupLike
    markerClusterGroup: (...args: unknown[]) => unknown
    point: (...args: unknown[]) => unknown
  }
  proj4: (src: string, dst: string, point: [number, number]) => [number, number]
  map: {
    addLayer: (layer: unknown) => void
    removeLayer: (layer: unknown) => void
  }
  things: Thing[]
  isThingVisible?: (thing: Thing) => boolean
  isDatastreamVisible?: (thing: Thing, ds: Datastream, index: number) => boolean
  observedMode?: boolean
  selectedNetwork?: string
  selectedThingKey?: string | null
  selectedThingKeys?: ReadonlySet<string>

  networkLayers: Map<
    string,
    {
      cluster: {
        addLayer?: (layer: unknown) => void
        clearLayers?: () => void
        on?: (event: string, cb: (event: unknown) => void) => void
        off?: () => void
        remove?: () => void
        refreshClusters?: () => void
      }
      vectors: {
        addLayer?: (layer: unknown) => void
        clearLayers?: () => void
        remove?: () => void
      }
      color: string
    }
  >
  overlayWrappersRef: { current: Map<string, { remove?: () => void }> }
  enabledRef: { current: Map<string, boolean> }
  didInitVisibilityRef: { current: boolean }

  observedCluster: {
    clearLayers?: () => void
    addLayer: (layer: unknown) => void
  }
  observedPropertyFilter?: Set<string>
  sourceColorByKey?: Record<string, string>

  labels?: TooltipLabels
  /** Formatted date label for snapshot mode (e.g. "Jun 26 · 01:16 UTC"). When set, Point markers get an amber pill. */
  asOfLabel?: string | null
  /** The snapshot instant (ISO). Freshness is judged against it instead of now. */
  referenceTime?: string | null
  onThingSelect?: (
    thing: Thing,
    selection?: { observedPropertyName?: string; datastreamId?: string }
  ) => void
}) {
  const {
    L,
    proj4,
    map,
    things,
    isThingVisible,
    isDatastreamVisible,
    observedMode,
    selectedNetwork,
    selectedThingKey,
    selectedThingKeys,

    networkLayers,
    overlayWrappersRef,
    enabledRef,
    didInitVisibilityRef,

    observedCluster,
    observedPropertyFilter,
    sourceColorByKey,

    labels,
    asOfLabel,
    referenceTime,
    onThingSelect,
  } = args

  const parsedReference = referenceTime
    ? dayjs.utc(referenceTime).valueOf()
    : NaN
  const referenceMs = Number.isFinite(parsedReference) ? parsedReference : null
  const resolvedLabels = resolveTooltipLabels(labels)
  const approximateLabel = resolvedLabels.approximatePosition

  const toLatLng = (
    x: number,
    y: number,
    srcProj: string | null
  ): [number, number] | null => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    // No source projection: coordinates are already WGS84, in GeoJSON [lng, lat] order.
    if (!srcProj) return [y, x]
    try {
      const [lng, lat] = proj4(srcProj, WGS84, [x, y])
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
    } catch {
      return null
    }
  }

  const isObservedMode =
    observedMode ??
    (!!observedPropertyFilter && observedPropertyFilter.size > 0)
  try {
    observedCluster?.clearLayers?.()
  } catch { }

  const sourceKeys = new Set<string>()
  for (const thing of things) sourceKeys.add(thingSourceKey(thing))
  const sourceColorMap = buildSourceColorMapWithOverrides(
    Array.from(sourceKeys),
    sourceColorByKey
  )
  const prepareMarker = (
    marker: MarkerLike | (VectorLike & MarkerWithMeta),
    thing: Thing,
    freshness: FreshnessStatus
  ) => {
    marker.__thingKey = getThingKey(thing)
    marker.__sourceColor =
      sourceColorMap.get(thingSourceKey(thing)) ?? SOURCE_COLOR_PALETTE[0]
    marker.__freshnessStatus = freshness
    marker.__tooltipRow = {
      source: thingSourceLabel(thing),
      name: thingDisplayName(thing),
      network: String(thing.Datastreams?.[0]?.Network?.name ?? '').trim(),
      note: hasApproximatePosition(thing) ? approximateLabel : undefined,
    }
    setMarkerSelected(
      marker,
      selectedThingKeys
        ? selectedThingKeys.has(marker.__thingKey)
        : marker.__thingKey === selectedThingKey
    )
    marker.on('add', () =>
      setMarkerSelected(marker, marker.__selected ?? false)
    )
  }

  if (isObservedMode) {
    for (const thing of things) {
      if (isThingVisible && !isThingVisible(thing)) continue
      const geom = thing?.Locations?.[0]?.location
      if (!geom) continue

      const srcProj = resolveSourceProj(geom)
      let centerLL: [number, number] | null = null

      if (geom.type === 'Point') {
        const [x, y] = geom.coordinates ?? []
        centerLL = toLatLng(x, y, srcProj)
      } else if (geom.type === 'LineString') {
        const latlngs = (geom.coordinates ?? [])
          .map(([x, y]: [number, number]) => toLatLng(x, y, srcProj))
          .filter(Boolean) as [number, number][]
        if (latlngs.length >= 2) {
          try {
            const l = L.polyline(latlngs)
            const c = l.getBounds().getCenter()
            centerLL = [c.lat, c.lng]
          } catch { }
        }
      } else if (geom.type === 'Polygon') {
        const rings = (geom.coordinates ?? [])
          .map((ring: [number, number][]) =>
            ring.map(([x, y]) => toLatLng(x, y, srcProj)).filter(Boolean)
          )
          .map((ring) => ring as [number, number][])
          .filter((ring) => ring.length >= 3)
        if (rings.length) {
          try {
            const p = L.polygon(rings)
            const c = p.getBounds().getCenter()
            centerLL = [c.lat, c.lng]
          } catch { }
        }
      }

      if (!centerLL) continue

      const dss = Array.isArray(thing?.Datastreams) ? thing.Datastreams : []
      const observedMatches: Array<{
        ds: Datastream
        text: string | null
      }> = []
      for (const [index, ds] of dss.entries()) {
        if (isDatastreamVisible && !isDatastreamVisible(thing, ds, index))
          continue
        const opName = ds?.ObservedProperty?.name
        if (typeof opName !== 'string' && !isDatastreamVisible) continue
        const sourceKey = thingSourceKey(thing)
        const observedPropertyKey = `${sourceKey}||${opName?.trim() ?? ''}`
        if (
          typeof opName === 'string' &&
          !observedPropertyFilter?.has(observedPropertyKey)
        )
          continue

        const text = valueTextForDatastream(ds)
        observedMatches.push({ ds, text })
      }

      if (!observedMatches.length && (dss.length > 0 || !isDatastreamVisible))
        continue
      const single = observedMatches.length === 1 ? observedMatches[0] : null
      const approximate = hasApproximatePosition(thing)
      const freshnesses = observedMatches.map(({ ds }) =>
        datastreamFreshness(ds, referenceMs)
      )
      const freshnessStatus = freshnesses.includes('stale')
        ? freshnesses.includes('fresh')
          ? 'mixed'
          : 'stale'
        : freshnesses.includes('fresh')
          ? 'fresh'
          : 'unknown'
      const sourceColor =
        sourceColorMap.get(thingSourceKey(thing)) ?? SOURCE_COLOR_PALETTE[0]
      const warning = ['stale', 'mixed'].includes(freshnessStatus)
        ? resolvedLabels.delayedReadings
        : undefined
      const labelDescription = single
        ? `${thingDisplayName(thing)} · ${single.ds.name ?? single.ds.ObservedProperty?.name ?? ''}: ${single.text ?? resolvedLabels.noReading}`
        : thingDisplayName(thing)
      const icon = createThingMarkerIcon(L, sourceColor, {
        warning,
        snapshotLabel: asOfLabel
          ? approximate
            ? `≈ ${asOfLabel}`
            : asOfLabel
          : undefined,
        // Value label only when the filter narrows to one observed property;
        // a station that merely has one datastream gets none.
        value:
          single?.text && observedPropertyFilter?.size === 1
            ? { text: single.text, description: labelDescription }
          : undefined,
      })
      const marker = L.marker(centerLL, {
        icon,
      })
      prepareMarker(marker, thing, freshnessStatus)
      const previewRows = observedMatches
        .slice(0, 3)
        .map(({ ds, text }) => {
          const name = escapeHtml(
            String(
              ds.name ?? ds.ObservedProperty?.name ?? ds['@iot.id'] ?? ds.id ?? ''
            )
          )
          const delayed = datastreamFreshness(ds, referenceMs) === 'stale'
          const missingLabel =
            text === null
              ? ` aria-label="${escapeHtml(resolvedLabels.noReading)}"`
              : ''
          const status = delayed
            ? `<span class="map-preview-warning" role="img" aria-label="${escapeHtml(resolvedLabels.delayedReadings)}" title="${escapeHtml(resolvedLabels.delayedReadings)}">!</span>`
            : ''
          return `<div class="map-preview-reading"><span title="${name}">${name}</span><strong${missingLabel}>${escapeHtml(text ?? '—')}${status}</strong></div>`
        })
        .join('')
      const remaining = observedMatches.length - 3
      marker.bindTooltip(
        `<div class="thing-tooltip-card map-datastream-preview">${previewRows || `<span class="thing-tooltip-meta" aria-label="${escapeHtml(resolvedLabels.noReading)}">—</span>`}${remaining > 0 ? `<div class="thing-tooltip-meta map-preview-more">${escapeHtml(resolvedLabels.moreReadings(remaining))}</div>` : ''}</div>`,
        {
          direction: 'top',
          offset: [0, -12],
          opacity: 1,
          className: 'thing-tooltip',
          permanent: false,
        }
      )
      marker.on('click', (e: unknown) => {
        const event = e as { originalEvent?: MouseEvent }
        event.originalEvent?.preventDefault?.()
        event.originalEvent?.stopPropagation?.()
        const target = event.originalEvent?.target as Element | undefined
        const clickedValue = target?.closest?.('.map-station-value')
        onThingSelect?.(
          thing,
          clickedValue && single
            ? {
              observedPropertyName: single.ds.ObservedProperty?.name?.trim(),
              datastreamId: String(
                single.ds['@iot.id'] ?? single.ds.id ?? ''
              ).trim(),
            }
            : undefined
        )
      })
      observedCluster.addLayer(marker)
    }

    return
  }

  const groupMetaByKey = new Map<
    string,
    { sourceKey: string; networkKey: string }
  >()
  for (const t of things) {
    const sourceKey = thingSourceKey(t)
    const netKey = networkKey(t?.Datastreams?.[0]?.Network?.name)
    const key = groupKeyFor(sourceKey, netKey)
    groupMetaByKey.set(key, { sourceKey, networkKey: netKey })
  }

  for (const [key, grp] of networkLayers) {
    if (groupMetaByKey.has(key)) continue
    grp.cluster?.clearLayers?.()
    grp.cluster?.off?.()
    grp.cluster?.remove?.()
    grp.vectors?.clearLayers?.()
    grp.vectors?.remove?.()
    networkLayers.delete(key)

    overlayWrappersRef.current.get(key)?.remove?.()
    overlayWrappersRef.current.delete(key)
    enabledRef.current.delete(key)
  }

  for (const [groupKey, meta] of groupMetaByKey.entries()) {
    const color = sourceColorMap.get(meta.sourceKey) ?? SOURCE_COLOR_PALETTE[0]
    const existingGroup = networkLayers.get(groupKey)

    if (existingGroup && existingGroup.color !== color) {
      existingGroup.cluster?.clearLayers?.()
      existingGroup.cluster?.off?.()
      existingGroup.cluster?.remove?.()
      existingGroup.vectors?.clearLayers?.()
      existingGroup.vectors?.remove?.()
      networkLayers.delete(groupKey)
      overlayWrappersRef.current.get(groupKey)?.remove?.()
      overlayWrappersRef.current.delete(groupKey)
      enabledRef.current.delete(groupKey)
    }

    if (networkLayers.has(groupKey)) continue

    const cluster = createClusterGroup({
      L,
      warningLabel: resolvedLabels.delayedReadings,
    })
    const vectors = L.layerGroup()

    cluster.on?.('clusterclick', (e: unknown) => {
      const event = e as ClusterEvent
      event.originalEvent?.preventDefault?.()
      event.originalEvent?.stopPropagation?.()
      event.layer?.closeTooltip?.()
      showClusterHullPreview({
        L: L as {
          polygon: (
            hull: unknown[],
            options: Record<string, unknown>
          ) => {
            addTo: (map: unknown) => void
          }
        },
        map,
        clusterLayer: event.layer ?? {},
        color,
      })
      event.layer?.spiderfy?.()
    })

    bindClusterTooltips(cluster, labels)

    networkLayers.set(groupKey, { cluster, vectors, color })
  }

  for (const [key, grp] of networkLayers) {
    if (!overlayWrappersRef.current.has(key)) {
      const wrapper = L.layerGroup([grp.cluster, grp.vectors])
      overlayWrappersRef.current.set(key, wrapper)
    }
  }

  if (selectedNetwork || !didInitVisibilityRef.current) {
    const selectedKey = selectedNetwork
      ? networkKey(selectedNetwork)
      : undefined

    for (const [key, meta] of groupMetaByKey.entries()) {
      const shouldOn = selectedKey ? meta.networkKey === selectedKey : true
      enabledRef.current.set(key, shouldOn)

      const wrapper = overlayWrappersRef.current.get(key)
      if (!wrapper) continue
      shouldOn ? map.addLayer(wrapper) : map.removeLayer(wrapper)
    }
    didInitVisibilityRef.current = true
  } else {
    for (const key of groupMetaByKey.keys()) {
      if (enabledRef.current.has(key)) continue
      enabledRef.current.set(key, true)
      const wrapper = overlayWrappersRef.current.get(key)
      if (wrapper) map.addLayer(wrapper)
    }
  }

  for (const { cluster, vectors } of networkLayers.values()) {
    cluster.clearLayers?.()
    vectors.clearLayers?.()
  }

  for (const thing of things) {
    if (isThingVisible && !isThingVisible(thing)) continue
    const geom = thing?.Locations?.[0]?.location
    if (!geom) continue

    const srcProj = resolveSourceProj(geom)
    const sourceKey = thingSourceKey(thing)
    const netKey = networkKey(thing?.Datastreams?.[0]?.Network?.name)
    const key = groupKeyFor(sourceKey, netKey)
    const grp = networkLayers.get(key)
    if (!grp) continue

    const base = sourceColorMap.get(sourceKey) ?? SOURCE_COLOR_PALETTE[0]
    const freshnessStatus = thingFreshnessStatus(thing, referenceMs)
    const approximate = hasApproximatePosition(thing)

    if (geom.type === 'Point') {
      const [x, y] = geom.coordinates ?? []
      const ll = toLatLng(x, y, srcProj)
      if (!ll) continue

      // A position not known to be historical is drawn faded, and its date
      // pill says "≈": it must never read as where the Thing stood then.
      const m = L.marker(ll, {
        opacity: approximate ? APPROXIMATE_OPACITY : 1,
        title: `${thingDisplayName(thing)} · ${thingSourceLabel(thing)}${['stale', 'mixed'].includes(freshnessStatus) ? ` · ${resolvedLabels.delayedReadings}` : ''}${approximate ? ` · ${approximateLabel}` : ''}`,
        icon: createThingMarkerIcon(L, base, {
          warning: ['stale', 'mixed'].includes(freshnessStatus)
            ? resolvedLabels.delayedReadings
            : undefined,
          snapshotLabel: asOfLabel
            ? approximate
              ? `≈ ${asOfLabel}`
              : asOfLabel
            : undefined,
        }),
      })
      prepareMarker(m, thing, freshnessStatus)

      bindHeroTooltip(m, thing, { labels })
      bindSelectThing(m, thing, onThingSelect)
      grp.cluster.addLayer?.(m)
      continue
    }

    if (geom.type === 'LineString') {
      const latlngs = (geom.coordinates ?? [])
        .map(([x, y]: [number, number]) => toLatLng(x, y, srcProj))
        .filter(Boolean) as [number, number][]

      if (latlngs.length < 2) continue

      const l = L.polyline(latlngs, {
        color: base,
        weight: 3,
        opacity: approximate ? APPROXIMATE_OPACITY * 0.8 : 0.8,
        dashArray: approximate ? '4 4' : undefined,
      })

      prepareMarker(l, thing, freshnessStatus)
      bindHeroTooltip(l, thing, { labels })
      bindSelectThing(l, thing, onThingSelect)
      grp.vectors.addLayer?.(l)
      continue
    }

    if (geom.type === 'Polygon') {
      const rings = (geom.coordinates ?? [])
        .map((ring: [number, number][]) =>
          ring.map(([x, y]) => toLatLng(x, y, srcProj)).filter(Boolean)
        )
        .map((ring) => ring as [number, number][])
        .filter((ring) => ring.length >= 3)

      if (!rings.length) continue

      const p = L.polygon(rings, {
        color: base,
        weight: 2,
        fillColor: base,
        fillOpacity: approximate ? 0.1 : 0.25,
        dashArray: approximate ? '4 4' : undefined,
      })

      prepareMarker(p, thing, freshnessStatus)
      bindHeroTooltip(p, thing, { labels })
      bindSelectThing(p, thing, onThingSelect)
      grp.vectors.addLayer?.(p)
      continue
    }
  }

  for (const [key, grp] of networkLayers) {
    const enabled = enabledRef.current.get(key) !== false
    if (enabled) grp.cluster.refreshClusters?.()
  }
}
