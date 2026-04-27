'use client'

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
import { BasemapKey } from '@/types'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BASEMAPS } from '@/config/site'

import LayersControl, { DataSourceLayerItem } from './LayersControl'
import MapContextMenu from './MapContextMenu'
import MapMenu from './MapMenu'

import {
  createClusterGroup,
  showClusterHullPreview,
} from '../lib/leafletCluster'
import {
  UNSPECIFIED_NETWORK_KEY,
  buildSourceColorMapWithOverrides,
  drawNetworkLayers,
  networkKey,
} from '../lib/leafletDraw'

function getThingKey(thing: any) {
  const sourceKey = String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceKey}::${thingId}`
}

function getThingSourceKey(thing: any) {
  return String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')
}

function getThingSourceLabel(thing: any) {
  const sourceName = String(thing?.__sourceName ?? '').trim()
  const sourceId = String(thing?.__sourceId ?? '').trim()
  if (sourceName) {
    return sourceName
  }
  return sourceId
    ? `Data source ${sourceId}`
    : `Data source ${getThingSourceKey(thing)}`
}

const OBSERVED_KEY_SEPARATOR = '||'

function buildObservedPropertyKey(
  sourceKey: string,
  observedPropertyName: string
) {
  return `${sourceKey}${OBSERVED_KEY_SEPARATOR}${observedPropertyName.trim()}`
}

function parseObservedPropertyKey(key: string) {
  const separatorIndex = key.indexOf(OBSERVED_KEY_SEPARATOR)
  if (separatorIndex < 0) return { sourceKey: '0', observedPropertyName: key }

  return {
    sourceKey: key.slice(0, separatorIndex),
    observedPropertyName: key.slice(
      separatorIndex + OBSERVED_KEY_SEPARATOR.length
    ),
  }
}

type ObservedToggleItem = {
  key: string
  label?: string
  enabled: boolean
}

export default function LeafletMap({
  things,
  selectedNetwork,
  onThingSelect,
  onCreateThingAt,
}: {
  things: any[] | { value: any[] }
  selectedNetwork?: string
  onThingSelect?: (thing: any) => void
  onCreateThingAt?: (point: { latitude: number; longitude: number }) => void
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const proj4Ref = useRef<any>(null)

  const roRef = useRef<ResizeObserver | null>(null)

  const tileLayerRef = useRef<any>(null)
  const [basemap, setBasemap] = useState<BasemapKey>('pixelGray')

  const networkLayersRef = useRef<
    Map<string, { cluster: any; vectors: any; color: string }>
  >(new Map())
  const overlayWrappersRef = useRef<Map<string, any>>(new Map())
  const enabledRef = useRef<Map<string, boolean>>(new Map())
  const didInitVisibilityRef = useRef(false)

  const observedOverlayRef = useRef<any>(null)
  const observedClusterRef = useRef<any>(null)

  const [observedPropsMeta, setObservedPropsMeta] = useState<
    ObservedToggleItem[]
  >([])
  const observedEnabledRef = useRef<Map<string, boolean>>(new Map())
  const [thingEnabled, setThingEnabled] = useState<Record<string, boolean>>({})
  const [sourceColorByKey, setSourceColorByKey] = useState<
    Record<string, string>
  >({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    latitude: number
    longitude: number
  } | null>(null)

  const thingsArr = useMemo(() => {
    if (Array.isArray(things)) return things
    const v = (things as any)?.value
    return Array.isArray(v) ? v : []
  }, [things])

  useEffect(() => {
    setThingEnabled((prev) => {
      const next: Record<string, boolean> = {}

      for (const thing of thingsArr) {
        const key = getThingKey(thing)
        if (!key) continue
        next[key] = prev[key] ?? true
      }

      return next
    })
  }, [thingsArr])

  useEffect(() => {
    const keyToLabel = new Map<string, string>()
    for (const t of thingsArr) {
      const sourceKey = getThingSourceKey(t)
      const dss = Array.isArray(t?.Datastreams) ? t.Datastreams : []
      for (const ds of dss) {
        const name = ds?.ObservedProperty?.name
        if (typeof name !== 'string' || !name.trim()) continue

        const observedKey = buildObservedPropertyKey(sourceKey, name)
        keyToLabel.set(observedKey, name.trim())
      }
    }
    const keys = Array.from(keyToLabel.keys()).sort((a, b) =>
      a.localeCompare(b)
    )

    setObservedPropsMeta((prev) => {
      const prevEnabled = new Map(prev.map((p) => [p.key, p.enabled] as const))
      const next = keys.map((k) => ({
        key: k,
        label: keyToLabel.get(k),
        enabled: prevEnabled.get(k) ?? false,
      }))
      observedEnabledRef.current = new Map(next.map((p) => [p.key, p.enabled]))
      return next
    })
  }, [thingsArr])

  const getActiveObservedProps = () => {
    const active = new Set<string>()
    for (const [k, en] of observedEnabledRef.current.entries()) {
      if (en) active.add(k)
    }
    return active
  }

  const isObservedMode = useMemo(() => {
    return observedPropsMeta.some((p) => p.enabled)
  }, [observedPropsMeta])

  const applyModeLayers = () => {
    const map = mapRef.current
    if (!map) return

    if (isObservedMode) {
      // hide networks overlay
      for (const wrapper of overlayWrappersRef.current.values()) {
        try {
          map.removeLayer(wrapper)
        } catch {}
      }
      // show observed overlay
      if (observedOverlayRef.current) {
        try {
          map.addLayer(observedOverlayRef.current)
        } catch {}
      }
    } else {
      // hide observed overlay
      if (observedOverlayRef.current) {
        try {
          map.removeLayer(observedOverlayRef.current)
        } catch {}
      }
      // show networks overlay respecting enabledRef
      for (const [key, wrapper] of overlayWrappersRef.current.entries()) {
        const enabled = enabledRef.current.get(key) !== false
        try {
          enabled ? map.addLayer(wrapper) : map.removeLayer(wrapper)
        } catch {}
      }
    }
  }

  const redraw = () => {
    const map = mapRef.current
    const L = LRef.current
    const proj4 = proj4Ref.current
    if (!map || !L || !proj4) return

    drawNetworkLayers({
      L,
      proj4,
      map,
      things: thingsArr,
      isThingVisible: (thing) => {
        const key = getThingKey(thing)
        return key ? thingEnabled[key] !== false : true
      },

      selectedNetwork: isObservedMode ? undefined : selectedNetwork,

      networkLayers: networkLayersRef.current,
      overlayWrappersRef: { current: overlayWrappersRef.current },
      enabledRef,
      didInitVisibilityRef,

      observedCluster: observedClusterRef.current,
      observedPropertyFilter: getActiveObservedProps(),
      sourceColorByKey,

      labels: {
        unspecifiedNetwork: t('map.unspecified_network'),
        sameLocation: t('map.same_location'),
        dataSource: t('map.data_source'),
        network: t('map.network'),
        things: t('map.things'),
      },
      onThingSelect,
    })
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      const leafletMod: any = await import('leaflet')
      const proj4Mod: any = await import('proj4')
      await import('leaflet.markercluster')

      if (!mounted) return

      const L = leafletMod?.default ?? leafletMod
      const proj4 = proj4Mod?.default ?? proj4Mod

      LRef.current = L
      proj4Ref.current = proj4

      const bm = BASEMAPS[basemap]
      const map = L.map(el, {
        minZoom: bm.minZoom,
        maxZoom: bm.maxZoom,
        maxBounds: bm.bounds,
        maxBoundsViscosity: 1.0,
      }).setView([46.005, 8.956], 10)
      tileLayerRef.current = L.tileLayer(bm.url, {
        attribution: bm.attribution,
        minZoom: bm.minZoom,
        maxZoom: bm.maxZoom,
        bounds: bm.bounds,
        noWrap: true,
      })
      tileLayerRef.current.addTo(map)

      observedOverlayRef.current = L.layerGroup()
      observedClusterRef.current = createClusterGroup({
        L,
        color: (cluster: any) => {
          const children = cluster?.getAllChildMarkers?.() ?? []
          const counts = new Map<string, number>()

          for (const child of children) {
            const c = String((child as any)?.__sourceColor ?? '').trim()
            if (!c) continue
            counts.set(c, (counts.get(c) ?? 0) + 1)
          }

          let bestColor = '#ff0000'
          let bestCount = 0
          for (const [c, count] of counts.entries()) {
            if (count > bestCount) {
              bestColor = c
              bestCount = count
            }
          }
          return bestColor
        },
        borderColor: (cluster: any) => {
          const children = cluster?.getAllChildMarkers?.() ?? []
          let hasFresh = false
          let hasStale = false
          let hasUnknown = false

          for (const child of children) {
            const status = String(
              (child as any)?.__freshnessStatus ?? ''
            ).trim()
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
        },
        options: { spiderfyDistanceMultiplier: 2.6 },
      })

      observedClusterRef.current.on('clusterclick', (e: any) => {
        e.originalEvent?.preventDefault?.()
        e.originalEvent?.stopPropagation?.()
        const children = e.layer?.getAllChildMarkers?.() ?? []
        const counts = new Map<string, number>()
        for (const child of children) {
          const c = String((child as any)?.__sourceColor ?? '').trim()
          if (!c) continue
          counts.set(c, (counts.get(c) ?? 0) + 1)
        }
        let previewColor = '#ff0000'
        let bestCount = 0
        for (const [c, count] of counts.entries()) {
          if (count > bestCount) {
            previewColor = c
            bestCount = count
          }
        }
        showClusterHullPreview({
          L,
          map,
          clusterLayer: e.layer,
          color: previewColor,
        })
        e.layer?.spiderfy?.()
      })

      observedOverlayRef.current.addLayer(observedClusterRef.current)

      mapRef.current = map

      map.on('contextmenu', (e: any) => {
        const point = map.mouseEventToContainerPoint(e.originalEvent)
        setContextMenu({
          x: point.x,
          y: point.y,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        })
      })

      map.on('click', () => setContextMenu(null))
      map.on('movestart', () => setContextMenu(null))

      redraw()
      applyModeLayers()

      roRef.current = new ResizeObserver(() => map.invalidateSize())
      roRef.current.observe(el)
    })()

    return () => {
      mounted = false
      roRef.current?.disconnect()
      roRef.current = null

      try {
        observedClusterRef.current?.clearLayers?.()
        observedClusterRef.current?.off?.()
        observedClusterRef.current?.remove?.()
      } catch {}
      observedClusterRef.current = null

      try {
        observedOverlayRef.current?.clearLayers?.()
        observedOverlayRef.current?.remove?.()
      } catch {}
      observedOverlayRef.current = null

      for (const w of overlayWrappersRef.current.values()) w?.remove?.()
      overlayWrappersRef.current.clear()
      enabledRef.current.clear()

      for (const { cluster, vectors } of networkLayersRef.current.values()) {
        cluster?.clearLayers?.()
        cluster?.off?.()
        cluster?.remove?.()
        vectors?.clearLayers?.()
        vectors?.remove?.()
      }
      networkLayersRef.current.clear()

      try {
        tileLayerRef.current?.remove?.()
      } catch {}
      tileLayerRef.current = null

      const mapState = mapRef.current as any
      if (mapState?.__clusterHullPreviewTimer) {
        clearTimeout(mapState.__clusterHullPreviewTimer)
        mapState.__clusterHullPreviewTimer = null
      }
      if (mapState?.__clusterHullPreviewLayer) {
        try {
          mapRef.current?.removeLayer?.(mapState.__clusterHullPreviewLayer)
        } catch {}
        mapState.__clusterHullPreviewLayer = null
      }

      try {
        mapRef.current?.off?.()
        mapRef.current?.stop?.()
      } catch {}

      mapRef.current?.remove?.()
      mapRef.current = null

      LRef.current = null
      proj4Ref.current = null
      didInitVisibilityRef.current = false
    }
  }, [])

  useEffect(() => {
    redraw()
  }, [thingsArr, selectedNetwork, thingEnabled, sourceColorByKey])

  useEffect(() => {
    redraw()
  }, [observedPropsMeta])

  useEffect(() => {
    applyModeLayers()
  }, [isObservedMode])

  useEffect(() => {
    const map = mapRef.current
    const L = LRef.current
    if (!map || !L) return

    const bm = BASEMAPS[basemap]
    map.setMinZoom(bm.minZoom)
    map.setMaxZoom(bm.maxZoom)
    map.setMaxBounds(bm.bounds)
    map.panInsideBounds(bm.bounds, { animate: false })

    if (map.getZoom() < bm.minZoom) {
      map.setZoom(bm.minZoom)
    }
    if (map.getZoom() > bm.maxZoom) {
      map.setZoom(bm.maxZoom)
    }
    try {
      if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    } catch {}

    tileLayerRef.current = L.tileLayer(bm.url, {
      attribution: bm.attribution,
      minZoom: bm.minZoom,
      maxZoom: bm.maxZoom,
      bounds: bm.bounds,
      noWrap: true,
    })
    tileLayerRef.current.addTo(map)
  }, [basemap])

  const setAllObservedProps = (nextEnabled: boolean) => {
    observedEnabledRef.current = new Map(
      observedPropsMeta.map((p) => [p.key, nextEnabled] as const)
    )
    setObservedPropsMeta((prev) =>
      prev.map((p) => ({ ...p, enabled: nextEnabled }))
    )
  }

  const setSourceNetworks = (sourceKey: string, nextEnabled: boolean) => {
    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        if (getThingSourceKey(thing) !== sourceKey) continue
        const key = getThingKey(thing)
        if (!key) continue
        next[key] = nextEnabled
      }
      return next
    })
  }

  const setSourceObservedProps = (sourceKey: string, nextEnabled: boolean) => {
    setObservedPropsMeta((prev) => {
      const next = prev.map((item) => {
        const parsed = parseObservedPropertyKey(item.key)
        return parsed.sourceKey === sourceKey
          ? { ...item, enabled: nextEnabled }
          : item
      })
      observedEnabledRef.current = new Map(
        next.map((item) => [item.key, item.enabled])
      )
      return next
    })
  }

  const onToggleSource = (key: string, nextEnabled: boolean) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    if (!nextEnabled) {
      setSourceObservedProps(key, false)
    }

    setSourceNetworks(key, nextEnabled)
  }

  const onToggleSourceNetwork = (
    sourceKey: string,
    networkKeyValue: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    setThingEnabled((prev) => {
      const next = { ...prev }
      for (const thing of thingsArr) {
        if (getThingSourceKey(thing) !== sourceKey) continue
        const thingNetworkKey = networkKey(
          thing?.Datastreams?.[0]?.Network?.name
        )
        if (thingNetworkKey !== networkKeyValue) continue

        const thingKey = getThingKey(thing)
        if (!thingKey) continue
        next[thingKey] = nextEnabled
      }
      return next
    })
  }

  const onToggleObservedSource = (sourceKey: string, nextEnabled: boolean) => {
    if (nextEnabled) {
      setSourceNetworks(sourceKey, false)
    }

    setSourceObservedProps(sourceKey, nextEnabled)
  }

  const onToggleSourceThing = (
    _sourceKeyValue: string,
    _networkKeyValue: string,
    thingKey: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled && isObservedMode) {
      setAllObservedProps(false)
    }

    setThingEnabled((prev) => ({
      ...prev,
      [thingKey]: nextEnabled,
    }))
  }

  const onToggleObservedPropertyDetail = (
    sourceKey: string,
    observedPropertyKey: string,
    nextEnabled: boolean
  ) => {
    if (nextEnabled) {
      setSourceNetworks(sourceKey, false)
    }

    observedEnabledRef.current.set(observedPropertyKey, nextEnabled)
    setObservedPropsMeta((prev) =>
      prev.map((item) =>
        item.key === observedPropertyKey
          ? { ...item, enabled: nextEnabled }
          : item
      )
    )
  }

  const onChangeSourceColor = (sourceKey: string, color: string) => {
    setSourceColorByKey((prev) => ({
      ...prev,
      [sourceKey]: color,
    }))
  }

  const sourceLabelByKey = thingsArr.reduce<Map<string, string>>(
    (acc, thing) => {
      acc.set(getThingSourceKey(thing), getThingSourceLabel(thing))
      return acc
    },
    new Map()
  )

  const resolvedSourceColorByKey = useMemo(() => {
    const sourceKeys = Array.from(
      new Set(thingsArr.map((thing) => getThingSourceKey(thing)))
    )
    return buildSourceColorMapWithOverrides(sourceKeys, sourceColorByKey)
  }, [thingsArr, sourceColorByKey])

  const dataSourcesForUI = Array.from(
    thingsArr.reduce<
      Map<
        string,
        {
          key: string
          label: string
          networks: Map<
            string,
            {
              key: string
              label: string
              things: Array<{ key: string; label: string; enabled: boolean }>
            }
          >
        }
      >
    >((acc, thing) => {
      const sourceKey = getThingSourceKey(thing)
      const sourceLabel = getThingSourceLabel(thing)
      const thingKey = getThingKey(thing)
      if (!thingKey) return acc

      const sourceEntry = acc.get(sourceKey) ?? {
        key: sourceKey,
        label: sourceLabel,
        networks: new Map(),
      }

      const thingLabel = String(thing?.name ?? '').trim() || 'Unnamed thing'
      const thingNetworkKey = networkKey(thing?.Datastreams?.[0]?.Network?.name)
      const thingNetworkLabel =
        thingNetworkKey === UNSPECIFIED_NETWORK_KEY
          ? t('map.unspecified_network')
          : thingNetworkKey

      const networkEntry = sourceEntry.networks.get(thingNetworkKey) ?? {
        key: thingNetworkKey,
        label: thingNetworkLabel,
        things: [],
      }

      networkEntry.things.push({
        key: thingKey,
        label: thingLabel,
        enabled: thingEnabled[thingKey] !== false,
      })

      sourceEntry.networks.set(thingNetworkKey, networkEntry)
      acc.set(sourceKey, sourceEntry)
      return acc
    }, new Map())
  ).map(([, source]) => {
    const networks = Array.from(source.networks.values())
      .map((network) => {
        const things = [...network.things].sort((a, b) =>
          a.label.localeCompare(b.label)
        )
        return {
          key: network.key,
          label: network.label,
          enabled:
            things.length > 0 ? things.every((thing) => thing.enabled) : false,
          things,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))

    return {
      key: source.key,
      label: source.label,
      color: resolvedSourceColorByKey.get(source.key),
      enabled:
        networks.length > 0
          ? networks.every((network) => network.enabled)
          : false,
      networks,
      observedProperties: [],
      observedEnabled: false,
    } as DataSourceLayerItem
  })

  const dataSourcesByKey = new Map(
    dataSourcesForUI.map((source) => [source.key, source])
  )

  for (const observedProperty of observedPropsMeta) {
    const parsed = parseObservedPropertyKey(observedProperty.key)
    const sourceLabel =
      sourceLabelByKey.get(parsed.sourceKey) ??
      `Data source ${parsed.sourceKey}`

    const sourceEntry = dataSourcesByKey.get(parsed.sourceKey) ?? {
      key: parsed.sourceKey,
      label: sourceLabel,
      color: resolvedSourceColorByKey.get(parsed.sourceKey),
      enabled: false,
      networks: [],
      observedProperties: [],
      observedEnabled: false,
    }

    sourceEntry.observedProperties.push({
      key: observedProperty.key,
      label: parsed.observedPropertyName,
      enabled: observedProperty.enabled,
    })

    dataSourcesByKey.set(parsed.sourceKey, sourceEntry)
  }

  for (const source of dataSourcesByKey.values()) {
    source.observedProperties = [...source.observedProperties].sort((a, b) =>
      a.label.localeCompare(b.label)
    )
    const hasAnyObservedEnabled = source.observedProperties.some(
      (property) => property.enabled
    )
    source.observedEnabled =
      source.observedProperties.length > 0
        ? source.observedProperties.every((property) => property.enabled)
        : false
    source.enabled =
      hasAnyObservedEnabled ||
      source.networks.some((network) => network.enabled)
  }

  const orderedDataSourcesForUI = Array.from(dataSourcesByKey.values()).sort(
    (a, b) => a.label.localeCompare(b.label)
  )

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {contextMenu ? (
        <MapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onCenterHere={() => {
            mapRef.current?.setView(
              [contextMenu.latitude, contextMenu.longitude],
              mapRef.current?.getZoom?.() ?? 10
            )
            setContextMenu(null)
          }}
          onCreateThing={() => {
            onCreateThingAt?.({
              latitude: contextMenu.latitude,
              longitude: contextMenu.longitude,
            })
            setContextMenu(null)
          }}
          onZoomIn={() => {
            mapRef.current?.zoomIn?.()
            setContextMenu(null)
          }}
          onZoomOut={() => {
            mapRef.current?.zoomOut?.()
            setContextMenu(null)
          }}
        />
      ) : null}

      <LayersControl
        title={t('data_sources.title')}
        sources={orderedDataSourcesForUI}
        onToggleSource={onToggleSource}
        onSourceColorChange={onChangeSourceColor}
        onToggleNetwork={onToggleSourceNetwork}
        onToggleThing={onToggleSourceThing}
        onToggleObservedGroup={onToggleObservedSource}
        onToggleObservedProperty={onToggleObservedPropertyDetail}
      />

      <div className="absolute bottom-10 right-10 z-[2000]">
        <MapMenu active={basemap} onChange={setBasemap} />
      </div>
    </div>
  )
}
