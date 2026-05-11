import { useEffect, useState } from 'react'
import { EntityRef, Thing } from '@/types/domain'

import { getAllDataSourceTokens } from '@/lib/dataSourceTokens'

import {
  enrichEntitiesWithSourceMetadata,
  enrichThingsWithSourceMetadata,
} from './metadata'
import { mapThingsApiPath } from './utils'

export function useDataSourcesSync({
  things,
  sensors,
  observedProperties,
  networks,
  primaryEndpoint,
  primarySourceName,
  refreshKey,
}: {
  things: Thing[]
  sensors: EntityRef[]
  observedProperties: EntityRef[]
  networks: EntityRef[]
  primaryEndpoint: string
  primarySourceName: string
  refreshKey?: unknown
}) {
  const [localThings, setLocalThings] = useState<Thing[]>(() =>
    enrichThingsWithSourceMetadata({
      items: things,
      primaryEndpoint,
      primarySourceName,
    })
  )
  const [localSensors, setLocalSensors] = useState<EntityRef[]>(() =>
    enrichEntitiesWithSourceMetadata({
      items: sensors,
      primaryEndpoint,
      primarySourceName,
    })
  )
  const [localObservedProperties, setLocalObservedProperties] = useState<
    EntityRef[]
  >(
    () =>
      enrichEntitiesWithSourceMetadata({
        items: observedProperties,
        primaryEndpoint,
        primarySourceName,
      })
  )
  const [localNetworks, setLocalNetworks] = useState<EntityRef[]>(() =>
    enrichEntitiesWithSourceMetadata({
      items: networks,
      primaryEndpoint,
      primarySourceName,
    })
  )

  useEffect(() => {
    setLocalThings(
      enrichThingsWithSourceMetadata({
        items: things,
        primaryEndpoint,
        primarySourceName,
      })
    )
    setLocalSensors(
      enrichEntitiesWithSourceMetadata({
        items: sensors,
        primaryEndpoint,
        primarySourceName,
      })
    )
    setLocalObservedProperties(
      enrichEntitiesWithSourceMetadata({
        items: observedProperties,
        primaryEndpoint,
        primarySourceName,
      })
    )
    setLocalNetworks(
      enrichEntitiesWithSourceMetadata({
        items: networks,
        primaryEndpoint,
        primarySourceName,
      })
    )
  }, [
    things,
    sensors,
    observedProperties,
    networks,
    primaryEndpoint,
    primarySourceName,
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

        const payload = data as {
          things: Thing[]
          sensors?: EntityRef[]
          observedProperties?: EntityRef[]
          networks?: EntityRef[]
        }

        setLocalThings(
          enrichThingsWithSourceMetadata({
            items: payload.things,
            primaryEndpoint,
            primarySourceName,
          })
        )
        if (Array.isArray(payload?.sensors)) {
          setLocalSensors(
            enrichEntitiesWithSourceMetadata({
              items: payload.sensors,
              primaryEndpoint,
              primarySourceName,
            })
          )
        }
        if (Array.isArray(payload?.observedProperties)) {
          setLocalObservedProperties(
            enrichEntitiesWithSourceMetadata({
              items: payload.observedProperties,
              primaryEndpoint,
              primarySourceName,
            })
          )
        }
        if (Array.isArray(payload?.networks)) {
          setLocalNetworks(
            enrichEntitiesWithSourceMetadata({
              items: payload.networks,
              primaryEndpoint,
              primarySourceName,
            })
          )
        }
      } catch {}
    })()

    return () => {
      mounted = false
    }
  }, [refreshKey, things, primaryEndpoint, primarySourceName])

  return {
    localThings,
    localSensors,
    localObservedProperties,
    localNetworks,
  }
}
