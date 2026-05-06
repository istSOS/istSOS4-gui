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
import DatastreamTable from '@/features/datastreams/components/DatastreamTable'
import FormModal from '@/features/forms/components/FormModal'
import ChartModal from '@/features/observations/components/ChartModal'
import { getObservationsByDatastream } from '@/services/observations'
import { Card } from '@heroui/card'
import dayjs from 'dayjs'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'
import { getAllDataSourceTokens, getDataSourceToken } from '@/lib/dataSourceTokens'

type FormTabKey =
  | 'thing'
  | 'location'
  | 'sensor'
  | 'observedProperty'
  | 'datastream'

type CreateFormState = {
  mode: 'create' | 'edit'
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
  initialSingleDraft?: Record<string, any>
  initialSingleDataSourceEndpoint?: string
  lockedSingleEntity?: FormTabKey
  editTargets?: Partial<Record<FormTabKey, string>>
}

type WritableDataSourceOption = {
  id: string
  name: string
  endpoint: string
}

type CsvDownloadPayload = {
  filename: string
  bytes: ArrayBuffer
}

const LeafletMap = dynamic(() => import('@/features/map/components/LeafletMap'), {
  ssr: false,
})

const getThingKey = (thing: any) => {
  const sourceId = String(
    thing?.__sourceId ?? thing?.__sourceEndpoint ?? siteConfig.api_root
  )
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceId}::${thingId}`
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const mapThingsApiPath = `${normalizedBasePath}/api/data-sources/things`
const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/, '')
const toKeyValueItems = (value: any) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value)
    .filter(([key]) => String(key).trim().length > 0)
    .map(([key, entryValue]) => ({
      key: String(key),
      value: String(entryValue ?? ''),
    }))
}
const toEntityId = (value: any) =>
  String(value?.['@iot.id'] ?? value?.id ?? '').trim()
const toLocationValue = (value: any) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  const coordinates = Array.isArray(value?.coordinates) ? value.coordinates : null
  if (
    coordinates &&
    coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  ) {
    return `${Number(coordinates[0]).toFixed(2)}, ${Number(coordinates[1]).toFixed(2)}`
  }

  return ''
}

export default function Home({
  things,
  locations,
  sensors,
  observedProperties,
  datastreams,
  networks,
  writableDataSources,
  selectedNetwork,
}: {
  things: any[]
  locations: any[]
  sensors: any[]
  observedProperties: any[]
  datastreams: any[]
  networks: any[]
  writableDataSources: WritableDataSourceOption[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()
  const primaryEndpoint = useMemo(
    () => normalizeEndpoint(siteConfig.api_root),
    []
  )
  const primarySourceName = useMemo(() => {
    const source = writableDataSources.find(
      (entry) => normalizeEndpoint(entry.endpoint) === primaryEndpoint
    )
    return source?.name?.trim() || 'Primary data source'
  }, [primaryEndpoint, writableDataSources])

  const enrichThingsWithSourceMetadata = useCallback(
    (items: any[]) =>
      items.map((thing) => {
        const sourceEndpoint = normalizeEndpoint(
          String(thing?.__sourceEndpoint ?? primaryEndpoint)
        )
        const datastreams = Array.isArray(thing?.Datastreams)
          ? thing.Datastreams.map((datastream: any) => ({
              ...datastream,
              __sourceId: String(
                datastream?.__sourceId ?? thing?.__sourceId ?? sourceEndpoint
              ),
              __sourceName: String(
                datastream?.__sourceName ?? thing?.__sourceName ?? primarySourceName
              ),
              __sourceEndpoint: normalizeEndpoint(
                String(datastream?.__sourceEndpoint ?? sourceEndpoint)
              ),
            }))
          : thing?.Datastreams

        return {
          ...thing,
          __sourceId: String(thing?.__sourceId ?? sourceEndpoint),
          __sourceName: String(thing?.__sourceName ?? primarySourceName),
          __sourceEndpoint: sourceEndpoint,
          Datastreams: datastreams,
        }
      }),
    [primaryEndpoint, primarySourceName]
  )
  const enrichEntitiesWithSourceMetadata = useCallback(
    (items: any[]) =>
      items.map((entity) => {
        const sourceEndpoint = normalizeEndpoint(
          String(entity?.__sourceEndpoint ?? primaryEndpoint)
        )

        return {
          ...entity,
          __sourceId: String(entity?.__sourceId ?? sourceEndpoint),
          __sourceName: String(entity?.__sourceName ?? primarySourceName),
          __sourceEndpoint: sourceEndpoint,
        }
      }),
    [primaryEndpoint, primarySourceName]
  )

  const [localThings, setLocalThings] = useState<any[]>(() =>
    enrichThingsWithSourceMetadata(things)
  )
  const [localSensors, setLocalSensors] = useState<any[]>(() =>
    enrichEntitiesWithSourceMetadata(sensors)
  )
  const [localObservedProperties, setLocalObservedProperties] = useState<any[]>(
    () => enrichEntitiesWithSourceMetadata(observedProperties)
  )
  const [localNetworks, setLocalNetworks] = useState<any[]>(() =>
    enrichEntitiesWithSourceMetadata(networks)
  )
  const [createFormState, setCreateFormState] =
    useState<CreateFormState | null>(null)

  useEffect(() => {
    setLocalThings(enrichThingsWithSourceMetadata(things))
    setLocalSensors(enrichEntitiesWithSourceMetadata(sensors))
    setLocalObservedProperties(
      enrichEntitiesWithSourceMetadata(observedProperties)
    )
    setLocalNetworks(enrichEntitiesWithSourceMetadata(networks))
  }, [
    things,
    sensors,
    observedProperties,
    networks,
    enrichThingsWithSourceMetadata,
    enrichEntitiesWithSourceMetadata,
  ])

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const tokenMap = getAllDataSourceTokens()
        const response = await fetch(mapThingsApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: tokenMap }),
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = await response.json().catch(() => null)
        if (!mounted || !Array.isArray(data?.things)) return

        setLocalThings(enrichThingsWithSourceMetadata(data.things))
        if (Array.isArray(data?.sensors)) {
          setLocalSensors(enrichEntitiesWithSourceMetadata(data.sensors))
        }
        if (Array.isArray(data?.observedProperties)) {
          setLocalObservedProperties(
            enrichEntitiesWithSourceMetadata(data.observedProperties)
          )
        }
        if (Array.isArray(data?.networks)) {
          setLocalNetworks(enrichEntitiesWithSourceMetadata(data.networks))
        }
      } catch {}
    })()

    return () => {
      mounted = false
    }
  }, [
    token,
    things,
    createFormState,
    enrichThingsWithSourceMetadata,
    enrichEntitiesWithSourceMetadata,
  ])

  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [selectedObservedPropertyName, setSelectedObservedPropertyName] =
    useState<string | null>(null)
  const [tableObservedPropertyFilter, setTableObservedPropertyFilter] =
    useState<string | null>(null)
  const [selectedThingKeysForChart, setSelectedThingKeysForChart] = useState<
    string[]
  >([])
  const [
    selectedObservedPropertyNamesForChart,
    setSelectedObservedPropertyNamesForChart,
  ] = useState<string[]>([])
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [selectedDatastream, setSelectedDatastream] = useState<any | null>(null)
  const [comparisonDatastream, setComparisonDatastream] = useState<any | null>(
    null
  )
  const [activeDatastreamIds, setActiveDatastreamIds] = useState<string[]>([])
  const [isClientMounted, setIsClientMounted] = useState(false)
  const locationsForForm = useMemo(() => {
    const primaryEndpoint = normalizeEndpoint(siteConfig.api_root)
    const byKey = new Map<string, any>()

    const addLocation = (location: any, sourceEndpoint: string) => {
      const locationId = String(location?.['@iot.id'] ?? location?.id ?? '').trim()
      if (!locationId) return

      const normalizedSourceEndpoint =
        normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
      const dedupKey = `${normalizedSourceEndpoint}::${locationId}`
      if (byKey.has(dedupKey)) return

      byKey.set(dedupKey, {
        ...location,
        __sourceEndpoint: normalizedSourceEndpoint,
      })
    }

    for (const location of locations) {
      addLocation(
        location,
        String((location as any)?.__sourceEndpoint ?? primaryEndpoint)
      )
    }

    for (const thing of localThings) {
      const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
      const thingLocations = Array.isArray(thing?.Locations) ? thing.Locations : []
      for (const location of thingLocations) {
        addLocation(location, sourceEndpoint)
      }
    }

    return Array.from(byKey.values())
  }, [locations, localThings])
  const networksForForm = useMemo(() => {
    const byKey = new Map<string, any>()

    const addNetwork = (network: any, sourceEndpoint: string) => {
      const networkId = String(network?.['@iot.id'] ?? network?.id ?? '').trim()
      if (!networkId) return

      const normalizedSourceEndpoint =
        normalizeEndpoint(sourceEndpoint || primaryEndpoint) || primaryEndpoint
      const dedupKey = `${normalizedSourceEndpoint}::${networkId}`
      if (byKey.has(dedupKey)) return

      byKey.set(dedupKey, {
        ...network,
        __sourceEndpoint: normalizedSourceEndpoint,
      })
    }

    for (const network of localNetworks) {
      addNetwork(
        network,
        String((network as any)?.__sourceEndpoint ?? primaryEndpoint)
      )
    }

    for (const thing of localThings) {
      const sourceEndpoint = String(thing?.__sourceEndpoint ?? primaryEndpoint)
      const thingDatastreams = Array.isArray(thing?.Datastreams)
        ? thing.Datastreams
        : []
      for (const datastream of thingDatastreams) {
        if (!datastream?.Network) continue
        addNetwork(
          datastream.Network,
          String(datastream?.__sourceEndpoint ?? sourceEndpoint)
        )
      }
    }

    return Array.from(byKey.values())
  }, [localNetworks, localThings, primaryEndpoint])

  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)
  const [obsStart, setObsStart] = useState<string | null>(null)
  const [obsEnd, setObsEnd] = useState<string | null>(null)

  useEffect(() => {
    setIsClientMounted(true)
  }, [])

  const obsCacheRef = useRef<Map<string, any[]>>(new Map())
  const [observations, setObservations] = useState<any[]>([])
  const [comparisonObservations, setComparisonObservations] = useState<any[]>([])
  const [allSeries, setAllSeries] = useState<
    Array<{ datastream: any; observations: any[] }>
  >([])

  const selectedThing = useMemo(() => {
    if (!selectedThingId) return null
    return (
      localThings.find((thing) => getThingKey(thing) === selectedThingId) ?? null
    )
  }, [localThings, selectedThingId])

  const isPanelOpen = !!selectedThing
  const thingKeyFor = (thing: any) =>
    `${String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')}::${String(
      thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? ''
    )}`

  const closePanel = () => {
    setSelectedThingId(null)
    setSelectedObservedPropertyName(null)
    setTableObservedPropertyFilter(null)
    setIsChartOpen(false)
    setSelectedDatastream(null)
    setComparisonDatastream(null)
    setObservations([])
    setComparisonObservations([])
    setObsError(null)
    setObsLoading(false)
    setObsStart(null)
    setObsEnd(null)
    setActiveDatastreamIds([])
    setAllSeries([])
  }

  const fetchObservations = async (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string
  ) => {
    let startIso = range?.start ?? null
    let endIso = range?.end ?? null
    const resolvedEndpoint =
      sourceEndpoint?.trim().replace(/\/+$/, '') ?? siteConfig.api_root

    if (!startIso || !endIso) {
      const [, endRaw] = phenomenonTime?.split('/') ?? []

      const end = endRaw ? dayjs.utc(endRaw) : dayjs.utc()
      const start = end.subtract(7, 'day')
      endIso = end.toISOString()
      startIso = start.toISOString()
    }

    const cacheKey = `${resolvedEndpoint}|${datastreamId}|${startIso}|${endIso}`
    const cached = obsCacheRef.current.get(cacheKey)
    if (cached) {
      return { data: cached, startIso, endIso }
    }

    const sourceToken = getDataSourceToken(resolvedEndpoint)
    const { observationData } = await getObservationsByDatastream(
      sourceToken ?? token ?? undefined,
      datastreamId,
      startIso ?? undefined,
      endIso ?? undefined,
      resolvedEndpoint
    )
    obsCacheRef.current.set(cacheKey, observationData)
    return { data: observationData, startIso, endIso }
  }

  const loadPrimaryObservations = async (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string
  ) => {
    setObsLoading(true)
    setObsError(null)
    try {
      const result = await fetchObservations(
        datastreamId,
        phenomenonTime,
        range,
        sourceEndpoint
      )
      setObservations(result.data)
      setObsStart(result.startIso)
      setObsEnd(result.endIso)
    } catch (e: any) {
      setObsError(e?.message ?? 'Failed to load observations')
      setObservations([])
    } finally {
      setObsLoading(false)
    }
  }

  const loadComparisonObservations = async (
    ds: any | null,
    range?: { start?: string | null; end?: string | null }
  ) => {
    if (!ds) {
      setComparisonObservations([])
      return
    }

    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
    if (!dsId) {
      setComparisonObservations([])
      return
    }

    const sourceEndpoint = String(
      ds?.__sourceEndpoint ?? selectedThing?.__sourceEndpoint ?? siteConfig.api_root
    )
    const result = await fetchObservations(
      dsId,
      ds?.phenomenonTime,
      range,
      sourceEndpoint
    )
    setComparisonObservations(result.data)
  }

  const loadAllDatastreamObservationsForThing = async (
    thing: any,
    range?: { start?: string | null; end?: string | null },
    options?: { observedPropertyNameFilter?: string | null }
  ) => {
    const allThingDatastreams = Array.isArray(thing?.Datastreams)
      ? thing.Datastreams
      : []
    const filterName = String(
      options?.observedPropertyNameFilter ?? ''
    ).trim().toLowerCase()
    const thingDatastreams = filterName
      ? allThingDatastreams.filter((ds: any) =>
          String(ds?.ObservedProperty?.name ?? '')
            .trim()
            .toLowerCase()
            .includes(filterName)
        )
      : allThingDatastreams
    const entries = await Promise.all(
      thingDatastreams.map(async (ds: any) => {
        const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
        if (!dsId) {
          return { datastream: ds, observations: [] as any[] }
        }
        const sourceEndpoint = String(
          ds?.__sourceEndpoint ?? thing?.__sourceEndpoint ?? siteConfig.api_root
        )
        const result = await fetchObservations(
          dsId,
          ds?.phenomenonTime,
          range,
          sourceEndpoint
        )
        return { datastream: ds, observations: result.data }
      })
    )
    setAllSeries(entries)
  }

  const openChartForDatastream = async (ds: any) => {
    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }

    const thingKeys =
      selectedThing && thingKeyFor(selectedThing)
        ? [thingKeyFor(selectedThing)]
        : []

    const opName = String(ds?.ObservedProperty?.name ?? '').trim()
    const observedPropertyNames =
      tableObservedPropertyFilter && tableObservedPropertyFilter.trim()
        ? [tableObservedPropertyFilter.trim()]
        : opName
          ? [opName]
          : []

    await openChartForThingAndObservedProperties(
      thingKeys,
      observedPropertyNames,
      dsId
    )
  }

  const openChartForThingAndObservedProperty = async (
    thing: any,
    observedPropertyName?: string | null
  ) => {
    if (!thing) return
    const normalizedFilter = String(observedPropertyName ?? '').trim() || null

    setSelectedThingId(getThingKey(thing))
    setSelectedObservedPropertyName(normalizedFilter)
    setIsChartOpen(true)
    setComparisonDatastream(null)
    setComparisonObservations([])

    const thingDatastreams = Array.isArray(thing?.Datastreams)
      ? thing.Datastreams
      : []
    const filteredDatastreams = normalizedFilter
      ? thingDatastreams.filter((ds: any) =>
          String(ds?.ObservedProperty?.name ?? '')
            .trim()
            .toLowerCase()
            .includes(normalizedFilter.toLowerCase())
        )
      : thingDatastreams

    const primaryDatastream = filteredDatastreams[0] ?? null
    setSelectedDatastream(primaryDatastream)
    setActiveDatastreamIds(
      primaryDatastream
        ? [String(primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? '')]
        : []
    )

    if (!primaryDatastream) {
      setObservations([])
      setAllSeries([])
      return
    }

    const dsId = String(
      primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? ''
    )
    const sourceEndpoint = String(
      primaryDatastream?.__sourceEndpoint ??
        thing?.__sourceEndpoint ??
        siteConfig.api_root
    )

    await loadPrimaryObservations(
      dsId,
      primaryDatastream?.phenomenonTime,
      { start: obsStart, end: obsEnd },
      sourceEndpoint
    )
    await loadAllDatastreamObservationsForThing(
      thing,
      { start: obsStart, end: obsEnd },
      { observedPropertyNameFilter: normalizedFilter }
    )
  }

  const openChartForThingAndObservedProperties = async (
    thingKeys: string[],
    observedPropertyNames: string[],
    preferredDatastreamId?: string
  ) => {
    setIsChartOpen(true)
    const keys = Array.from(new Set(thingKeys)).filter(Boolean)
    const ops = Array.from(
      new Set(observedPropertyNames.map((name) => name.trim()).filter(Boolean))
    )
    setSelectedThingKeysForChart(keys)
    setSelectedObservedPropertyNamesForChart(ops)

    const selectedThingsForChart = localThings.filter((thing) =>
      keys.includes(thingKeyFor(thing))
    )
    const primaryThing = selectedThingsForChart[0] ?? null
    setSelectedThingId(primaryThing ? getThingKey(primaryThing) : null)
    setSelectedObservedPropertyName(ops[0] ?? null)

    const datastreamCandidates = selectedThingsForChart.flatMap((thing) =>
      (Array.isArray(thing?.Datastreams) ? thing.Datastreams : []).filter(
        (ds: any) =>
          ops.length === 0 ||
          ops.some(
            (op) =>
              String(ds?.ObservedProperty?.name ?? '')
                .trim()
                .toLowerCase() === op.toLowerCase()
          )
      )
    )

    const preferredId = String(preferredDatastreamId ?? '').trim()
    const primaryDatastream =
      (preferredId
        ? datastreamCandidates.find(
            (ds: any) =>
              String(ds?.['@iot.id'] ?? ds?.id ?? '').trim() === preferredId
          )
        : null) ??
      datastreamCandidates[0] ??
      null
    setSelectedDatastream(primaryDatastream)
    setComparisonDatastream(null)
    setComparisonObservations([])
    setActiveDatastreamIds(
      primaryDatastream
        ? [String(primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? '')]
        : []
    )

    const nextSeries: Array<{ datastream: any; observations: any[] }> = []
    let resolvedStart: string | null = null
    let resolvedEnd: string | null = null
    const primaryId = String(
      primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? ''
    ).trim()
    for (const ds of datastreamCandidates) {
      const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
      if (!dsId) continue
      const sourceEndpoint = String(
        ds?.__sourceEndpoint ??
          primaryThing?.__sourceEndpoint ??
          siteConfig.api_root
      )
      const result = await fetchObservations(
        dsId,
        ds?.phenomenonTime,
        { start: obsStart, end: obsEnd },
        sourceEndpoint
      )
      nextSeries.push({ datastream: ds, observations: result.data })
      if (dsId === primaryId) {
        resolvedStart = result.startIso ?? null
        resolvedEnd = result.endIso ?? null
      }
    }
    setAllSeries(nextSeries)
    setObservations(nextSeries[0]?.observations ?? [])
    if (resolvedStart && resolvedEnd) {
      setObsStart(resolvedStart)
      setObsEnd(resolvedEnd)
    }
  }

  const applyObservationRange = async (
    start?: string | null,
    end?: string | null
  ) => {
    const dsId = String(
      selectedDatastream?.['@iot.id'] ?? selectedDatastream?.id ?? ''
    )
    if (!dsId) return

    const sourceEndpoint = String(
      selectedDatastream?.__sourceEndpoint ??
        selectedThing?.__sourceEndpoint ??
        siteConfig.api_root
    )

    await loadPrimaryObservations(
      dsId,
      selectedDatastream?.phenomenonTime,
      {
        start,
        end,
      },
      sourceEndpoint
    )

    if (comparisonDatastream) {
      try {
        await loadComparisonObservations(comparisonDatastream, { start, end })
      } catch (e: any) {
        setObsError(e?.message ?? 'Failed to load observations')
      }
    }
    if (selectedThing) {
      await loadAllDatastreamObservationsForThing(
        selectedThing,
        { start, end },
        { observedPropertyNameFilter: selectedObservedPropertyName }
      )
    }
  }

  const changeActiveDatastreams = async (nextDatastreamIds: string[]) => {
    const normalizedIdsRaw = Array.from(
      new Set(nextDatastreamIds.map((id) => String(id).trim()).filter(Boolean))
    ).slice(0, 2)
    const currentPrimaryId = String(activeDatastreamIds[0] ?? '')
    const normalizedIds = [...normalizedIdsRaw]
    if (
      currentPrimaryId &&
      normalizedIds.length > 1 &&
      normalizedIds.includes(currentPrimaryId) &&
      normalizedIds[0] !== currentPrimaryId
    ) {
      normalizedIds.splice(normalizedIds.indexOf(currentPrimaryId), 1)
      normalizedIds.unshift(currentPrimaryId)
    }

    setActiveDatastreamIds(normalizedIds)

    const getById = (id: string) =>
      allSeries.find(
        (entry) =>
          String(entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? '') ===
          id
      )?.datastream ?? null

    const primary = normalizedIds[0] ? getById(normalizedIds[0]) : null
    const secondary = normalizedIds[1] ? getById(normalizedIds[1]) : null

    setSelectedDatastream(primary)
    setComparisonDatastream(secondary)
    const activeObservedPropertyNames = [primary, secondary]
      .map((ds) => String(ds?.ObservedProperty?.name ?? '').trim())
      .filter(Boolean)
    const uniqueActiveObservedPropertyNames = Array.from(
      new Set(activeObservedPropertyNames)
    )
    setSelectedObservedPropertyNamesForChart(uniqueActiveObservedPropertyNames)
    setSelectedObservedPropertyName(uniqueActiveObservedPropertyNames[0] ?? null)

    if (!primary) {
      setSelectedDatastream(null)
      setComparisonDatastream(null)
      setObservations([])
      setComparisonObservations([])
      return
    }

    const primaryId = String(primary?.['@iot.id'] ?? primary?.id ?? '')
    const primarySeries =
      allSeries.find(
        (entry) =>
          String(
            entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? ''
          ) === primaryId
      ) ?? null
    setObservations(primarySeries?.observations ?? [])

    if (!secondary) {
      setComparisonObservations([])
      return
    }

    const secondaryId = String(secondary?.['@iot.id'] ?? secondary?.id ?? '')
    const secondarySeries =
      allSeries.find(
        (entry) =>
          String(
            entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? ''
          ) === secondaryId
      ) ?? null
    setComparisonObservations(secondarySeries?.observations ?? [])
  }

  const downloadAllDatastreamsCsv = async (): Promise<CsvDownloadPayload | null> => {
    if (!selectedThing) return null

    const thingDatastreams = Array.isArray(selectedThing?.Datastreams)
      ? selectedThing.Datastreams
      : []
    if (thingDatastreams.length === 0) return null

    const sanitizeSheetName = (value: string, fallback: string) => {
      const base = value.trim() || fallback
      const sanitized = base.replace(/[\\/*?:[\]]/g, '_').slice(0, 31)
      return sanitized || fallback
    }

    const workbook = XLSX.utils.book_new()

    await Promise.all(
      thingDatastreams.map(async (ds: any, index: number) => {
        const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
        if (!dsId) return

        const sourceEndpoint = String(
          ds?.__sourceEndpoint ??
            selectedThing?.__sourceEndpoint ??
            siteConfig.api_root
        )
        const streamName = String(ds?.name ?? dsId)

        const result = await fetchObservations(
          dsId,
          ds?.phenomenonTime,
          { start: obsStart, end: obsEnd },
          sourceEndpoint
        )

        const rows = (Array.isArray(result.data) ? result.data : [])
          .slice()
          .sort((a: any, b: any) => {
            const aTs = dayjs.utc(a?.phenomenonTime).valueOf()
            const bTs = dayjs.utc(b?.phenomenonTime).valueOf()
            if (!Number.isFinite(aTs) && !Number.isFinite(bTs)) return 0
            if (!Number.isFinite(aTs)) return 1
            if (!Number.isFinite(bTs)) return -1
            return aTs - bTs
          })
          .map((obs: any) => ({
            phenomenonTime: String(obs?.phenomenonTime ?? ''),
            result: obs?.result ?? '',
          }))
        const sheet = XLSX.utils.json_to_sheet(rows, {
          header: ['phenomenonTime', 'result'],
        })
        const sheetName = sanitizeSheetName(streamName, `Datastream_${index + 1}`)
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
      })
    )

    if (workbook.SheetNames.length === 0) return null

    const thingName = String(selectedThing?.name ?? 'thing')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
    const filename = `${thingName || 'thing'}.xlsx`
    const bytes = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    }) as ArrayBuffer

    return {
      filename,
      bytes,
    }
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {isClientMounted ? (
        <LeafletMap
          things={localThings}
          selectedNetwork={selectedNetwork}
          onThingSelect={(thing, selection) => {
            setSelectedThingId(getThingKey(thing))
            setSelectedObservedPropertyName(
              selection?.observedPropertyName?.trim() || null
            )
            setTableObservedPropertyFilter(
              selection?.observedPropertyName?.trim() || null
            )
            setSelectedDatastream(null)
            setComparisonDatastream(null)
            setObservations([])
            setComparisonObservations([])
            setObsError(null)
          }}
          onCreateThingAt={(point) => {
            setCreateFormState({
              mode: 'create',
              latitude: point.latitude,
              longitude: point.longitude,
              initialTab: 'thing',
            })
          }}
        />
      ) : null}
      {createFormState ? (
        <FormModal
          operation={createFormState.mode}
          latitude={createFormState.latitude}
          longitude={createFormState.longitude}
          initialTab={createFormState.initialTab}
          initialSingleDraft={createFormState.initialSingleDraft}
          initialSingleDataSourceEndpoint={
            createFormState.initialSingleDataSourceEndpoint
          }
          lockedSingleEntity={createFormState.lockedSingleEntity}
          editTargets={createFormState.editTargets}
          writableDataSources={writableDataSources}
          existingEntities={{
            things: localThings,
            locations: locationsForForm,
            sensors: localSensors,
            observedProperties: localObservedProperties,
            datastreams,
            networks: networksForForm,
          }}
          isOpen={!!createFormState}
          onClose={() => {
            setCreateFormState(null)
          }}
        />
      ) : null}
      <ChartModal
        isOpen={isChartOpen}
        onClose={() => {
          setIsChartOpen(false)
          setSelectedDatastream(null)
          setComparisonDatastream(null)
          setActiveDatastreamIds([])
          setObservations([])
          setComparisonObservations([])
          setAllSeries([])
          setObsError(null)
          setObsLoading(false)
          setObsStart(null)
          setObsEnd(null)
        }}
        things={localThings}
        thing={selectedThing}
        selectedObservedPropertyName={selectedObservedPropertyName}
        selectedThingKeys={selectedThingKeysForChart}
        selectedObservedPropertyNames={selectedObservedPropertyNamesForChart}
        datastream={selectedDatastream}
        observations={observations}
        comparisonDatastream={comparisonDatastream}
        comparisonObservations={comparisonObservations}
        allSeries={allSeries}
        loading={obsLoading}
        error={obsError}
        start={obsStart}
        end={obsEnd}
        onApplyRange={applyObservationRange}
        onDownloadAllDatastreams={downloadAllDatastreamsCsv}
        activeDatastreamIds={activeDatastreamIds}
        onActiveDatastreamsChange={changeActiveDatastreams}
        onThingKeysChange={(thingKeys) => {
          void openChartForThingAndObservedProperties(
            thingKeys,
            selectedObservedPropertyNamesForChart
          )
        }}
        onObservedPropertyNamesChange={(observedPropertyNames) => {
          void openChartForThingAndObservedProperties(
            selectedThingKeysForChart,
            observedPropertyNames
          )
        }}
        onResetRange={() => {
          applyObservationRange(null, null)
        }}
      />
      {isPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)]">
          <Card className="max-h-[38vh] overflow-hidden rounded-none">
            <div className="max-h-[32vh] overflow-auto pb-2">
              <DatastreamTable
                thing={selectedThing}
                observedPropertyNameFilter={tableObservedPropertyFilter}
                onClose={closePanel}
                onCreateDatastream={() => {
                  setCreateFormState({
                    mode: 'create',
                    initialTab: 'datastream',
                  })
                }}
                onOpenDetails={openChartForDatastream}
                onEditDatastream={(datastream) => {
                  const datastreamId = toEntityId(datastream)
                  if (!datastreamId) return

                  const sourceEndpoint = normalizeEndpoint(
                    String(
                      datastream?.__sourceEndpoint ??
                        selectedThing?.__sourceEndpoint ??
                      siteConfig.api_root
                    )
                  )
                  const selectedThingLocation = Array.isArray(
                    selectedThing?.Locations
                  )
                    ? selectedThing.Locations[0]
                    : null
                  const thingId = toEntityId(selectedThing)
                  const locationId = toEntityId(selectedThingLocation)
                  const sensorId = toEntityId(datastream?.Sensor)
                  const observedPropertyId = toEntityId(
                    datastream?.ObservedProperty
                  )
                  const networkId = toEntityId(datastream?.Network)

                  const datastreamDraft = {
                    name: String(datastream?.name ?? ''),
                    description: String(datastream?.description ?? ''),
                    observationType: String(datastream?.observationType ?? ''),
                    thingId,
                    sensorId,
                    observedPropertyId,
                    networkId,
                    unitOfMeasurement: toKeyValueItems(
                      datastream?.unitOfMeasurement
                    ),
                    properties: toKeyValueItems(datastream?.properties),
                  }
                  const thingDraft = {
                    name: String(selectedThing?.name ?? ''),
                    description: String(selectedThing?.description ?? ''),
                    locationId,
                    properties: toKeyValueItems(selectedThing?.properties),
                  }
                  const locationDraft = {
                    name: String(selectedThingLocation?.name ?? ''),
                    description: String(selectedThingLocation?.description ?? ''),
                    encodingType: String(
                      selectedThingLocation?.encodingType ?? 'application/geo+json'
                    ),
                    location: toLocationValue(selectedThingLocation?.location),
                    properties: toKeyValueItems(selectedThingLocation?.properties),
                  }
                  const sensorDraft = {
                    name: String(datastream?.Sensor?.name ?? ''),
                    description: String(datastream?.Sensor?.description ?? ''),
                    encodingType: String(datastream?.Sensor?.encodingType ?? ''),
                    metadata: String(datastream?.Sensor?.metadata ?? ''),
                    properties: toKeyValueItems(datastream?.Sensor?.properties),
                  }
                  const observedPropertyDraft = {
                    name: String(datastream?.ObservedProperty?.name ?? ''),
                    definition: String(
                      datastream?.ObservedProperty?.definition ?? ''
                    ),
                    description: String(
                      datastream?.ObservedProperty?.description ?? ''
                    ),
                    properties: toKeyValueItems(
                      datastream?.ObservedProperty?.properties
                    ),
                  }
                  const editTargets: Partial<Record<FormTabKey, string>> = {
                    datastream: datastreamId,
                    ...(thingId ? { thing: thingId } : {}),
                    ...(locationId ? { location: locationId } : {}),
                    ...(sensorId ? { sensor: sensorId } : {}),
                    ...(observedPropertyId
                      ? { observedProperty: observedPropertyId }
                      : {}),
                  }

                  setCreateFormState({
                    mode: 'edit',
                    initialTab: 'datastream',
                    initialSingleDataSourceEndpoint: sourceEndpoint,
                    initialSingleDraft: {
                      thing: thingDraft,
                      location: locationDraft,
                      sensor: sensorDraft,
                      observedProperty: observedPropertyDraft,
                      datastream: datastreamDraft,
                    },
                    editTargets,
                  })
                }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
