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
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon, SearchIcon } from '@/components/icons'

import SourceItem from './layers-control/SourceItem'
import { DataSourceLayerItem, SourceItemHandlers } from './layers-control/types'

export type {
  DataSourceLayerItem,
  NetworkLayerItem,
  ObservedPropertyLayerItem,
  ThingLayerItem,
} from './layers-control/types'

type LayersControlProps = {
  sources: DataSourceLayerItem[]
} & SourceItemHandlers

export default function LayersControl({
  sources,
  onToggleSource,
  onSourceColorChange,
  onToggleNetwork,
  onToggleThing,
}: LayersControlProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const activeCount = sources.filter((source) => source.enabled).length
  const query = sources.length > 5 ? search.trim().toLocaleLowerCase() : ''
  const filteredSources = sources.filter((source) =>
    source.label.toLocaleLowerCase().includes(query)
  )

  if (!sources.length) return null

  return (
    <div className="pointer-events-auto ml-auto shrink-0">
      <Popover placement="bottom-end" offset={8}>
        <PopoverTrigger>
          <Button
            size="sm"
            variant="bordered"
            className="h-8 gap-2 rounded-small border-default-200 bg-content1 px-2 text-small text-default-500 shadow-md data-[hover=true]:border-default-400 data-[hover=true]:opacity-100 data-[focus-visible=true]:border-default-foreground aria-expanded:border-default-foreground"
            aria-label={t('map.sources_summary', {
              active: activeCount,
              total: sources.length,
            })}
            endContent={<ChevronDownIcon size={14} />}
          >
            <span>{t('map.sources')}</span>
            <span
              className="text-xs tabular-nums text-default-500"
              aria-hidden="true"
            >
              {activeCount}/{sources.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={t('map.sources')}
          className="w-80 max-w-[calc(100vw-1.5rem)] items-stretch overflow-hidden p-0"
        >
          <div className="border-b border-default-100 px-3 py-2.5">
            <h2 className="text-xs font-semibold">{t('map.sources')}</h2>
            {sources.length > 5 && (
              <Input
                size="sm"
                variant="bordered"
                className="mt-2"
                aria-label={t('map.source_search')}
                placeholder={t('map.source_search')}
                startContent={<SearchIcon size={16} />}
                value={search}
                onValueChange={setSearch}
                isClearable
                onClear={() => setSearch('')}
              />
            )}
          </div>
          <ul className="max-h-[min(60vh,28rem)] divide-y divide-default-100 overflow-y-auto py-1">
            {filteredSources.map((source) => (
              <SourceItem
                key={source.key}
                source={source}
                onToggleSource={onToggleSource}
                onSourceColorChange={onSourceColorChange}
                onToggleNetwork={onToggleNetwork}
                onToggleThing={onToggleThing}
              />
            ))}
          </ul>
          {filteredSources.length === 0 && (
            <p className="px-3 py-4 text-xs text-default-500">
              {t('map.source_no_results')}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
