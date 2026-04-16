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
import { useEffect, useMemo, useRef, useState } from 'react'

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
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
}

const LeafletMap = dynamic(() => import('@/features/map/components/LeafletMap'), {
  ssr: false,
})

const getThingKey = (thing: any) => {
  const sourceId = String(thing?.__sourceId ?? '0')
  const thingId = String(thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? '')
  return `${sourceId}::${thingId}`
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const mapThingsApiPath = `${normalizedBasePath}/api/data-sources/things`

export default function Home({
  things,
  locations,
  sensors,
  observedProperties,
  datastreams,
  networks,
  selectedNetwork,
}: {
  things: any[]
  locations: any[]
  sensors: any[]
  observedProperties: any[]
  datastreams: any[]
  networks: any[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()
  const [localThings, setLocalThings] = useState<any[]>(things)

  useEffect(() => {
    setLocalThings(things)
  }, [things])

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

        setLocalThings(data.things)
      } catch {}
    })()

    return () => {
      mounted = false
    }
  }, [token])

  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [selectedDatastream, setSelectedDatastream] = useState<any | null>(null)
  const [createFormState, setCreateFormState] =
    useState<CreateFormState | null>(null)

  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)
  const [obsStart, setObsStart] = useState<string | null>(null)
  const [obsEnd, setObsEnd] = useState<string | null>(null)

  const obsCacheRef = useRef<Map<string, any[]>>(new Map())
  const [observations, setObservations] = useState<any[]>([])

  const selectedThing = useMemo(() => {
    if (!selectedThingId) return null
    return (
      localThings.find((thing) => getThingKey(thing) === selectedThingId) ?? null
    )
  }, [localThings, selectedThingId])

  const isPanelOpen = !!selectedThing

  const closePanel = () => {
    setSelectedThingId(null)
    setSelectedDatastream(null)
    setObservations([])
    setObsError(null)
    setObsLoading(false)
    setObsStart(null)
    setObsEnd(null)
  }

  const loadObservations = async (
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
      setObservations(cached)
      setObsStart(startIso)
      setObsEnd(endIso)
      return
    }

    setObsLoading(true)
    setObsError(null)
    try {
      const sourceToken = getDataSourceToken(resolvedEndpoint)
      const { observationData } = await getObservationsByDatastream(
        sourceToken ?? token ?? undefined,
        datastreamId,
        startIso ?? undefined,
        endIso ?? undefined,
        resolvedEndpoint
      )
      obsCacheRef.current.set(cacheKey, observationData)
      setObservations(observationData)
      setObsStart(startIso)
      setObsEnd(endIso)
    } catch (e: any) {
      setObsError(e?.message ?? 'Failed to load observations')
      setObservations([])
    } finally {
      setObsLoading(false)
    }
  }

  const openChartForDatastream = async (ds: any) => {
    setSelectedDatastream(ds)

    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
    const sourceEndpoint = String(
      ds?.__sourceEndpoint ?? selectedThing?.__sourceEndpoint ?? siteConfig.api_root
    )
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }
    await loadObservations(dsId, ds.phenomenonTime, undefined, sourceEndpoint)
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

    await loadObservations(dsId, selectedDatastream?.phenomenonTime, {
      start,
      end,
    }, sourceEndpoint)
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <LeafletMap
        things={localThings}
        selectedNetwork={selectedNetwork}
        onThingSelect={(thing) => {
          setSelectedThingId(getThingKey(thing))
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
        }}
        onCreateThingAt={(point) => {
          setCreateFormState({
            latitude: point.latitude,
            longitude: point.longitude,
            initialTab: 'thing',
          })
        }}
      />
      {createFormState ? (
        <FormModal
          operation="create"
          latitude={createFormState.latitude}
          longitude={createFormState.longitude}
          initialTab={createFormState.initialTab}
          existingEntities={{
            things: localThings,
            locations,
            sensors,
            observedProperties,
            datastreams,
            networks,
          }}
          isOpen={!!createFormState}
          onClose={() => {
            setCreateFormState(null)
          }}
        />
      ) : null}
      <ChartModal
        isOpen={!!selectedDatastream}
        onClose={() => {
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
          setObsLoading(false)
          setObsStart(null)
          setObsEnd(null)
        }}
        thing={selectedThing}
        datastream={selectedDatastream}
        observations={observations}
        loading={obsLoading}
        error={obsError}
        start={obsStart}
        end={obsEnd}
        onApplyRange={applyObservationRange}
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
                onClose={closePanel}
                onCreateDatastream={() => {
                  setCreateFormState({
                    initialTab: 'datastream',
                  })
                }}
                onOpenDetails={openChartForDatastream}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
