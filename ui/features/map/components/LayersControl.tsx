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
import { UNSPECIFIED_NETWORK_KEY } from '@/features/map/lib/leafletDraw'
import { Button } from '@heroui/button'
import { Card } from '@heroui/card'
import { Checkbox } from '@heroui/checkbox'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon } from '@/components/icons'

export type ThingLayerItem = {
  key: string
  label: string
  enabled: boolean
}

export type NetworkLayerItem = {
  key: string
  label: string
  enabled: boolean
  things: ThingLayerItem[]
}

export type ObservedPropertyLayerItem = {
  key: string
  label: string
  enabled: boolean
}

export type DataSourceLayerItem = {
  key: string
  label: string
  enabled: boolean
  networks: NetworkLayerItem[]
  observedProperties: ObservedPropertyLayerItem[]
  observedEnabled: boolean
}

function ExpandButton({
  expanded,
  label,
  onPress,
}: {
  expanded: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      onPress={onPress}
      className="h-6 w-6 min-w-6"
    >
      <ChevronDownIcon
        size={16}
        className={
          expanded ? 'rotate-180 transition-transform' : 'transition-transform'
        }
      />
    </Button>
  )
}

function SourceItem({
  source,
  onToggleSource,
  onToggleNetwork,
  onToggleThing,
  onToggleObservedGroup,
  onToggleObservedProperty,
}: {
  source: DataSourceLayerItem
  onToggleSource: (sourceKey: string, nextEnabled: boolean) => void
  onToggleNetwork: (
    sourceKey: string,
    networkKey: string,
    nextEnabled: boolean
  ) => void
  onToggleThing: (
    sourceKey: string,
    networkKey: string,
    thingKey: string,
    nextEnabled: boolean
  ) => void
  onToggleObservedGroup: (sourceKey: string, nextEnabled: boolean) => void
  onToggleObservedProperty: (
    sourceKey: string,
    propertyKey: string,
    nextEnabled: boolean
  ) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [networksExpanded, setNetworksExpanded] = useState(true)
  const [expandedNetworks, setExpandedNetworks] = useState<
    Record<string, boolean>
  >({})
  const [expandedThingsByNetwork, setExpandedThingsByNetwork] = useState<
    Record<string, boolean>
  >({})
  const [observedExpanded, setObservedExpanded] = useState(false)
  const networksEnabled =
    source.networks.length > 0
      ? source.networks.every((network) => network.enabled)
      : false

  return (
    <div className="rounded-md border border-default-200 overflow-hidden">
      <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <ExpandButton
            expanded={expanded}
            label={source.label}
            onPress={() => setExpanded((value) => !value)}
          />
          <span className="min-w-0 truncate text-xs font-semibold">
            {source.label}
          </span>
        </div>

        <Checkbox
          size="sm"
          isSelected={source.enabled}
          onValueChange={(value) => onToggleSource(source.key, value)}
          color="primary"
          aria-label={source.label}
        />
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-default-200 p-2">
          <div className="rounded-md border border-default-200 overflow-hidden">
            <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <ExpandButton
                  expanded={networksExpanded}
                  label={t('map.networks')}
                  onPress={() => setNetworksExpanded((value) => !value)}
                />
                <span className="min-w-0 truncate text-xs font-semibold">
                  {t('map.networks')}
                </span>
              </div>

              <Checkbox
                size="sm"
                isSelected={networksEnabled}
                onValueChange={(value) =>
                  source.networks.forEach((network) =>
                    onToggleNetwork(source.key, network.key, value)
                  )
                }
                color="primary"
              />
            </div>

            {networksExpanded ? (
              <div className="border-t border-default-200 space-y-1 p-1">
                {source.networks.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-default-500">
                    {t('data_sources.empty')}
                  </div>
                ) : (
                  source.networks.map((network) => {
                    const networkTitle =
                      network.key === UNSPECIFIED_NETWORK_KEY
                        ? t('map.unspecified_network')
                        : network.label
                    const networkGroupKey = `${source.key}::${network.key}`
                    const isNetworkExpanded =
                      expandedNetworks[networkGroupKey] ?? false
                    const isThingsExpanded =
                      expandedThingsByNetwork[networkGroupKey] ?? true

                    return (
                      <div
                        key={`${source.key}-${network.key}`}
                        className="rounded-md border border-default-200 overflow-hidden"
                      >
                        <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <ExpandButton
                              expanded={isNetworkExpanded}
                              label={networkTitle}
                              onPress={() =>
                                setExpandedNetworks((prev) => ({
                                  ...prev,
                                  [networkGroupKey]: !isNetworkExpanded,
                                }))
                              }
                            />
                            <span className="min-w-0 truncate text-xs">
                              {networkTitle}
                            </span>
                          </div>

                          <Checkbox
                            size="sm"
                            isSelected={network.enabled}
                            onValueChange={(value) =>
                              onToggleNetwork(source.key, network.key, value)
                            }
                            color="primary"
                            aria-label={networkTitle}
                          />
                        </div>

                        {isNetworkExpanded ? (
                          <div className="border-t border-default-200 space-y-1 p-1">
                            <div className="rounded-md border border-default-200 overflow-hidden">
                              <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  <ExpandButton
                                    expanded={isThingsExpanded}
                                    label={t('map.things')}
                                    onPress={() =>
                                      setExpandedThingsByNetwork((prev) => ({
                                        ...prev,
                                        [networkGroupKey]: !isThingsExpanded,
                                      }))
                                    }
                                  />
                                  <span className="min-w-0 truncate text-xs font-semibold">
                                    {t('map.things')}
                                  </span>
                                </div>

                                <Checkbox
                                  size="sm"
                                  isSelected={network.enabled}
                                  onValueChange={(value) =>
                                    onToggleNetwork(
                                      source.key,
                                      network.key,
                                      value
                                    )
                                  }
                                  color="primary"
                                  aria-label={t('map.things')}
                                />
                              </div>

                              {isThingsExpanded ? (
                                <div className="border-t border-default-200">
                                  {network.things.map((thing, index) => (
                                    <div
                                      key={thing.key}
                                      className={`px-2 py-1 flex items-center justify-between gap-2 ${
                                        index > 0
                                          ? 'border-t border-default-200'
                                          : ''
                                      }`}
                                    >
                                      <span className="min-w-0 truncate text-xs">
                                        {thing.label}
                                      </span>
                                      <Checkbox
                                        size="sm"
                                        isSelected={thing.enabled}
                                        onValueChange={(value) =>
                                          onToggleThing(
                                            source.key,
                                            network.key,
                                            thing.key,
                                            value
                                          )
                                        }
                                        color="primary"
                                        aria-label={thing.label}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-default-200 overflow-hidden">
            <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <ExpandButton
                  expanded={observedExpanded}
                  label={t('map.observed_properties')}
                  onPress={() => setObservedExpanded((value) => !value)}
                />
                <span className="min-w-0 truncate text-xs font-semibold">
                  {t('map.observed_properties')}
                </span>
              </div>

              <Checkbox
                size="sm"
                isSelected={source.observedEnabled}
                onValueChange={(value) =>
                  onToggleObservedGroup(source.key, value)
                }
                color="primary"
                aria-label={t('map.observed_properties')}
              />
            </div>

            {observedExpanded ? (
              <div className="border-t border-default-200">
                {source.observedProperties.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-default-500">
                    {t('data_sources.empty')}
                  </div>
                ) : (
                  source.observedProperties.map((property, index) => (
                    <div
                      key={property.key}
                      className={`px-2 py-1 flex items-center justify-between gap-2 ${
                        index > 0 ? 'border-t border-default-200' : ''
                      }`}
                    >
                      <span className="min-w-0 truncate text-xs">
                        {property.label}
                      </span>
                      <Checkbox
                        size="sm"
                        isSelected={property.enabled}
                        onValueChange={(value) =>
                          onToggleObservedProperty(
                            source.key,
                            property.key,
                            value
                          )
                        }
                        color="primary"
                        aria-label={property.label}
                      />
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function LayersControl({
  title = 'Data sources',
  sources,
  onToggleSource,
  onToggleNetwork,
  onToggleThing,
  onToggleObservedGroup,
  onToggleObservedProperty,
}: {
  title?: string
  sources: DataSourceLayerItem[]
  onToggleSource: (sourceKey: string, nextEnabled: boolean) => void
  onToggleNetwork: (
    sourceKey: string,
    networkKey: string,
    nextEnabled: boolean
  ) => void
  onToggleThing: (
    sourceKey: string,
    networkKey: string,
    thingKey: string,
    nextEnabled: boolean
  ) => void
  onToggleObservedGroup: (sourceKey: string, nextEnabled: boolean) => void
  onToggleObservedProperty: (
    sourceKey: string,
    propertyKey: string,
    nextEnabled: boolean
  ) => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (!sources.length) return null

  return (
    <div className="absolute inset-y-3 right-3 z-[2000] flex max-w-[calc(100vw-1.5rem)] items-start">
      <Card className="max-h-full w-[360px] max-w-full overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-2">
          <ExpandButton
            expanded={expanded}
            label={title}
            onPress={() => setExpanded((value) => !value)}
          />
          <span className="text-xs font-semibold">{title}</span>
        </div>

        {expanded ? (
          <div className="space-y-2 overflow-y-auto px-3 py-2 border-t border-default-200">
            {sources.map((source) => (
              <SourceItem
                key={source.key}
                source={source}
                onToggleSource={onToggleSource}
                onToggleNetwork={onToggleNetwork}
                onToggleThing={onToggleThing}
                onToggleObservedGroup={onToggleObservedGroup}
                onToggleObservedProperty={onToggleObservedProperty}
              />
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
