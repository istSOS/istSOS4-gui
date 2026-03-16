'use client'

import { Card } from '@heroui/card'
import { Tab, Tabs } from '@heroui/tabs'
import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'

import MainGraph from '@/features/observations/components/MainGraph'
import LeafletMap from '@/features/map/components/LeafletMap'
import MainTable from '@/features/things/components/MainTable'

import { useAuth } from '@/context/AuthContext'

import { getObservationsByDatastream } from '@/services/observations'

type BottomTabKey = 'table' | 'chart'

export default function Home({
  things,
  selectedNetwork,
}: {
  things: any[]
  selectedNetwork?: string
}) {
  const { token } = useAuth()

  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabKey>('table')
  const [selectedDatastream, setSelectedDatastream] = useState<any | null>(null)

  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)

  const obsCacheRef = useRef<Map<string, any[]>>(new Map())
  const [observations, setObservations] = useState<any[]>([])

  const selectedThing = useMemo(() => {
    if (!selectedThingId) return null
    return things.find((t) => t?.['@iot.id'] === selectedThingId) ?? null
  }, [things, selectedThingId])

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
      <LeafletMap
        things={things}
        selectedNetwork={selectedNetwork}
        onThingSelect={(thing) => {
          setSelectedThingId(thing?.['@iot.id'] ?? null)
          setSelectedDatastream(null)
          setObservations([])
          setObsError(null)
          setActiveBottomTab('table')
        }}
      />

      {isPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pb-[env(safe-area-inset-bottom)]">
          <Card
            radius="none"
            className="max-h-[38vh] overflow-hidden"
            classNames={{ body: 'p-0' }}
          >
            <div className="px-3 pt-2">
              <Tabs
                aria-label="Thing panel"
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
              >
                <Tab key="table" title="Table">
                  <div className="max-h-[32vh] overflow-auto pb-2">
                    <MainTable
                      thing={selectedThing}
                      onClose={closePanel}
                      onOpenDetails={openChartForDatastream}
                    />
                  </div>
                </Tab>

                <Tab key="chart" title="Chart">
                  <div className="h-[32vh] p-3">
                    <MainGraph
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
