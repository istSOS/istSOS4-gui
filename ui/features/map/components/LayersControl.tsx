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
import { Divider } from '@heroui/divider'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon } from '@/components/icons'

export type ToggleItem = { key: string; enabled: boolean; color?: string }

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
  onToggleAll,
  maxVisibleRows = 5,
}: {
  id: string
  title: string
  items: ToggleItem[]
  disabled?: boolean
  showDot?: boolean
  onToggle: (key: string, nextEnabled: boolean) => void
  onToggleAll: (nextEnabled: boolean) => void
  maxVisibleRows?: number
}) {
  const { t } = useTranslation()
  const allEnabled = items.length > 0 && items.every((i) => i.enabled)

  const [expanded, setExpanded] = useState(false)

  const ROW_PX = 28
  const maxBodyHeight = ROW_PX * maxVisibleRows

  const shouldScroll = useMemo(() => {
    return !expanded && items.length > maxVisibleRows
  }, [expanded, items.length, maxVisibleRows])

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="rounded-md border border-default-200 overflow-hidden">
        <div className="px-2 py-1 bg-default-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[10px] font-semibold">
              {title} ({items.length})
            </div>

            {items.length > maxVisibleRows ? (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={expanded ? 'Collapse' : 'Expand'}
                isDisabled={false}
                onPress={() => setExpanded((v) => !v)}
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
            ) : null}
          </div>

          <Checkbox
            size="sm"
            isSelected={allEnabled}
            onValueChange={onToggleAll}
            color="primary"
          />
        </div>

        <div
          id={id}
          className="overflow-x-hidden"
          style={{
            overflowY: shouldScroll ? 'auto' : 'hidden',
            maxHeight: shouldScroll ? maxBodyHeight : undefined,
          }}
        >
          {items.map((it) => (
            <div
              key={it.key}
              className="flex items-center justify-between gap-2 px-2 py-1 border-t border-default-200"
            >
              <div className="min-w-0 flex items-center gap-2">
                {showDot ? <PillPreview color={it.color} /> : null}
                <span className="text-xs truncate">
                  {it.key === UNSPECIFIED_NETWORK_KEY
                    ? t('map.unspecified_network')
                    : it.key}
                </span>
              </div>

              <Checkbox
                size="sm"
                isSelected={it.enabled}
                isDisabled={false}
                onValueChange={(v) => onToggle(it.key, v)}
                color="primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LayersControl({
  title = 'Layers',
  networks,
  observedProps,

  onToggleNetwork,
  onToggleObservedProperty,
  onToggleAllNetworks,
  onToggleAllObservedProps,
}: {
  title?: string
  networks: ToggleItem[]
  observedProps: ToggleItem[]

  networksDisabled?: boolean
  observedPropsDisabled?: boolean

  onToggleNetwork: (key: string, nextEnabled: boolean) => void
  onToggleObservedProperty: (key: string, nextEnabled: boolean) => void

  onToggleAllNetworks: (nextEnabled: boolean) => void
  onToggleAllObservedProps: (nextEnabled: boolean) => void
}) {
  if (!networks.length && !observedProps.length) return null

  return (
    <div className="absolute top-3 right-3 z-[2000]">
      <Card className="w-[320px] overflow-hidden">
        <div className="px-3 py-2 text-xs font-semibold">{title}</div>
        <Divider />

        <div className="px-3 py-2 space-y-4">
          <ScrollTable
            id="networks-table"
            title="Networks"
            items={networks}
            showDot
            onToggle={onToggleNetwork}
            onToggleAll={onToggleAllNetworks}
          />

          <Divider />

          <ScrollTable
            id="observed-table"
            title="Observed properties"
            items={observedProps}
            onToggle={onToggleObservedProperty}
            onToggleAll={onToggleAllObservedProps}
          />
        </div>
      </Card>
    </div>
  )
}
