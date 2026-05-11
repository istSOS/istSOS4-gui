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
import { Card } from '@heroui/card'
import { useState } from 'react'

import { MenuIcon } from '@/components/icons'

import SourceItem from './layers-control/SourceItem'
import { DataSourceLayerItem, SourceItemHandlers } from './layers-control/types'

export type {
  DataSourceLayerItem,
  NetworkLayerItem,
  ObservedPropertyLayerItem,
  ThingLayerItem,
} from './layers-control/types'

type LayersControlProps = {
  title?: string
  sources: DataSourceLayerItem[]
} & SourceItemHandlers

export default function LayersControl({
  title = 'Data sources',
  sources,
  onToggleSource,
  onSourceColorChange,
  onToggleNetwork,
  onToggleThing,
  onToggleObservedGroup,
  onToggleObservedProperty,
}: LayersControlProps) {
  const [expanded, setExpanded] = useState(true)

  if (!sources.length) return null

  return (
    <div className="absolute right-3 top-3 bottom-40 z-[2200] flex max-w-[calc(100vw-1.5rem)] items-start">
      <Card
        className={`max-h-full max-w-full overflow-hidden ring-2 ring-[var(--color-primary)] ${
          expanded ? 'w-[360px]' : 'w-auto'
        }`}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onPress={() => setExpanded((value) => !value)}
            className="h-6 w-6 min-w-6"
          >
            <span className="sr-only">{title}</span>
            <MenuIcon size={24} />
          </Button>
          {expanded ? (
            <span className="text-xs font-semibold">{title}</span>
          ) : null}
        </div>

        {expanded ? (
          <div className="space-y-2 overflow-y-auto px-3 py-2 border-t border-default-200">
            {sources.map((source) => (
              <SourceItem
                key={source.key}
                source={source}
                onToggleSource={onToggleSource}
                onSourceColorChange={onSourceColorChange}
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
