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

const NETWORK_VISIBLE_THINGS = 3
const NETWORK_SECTION_MAX_BODY_HEIGHT = 240
const OBSERVED_SECTION_MAX_BODY_HEIGHT = 176

export type ToggleItem = {
  key: string
  label?: string
  enabled: boolean
  color?: string
  details?: Array<{
    key: string
    label: string
    enabled: boolean
  }>
}

function PillPreview({ color }: { color?: string }) {
  if (!color) return null
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{ background: color }}
    />
  )
}

function ScrollTable({
  id,
  title,
  items,
  disabled,
  showDot,
  onToggle,
  onToggleDetail,
  onToggleAll,
  bodyMaxHeight,
}: {
  id: string
  title: string
  items: ToggleItem[]
  disabled?: boolean
  showDot?: boolean
  onToggle: (key: string, nextEnabled: boolean) => void
  onToggleDetail?: (
    groupKey: string,
    detailKey: string,
    nextEnabled: boolean
  ) => void
  onToggleAll: (nextEnabled: boolean) => void
  bodyMaxHeight?: number
}) {
  const { t } = useTranslation()
  const allEnabled = items.length > 0 && items.every((i) => i.enabled)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="rounded-md border border-default-200 overflow-hidden">
        <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
              onPress={() => setExpanded((value) => !value)}
              className="h-6 w-6 min-w-6"
            >
              <ChevronDownIcon
                size={16}
                className={
                  expanded
                    ? 'rotate-180 transition-transform'
                    : 'transition-transform'
                }
              />
            </Button>

            <div className="min-w-0 text-[10px] font-semibold">
              {title} ({items.length})
            </div>
          </div>

          <Checkbox
            size="sm"
            isSelected={allEnabled}
            onValueChange={onToggleAll}
            color="primary"
            aria-label={`${title} all`}
          />
        </div>

        {expanded ? (
          <div
            id={id}
            className="overflow-x-hidden overflow-y-auto"
            style={{
              maxHeight: bodyMaxHeight,
            }}
          >
            {items.map((it) => (
              <div
                key={it.key}
                className="flex items-start justify-between gap-2 border-t border-default-200 px-2 py-1"
              >
                <div className="min-w-0 flex-1">
                  {showDot ? (
                    <NetworkGroup
                      item={it}
                      onToggle={onToggle}
                      onToggleDetail={onToggleDetail}
                    />
                  ) : (
                    <div className="text-xs truncate">
                      {(it.label ?? it.key) === UNSPECIFIED_NETWORK_KEY
                        ? t('map.unspecified_network')
                        : it.label ?? it.key}
                    </div>
                  )}
                </div>

                {!showDot ? (
                  <Checkbox
                    size="sm"
                    isSelected={it.enabled}
                    isDisabled={false}
                    onValueChange={(v) => onToggle(it.key, v)}
                    color="primary"
                    aria-label={
                      (it.label ?? it.key) === UNSPECIFIED_NETWORK_KEY
                        ? t('map.unspecified_network')
                        : it.label ?? it.key
                    }
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function NetworkGroup({
  item,
  onToggle,
  onToggleDetail,
}: {
  item: ToggleItem
  onToggle: (key: string, nextEnabled: boolean) => void
  onToggleDetail?: (
    groupKey: string,
    detailKey: string,
    nextEnabled: boolean
  ) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const details = item.details ?? []
  const title =
    item.key === UNSPECIFIED_NETWORK_KEY
      ? t('map.unspecified_network')
      : item.key
  const shouldScrollThings = details.length > NETWORK_VISIBLE_THINGS

  return (
    <div className="rounded-md border border-default-200 overflow-hidden">
      <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onPress={() => setExpanded((value) => !value)}
            className="h-6 w-6 min-w-6"
          >
            <ChevronDownIcon
              size={16}
              className={
                expanded
                  ? 'rotate-180 transition-transform'
                  : 'transition-transform'
              }
            />
          </Button>

          <PillPreview color={item.color} />

          <span className="min-w-0 truncate text-[10px] font-semibold">
            {title} - {t('map.things_count', { count: details.length })}
          </span>
        </div>

        <Checkbox
          size="sm"
          isSelected={item.enabled}
          onValueChange={(value) => onToggle(item.key, value)}
          color="primary"
          aria-label={title}
        />
      </div>

      {expanded ? (
        <div
          className="overflow-x-hidden"
          style={{
            maxHeight: shouldScrollThings
              ? NETWORK_VISIBLE_THINGS * 29
              : undefined,
            overflowY: shouldScrollThings ? 'auto' : 'hidden',
          }}
        >
          {details.map((detail, index) => (
            <div
              key={detail.key}
              className={`flex items-center justify-between gap-2 px-2 py-1 ${
                index > 0 ? 'border-t border-default-200' : ''
              }`}
            >
              <span className="min-w-0 truncate text-xs">{detail.label}</span>
              <Checkbox
                size="sm"
                isSelected={detail.enabled}
                onValueChange={(value) =>
                  onToggleDetail?.(item.key, detail.key, value)
                }
                color="primary"
                aria-label={detail.label}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function LayersControl({
  title = 'Layers',
  networks,
  observedProps,
  networksTitle = 'Networks',
  networksGrouped = true,

  onToggleNetwork,
  onToggleNetworkThing,
  onToggleObservedProperty,
  onToggleAllNetworks,
  onToggleAllObservedProps,
}: {
  title?: string
  networks: ToggleItem[]
  observedProps: ToggleItem[]
  networksTitle?: string
  networksGrouped?: boolean

  networksDisabled?: boolean
  observedPropsDisabled?: boolean

  onToggleNetwork: (key: string, nextEnabled: boolean) => void
  onToggleNetworkThing: (
    networkKey: string,
    thingKey: string,
    nextEnabled: boolean
  ) => void
  onToggleObservedProperty: (key: string, nextEnabled: boolean) => void

  onToggleAllNetworks: (nextEnabled: boolean) => void
  onToggleAllObservedProps: (nextEnabled: boolean) => void
}) {
  if (!networks.length && !observedProps.length) return null

  return (
    <div className="absolute inset-y-3 right-3 z-[2000] flex max-w-[calc(100vw-1.5rem)] items-start">
      <Card className="max-h-full w-[320px] max-w-full overflow-hidden">
        <div className="px-3 py-2 text-xs font-semibold">{title}</div>

        <div className="space-y-4 px-3 py-2">
          {networks.length ? (
            <ScrollTable
              id="networks-table"
              title={networksTitle}
              items={networks}
              showDot={networksGrouped}
              bodyMaxHeight={NETWORK_SECTION_MAX_BODY_HEIGHT}
              onToggle={onToggleNetwork}
              onToggleDetail={networksGrouped ? onToggleNetworkThing : undefined}
              onToggleAll={onToggleAllNetworks}
            />
          ) : null}

          {observedProps.length ? (
            <ScrollTable
              id="observed-table"
              title="Observed properties"
              items={observedProps}
              bodyMaxHeight={OBSERVED_SECTION_MAX_BODY_HEIGHT}
              onToggle={onToggleObservedProperty}
              onToggleAll={onToggleAllObservedProps}
            />
          ) : null}
        </div>
      </Card>
    </div>
  )
}
