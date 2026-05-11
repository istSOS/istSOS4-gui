import { DataSourceLayerItem } from '../components/layers-control/types'
import { Thing } from '@/types/domain'
import {
  ObservedToggleItem,
  getThingKey,
  getThingSourceKey,
  getThingSourceLabel,
  parseObservedPropertyKey,
} from './leafletMapHelpers'
import { UNSPECIFIED_NETWORK_KEY, networkKey } from './leafletDraw'

export function buildLayerControlSources({
  things,
  thingEnabled,
  observedPropsMeta,
  resolvedSourceColorByKey,
  unspecifiedNetworkLabel,
}: {
  things: Thing[]
  thingEnabled: Record<string, boolean>
  observedPropsMeta: ObservedToggleItem[]
  resolvedSourceColorByKey: Map<string, string>
  unspecifiedNetworkLabel: string
}) {
  const sourceLabelByKey = things.reduce<Map<string, string>>((acc, thing) => {
    acc.set(getThingSourceKey(thing), getThingSourceLabel(thing))
    return acc
  }, new Map())

  const dataSourcesForUI = Array.from(
    things.reduce<
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
          ? unspecifiedNetworkLabel
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

  return Array.from(dataSourcesByKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  )
}
