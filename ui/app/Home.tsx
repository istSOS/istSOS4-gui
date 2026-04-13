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
import LeafletMap from '@/features/map/components/LeafletMap'
import ChartModal from '@/features/observations/components/ChartModal'
import { getObservationsByDatastream } from '@/services/observations'
import { Button } from '@heroui/button'
import { Card } from '@heroui/card'
import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'

import { siteConfig } from '@/config/site'

import { useRouter } from 'next/navigation'

import { useAuth } from '@/context/AuthContext'

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
  const router = useRouter()
  const { token } = useAuth()
  const [localThings, setLocalThings] = useState<any[]>(things)

  useEffect(() => {
    setLocalThings(things)
  }, [things])

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
      localThings.find(
        (t) => String(t?.['@iot.id'] ?? t?.id ?? '') === selectedThingId
      ) ?? null
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
    range?: { start?: string | null; end?: string | null }
  ) => {
    if (siteConfig.authorizationEnabled && !token) {
      setObsError('Missing token')
      return
    }

    let startIso = range?.start ?? null
    let endIso = range?.end ?? null

    if (!startIso || !endIso) {
      const [, endRaw] = phenomenonTime?.split('/') ?? []

      const end = endRaw ? dayjs.utc(endRaw) : dayjs.utc()
      const start = end.subtract(7, 'day')
      endIso = end.toISOString()
      startIso = start.toISOString()
    }

    const cacheKey = `${datastreamId}|${startIso}|${endIso}`
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
      const { observationData } = await getObservationsByDatastream(
        token ?? undefined,
        datastreamId,
        startIso ?? undefined,
        endIso ?? undefined
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
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }
    await loadObservations(dsId, ds.phenomenonTime)
  }

  const applyObservationRange = async (
    start?: string | null,
    end?: string | null
  ) => {
    const dsId = String(
      selectedDatastream?.['@iot.id'] ?? selectedDatastream?.id ?? ''
    )
    if (!dsId) return

    await loadObservations(dsId, selectedDatastream?.phenomenonTime, {
      start,
      end,
    })
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className="absolute left-4 top-4 z-[4100] max-w-sm">
        <Card className="section-card p-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Monitoring workspace</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Select a station on the map to open stream details and charts.
              </p>
            </div>
            <Button
              size="sm"
              radius="sm"
              color="primary"
              onPress={() => router.push('/history')}
            >
              Open History Explorer
            </Button>
          </div>
        </Card>
      </div>
      <LeafletMap
        things={localThings}
        selectedNetwork={selectedNetwork}
        onThingSelect={(thing) => {
          setSelectedThingId(String(thing?.['@iot.id'] ?? thing?.id ?? ''))
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
