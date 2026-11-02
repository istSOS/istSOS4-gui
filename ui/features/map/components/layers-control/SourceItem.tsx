'use client'

import { UNSPECIFIED_NETWORK_KEY } from '@/features/map/lib/leafletDraw'
import { Checkbox } from '@heroui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { Switch } from '@heroui/switch'
import { useId, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon } from '@/components/icons'

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
}: SourceItemProps) {
  const { t } = useTranslation()
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  const [expandedNetworks, setExpandedNetworks] = useState<
    Record<string, boolean>
  >({})
  const sourceColor = source.color ?? '#2563eb'
  const partlyVisible =
    source.enabled &&
    source.networks.some((network) =>
      network.things.some((thing) => !thing.enabled)
    )

  return (
    <li>
      <div className="flex items-center gap-2 px-3 py-1">
        <Popover placement="bottom-start" offset={6}>
          <PopoverTrigger>
            <button
              type="button"
              aria-label={t('map.source_color', { source: source.label })}
              title={t('map.source_color', { source: source.label })}
              className="flex h-7 w-5 shrink-0 items-center justify-center rounded-md hover:bg-default-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: sourceColor }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-2"
            aria-label={t('map.source_color', { source: source.label })}
          >
            <HexColorPicker
              color={sourceColor}
              onChange={(color) => onSourceColorChange(source.key, color)}
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left text-xs hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          title={source.label}
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {source.label}
          </span>
          <ChevronDownIcon
            size={14}
            className={`shrink-0 text-default-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        <Switch
          size="sm"
          classNames={{ base: 'shrink-0 p-0', wrapper: 'mr-0' }}
          isSelected={source.enabled}
          onValueChange={(value) => onToggleSource(source.key, value)}
          aria-labelledby={`${detailsId}-visibility`}
        />
        <span id={`${detailsId}-visibility`} className="sr-only">
          {t('map.source_visibility', { source: source.label })}
          {partlyVisible ? ` · ${t('map.source_partial')}` : ''}
        </span>
      </div>
      {expanded && (
        <div id={detailsId} className="pb-2 pl-10 pr-3">
          <p className="py-1 text-[11px] font-medium text-default-500">
            {t('map.networks')}
          </p>
          {source.networks.length === 0 && (
            <p className="py-2 text-xs text-default-500">
              {t('data_sources.empty')}
            </p>
          )}
          {source.networks.map((network, index) => {
            const networkTitle =
              network.key === UNSPECIFIED_NETWORK_KEY
                ? t('map.unspecified_network')
                : network.label
            const networkExpanded = expandedNetworks[network.key] ?? false
            const networkId = `${detailsId}-network-${index}`
            return (
              <div key={network.key}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-2 text-left text-xs hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-expanded={networkExpanded}
                    aria-controls={networkId}
                    onClick={() =>
                      setExpandedNetworks((prev) => ({
                        ...prev,
                        [network.key]: !networkExpanded,
                      }))
                    }
                  >
                    <ChevronDownIcon
                      size={12}
                      className={`shrink-0 text-default-400 transition-transform ${networkExpanded ? 'rotate-180' : ''}`}
                    />
                    <span className="truncate">{networkTitle}</span>
                  </button>
                  <Checkbox
                    size="sm"
                    className="m-0 p-0"
                    isSelected={network.enabled}
                    isIndeterminate={
                      !network.enabled &&
                      network.things.some((thing) => thing.enabled)
                    }
                    onValueChange={(value) =>
                      onToggleNetwork(source.key, network.key, value)
                    }
                    aria-label={networkTitle}
                  />
                </div>
                {networkExpanded && (
                  <div
                    id={networkId}
                    role="group"
                    aria-label={t('map.things')}
                    className="ml-1.5 border-l border-default-200 pl-3"
                  >
                    {network.things.map((thing) => (
                      <Checkbox
                        key={thing.key}
                        size="sm"
                        classNames={{
                          base: 'm-0 flex w-full max-w-full flex-row-reverse justify-between gap-2 px-0 py-1.5',
                          wrapper: 'mr-0',
                          label: 'min-w-0 truncate text-xs',
                        }}
                        isSelected={thing.enabled}
                        onValueChange={(value) =>
                          onToggleThing(
                            source.key,
                            network.key,
                            thing.key,
                            value
                          )
                        }
                        title={thing.label}
                      >
                        {thing.label}
                      </Checkbox>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}
