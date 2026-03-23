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
import ObservationGraph from '@/features/observations/components/ObservationGraph'
import { getObservationsByDatastream } from '@/services/observations'
import { Card } from '@heroui/card'
import { Tab, Tabs } from '@heroui/tabs'
import dayjs from 'dayjs'
import React, { useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

type BottomTabKey = 'table' | 'chart'
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
  selectedNetwork,
}: {
  things: any[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()
  const [localThings, setLocalThings] = useState<any[]>(things)

  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabKey>('table')
  const [selectedDatastream, setSelectedDatastream] = useState<any | null>(null)
  const [createFormState, setCreateFormState] =
    useState<CreateFormState | null>(null)

  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)

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
    setActiveBottomTab('table')
    setObservations([])
    setObsError(null)
    setObsLoading(false)
  }

  const loadObservations = async (
    datastreamId: string,
    phenomenonTime?: string
  ) => {
    if (!token) {
      setObsError('Missing token')
      return
    }

    const cached = obsCacheRef.current.get(datastreamId)
    if (cached) {
      setObservations(cached)
      return
    }

    setObsLoading(true)
    setObsError(null)
    try {
      const [, endRaw] = phenomenonTime.split('/')

      const end = dayjs.utc(endRaw)
      const start = end.subtract(7, 'day')
      const endIso = end.toISOString()
      const startIso = start.toISOString()
      const { observationData } = await getObservationsByDatastream(
        token,
        datastreamId,
        startIso,
        endIso
      )
      obsCacheRef.current.set(datastreamId, observationData)
      setObservations(observationData)
    } catch (e: any) {
      setObsError(e?.message ?? 'Failed to load observations')
      setObservations([])
    } finally {
      setObsLoading(false)
    }
  }

  const openChartForDatastream = async (ds: any) => {
    setSelectedDatastream(ds)
    setActiveBottomTab('chart')

    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }
    await loadObservations(dsId, ds.phenomenonTime)
  }

  return (
    <div className="relative h-[95vh] w-full overflow-hidden">
      <div className="absolute top-[500px] right-6 z-[3000] flex gap-2">
        <Link 
          href="/history"
          style={{ fontFamily: 'Arial, sans-serif' }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-[#007668] shadow-lg transition-all hover:scale-105 hover:bg-[#007668] hover:text-white"
        >
          History Explorer
        </Link>
      </div>
      <LeafletMap
        things={localThings}
        selectedNetwork={selectedNetwork}
        onThingSelect={(thing) => {
          setSelectedThingId(String(thing?.['@iot.id'] ?? thing?.id ?? ''))
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
          setActiveBottomTab('table')
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
          things={localThings}
          isOpen={!!createFormState}
          onClose={() => {
            setCreateFormState(null)
          }}
        />
      ) : null}
      {isPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)]">
          <Card
            radius="none"
            className="max-h-[38vh] overflow-hidden"
            classNames={{ body: 'p-0' }}
          >
            <div className="px-3 pt-2">
              <Tabs
                selectedKey={activeBottomTab}
                onSelectionChange={async (key) => {
                  const next = key as BottomTabKey
                  setActiveBottomTab(next)

                  if (next === 'chart' && selectedDatastream) {
                    const dsId = String(
                      selectedDatastream?.['@iot.id'] ??
                      selectedDatastream?.id ??
                      ''
                    )
                    if (dsId)
                      await loadObservations(
                        dsId,
                        selectedDatastream.phenomenonTime
                      )
                  }
                }}
                variant="underlined"
                classNames={{
                  cursor: 'bg-[#007668]',
                  tab: 'data-[selected=true]:text-[#007668] font-bold',
                }}
              >
                <Tab key="table" title="Table">
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
                </Tab>

                <Tab key="chart" title="Chart">
                  <div className="h-[32vh] p-3">
                    <ObservationGraph
                      thing={selectedThing}
                      datastream={selectedDatastream}
                      observations={observations}
                      loading={obsLoading}
                      error={obsError}
                    />
                  </div>
                </Tab>
              </Tabs>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
