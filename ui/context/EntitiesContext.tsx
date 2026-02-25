'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/api'

import { useAuth } from './AuthContext'

type Entities = {
  locations: any[]
  things: any[]
  sensors: any[]
  datastreams: any[]
  observations: any[]
  featuresOfInterest: any[]
  observedProperties: any[]
  historicalLocations: any[]
  network: any[]
}

type EntitiesContextType = {
  entities: Entities
  setEntities: React.Dispatch<React.SetStateAction<Entities>>
  loading: boolean
  error: string | null
  refetchAll: () => Promise<void>
}

const EntitiesContext = createContext<EntitiesContextType>({
  entities: {
    locations: [],
    things: [],
    sensors: [],
    datastreams: [],
    observations: [],
    featuresOfInterest: [],
    observedProperties: [],
    historicalLocations: [],
    network: [],
  },
  setEntities: () => {},
  loading: true,
  error: null,
  refetchAll: async () => {},
})

export function EntitiesProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth()

  const [entities, setEntities] = useState<Entities>({
    locations: [],
    things: [],
    sensors: [],
    datastreams: [],
    observations: [],
    featuresOfInterest: [],
    observedProperties: [],
    historicalLocations: [],
    network: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper to find a siteConfig item root by label
  const getRoot = (label: string) =>
    siteConfig.items.find((i) => i.label === label)?.root || ''

  const buildDatastreamsUrl = () => {
    const dsItem = siteConfig.items.find((i) => i.label === 'Datastreams')
    if (!dsItem) return getRoot('Datastreams')
    const base = dsItem.root || ''
    const nested: string[] = Array.isArray(dsItem.nested) ? dsItem.nested : []
    if (!nested.length) return base
    const expandParam = nested.join(',')
    // Preserve existing query params if present
    return base.includes('?')
      ? `${base}&$expand=${expandParam}`
      : `${base}?$expand=${expandParam}`
  }

  const refetchAll = async () => {
    if (!token || authLoading) return
    setLoading(true)
    setError(null)
    try {
      const datastreamsUrl = buildDatastreamsUrl()

      const [
        locations,
        things,
        sensors,
        datastreams,
        observations,
        featuresOfInterest,
        observedProperties,
        historicalLocations,
        network,
      ] = await Promise.all([
        fetchData(getRoot('Locations'), token).then((d) => d?.value || []),
        fetchData(getRoot('Things'), token).then((d) => d?.value || []),
        fetchData(getRoot('Sensors'), token).then((d) => d?.value || []),
        // Datastreams with $expand (if configured)
        fetchData(datastreamsUrl, token).then((d) => d?.value || []),
        fetchData(getRoot('Observations'), token).then((d) => d?.value || []),
        fetchData(getRoot('FeaturesOfInterest'), token).then(
          (d) => d?.value || []
        ),
        fetchData(getRoot('ObservedProperties'), token).then(
          (d) => d?.value || []
        ),
        fetchData(getRoot('HistoricalLocations'), token).then(
          (d) => d?.value || []
        ),
        fetchData(getRoot('Networks'), token).then((d) => d?.value || []),
      ])

      setEntities({
        locations,
        things,
        sensors,
        datastreams,
        observations,
        featuresOfInterest,
        observedProperties,
        historicalLocations,
        network,
      })
    } catch (err: any) {
      setError('Error during data loading: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading])

  return (
    <EntitiesContext.Provider
      value={{ entities, setEntities, loading, error, refetchAll }}
    >
      {children}
    </EntitiesContext.Provider>
  )
}

export function useEntities() {
  return useContext(EntitiesContext)
}
