'use client'

import { UNSPECIFIED_NETWORK_KEY } from '@/features/map/lib/leafletDraw'
import { Checkbox } from '@heroui/checkbox'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'

import ExpandButton from './ExpandButton'
import { DataSourceLayerItem, SourceItemHandlers } from './types'

type SourceItemProps = {
  source: DataSourceLayerItem
} & SourceItemHandlers

export default function SourceItem({
  source,
  onToggleSource,
  onSourceColorChange,
  onToggleNetwork,
  onToggleThing,
  onToggleObservedGroup,
  onToggleObservedProperty,
}: SourceItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement | null>(null)
  const colorButtonRef = useRef<HTMLButtonElement | null>(null)
  const [pickerPosition, setPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)
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
  const sourceColor = source.color ?? '#2563eb'

  useEffect(() => {
    if (!colorPickerOpen) return

    const updatePickerPosition = () => {
      const button = colorButtonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      setPickerPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 200),
      })
    }

    updatePickerPosition()

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (colorPickerRef.current?.contains(target)) return
      if (colorButtonRef.current?.contains(target)) return
      setColorPickerOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorPickerOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePickerPosition)
    window.addEventListener('scroll', updatePickerPosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePickerPosition)
      window.removeEventListener('scroll', updatePickerPosition, true)
    }
  }, [colorPickerOpen])

  return (
    <div className="rounded-md border border-default-200">
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

        <div className="relative flex items-center gap-1" ref={colorPickerRef}>
          <button
            ref={colorButtonRef}
            type="button"
            aria-label={`${source.label} color`}
            onClick={() => setColorPickerOpen((value) => !value)}
            className="h-4 w-4 rounded-sm border border-default-300 cursor-pointer"
            style={{ backgroundColor: sourceColor }}
          />

          {colorPickerOpen &&
          pickerPosition &&
          typeof document !== 'undefined'
            ? createPortal(
                <div
                  ref={colorPickerRef}
                  className="fixed z-[7000] rounded-md border border-default-200 bg-content1 p-2 shadow-lg"
                  style={{
                    top: pickerPosition.top,
                    left: pickerPosition.left,
                  }}
                >
                  <HexColorPicker
                    color={sourceColor}
                    onChange={(color) => onSourceColorChange(source.key, color)}
                  />
                </div>,
                document.body
              )
            : null}

          <Checkbox
            size="sm"
            isSelected={source.enabled}
            onValueChange={(value) => onToggleSource(source.key, value)}
            color="primary"
            aria-label={source.label}
          />
        </div>
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
