'use client'

import { Button } from '@heroui/button'
import { Checkbox } from '@heroui/checkbox'
import { Input } from '@heroui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon, SearchIcon } from '@/components/icons'

export type MapChecklistGroup = {
  key: string
  label: string
  color?: string
  muted?: boolean
  items: Array<{
    key: string
    label: string
    selected: boolean
    unavailable?: boolean
  }>
}

export default function MapChecklistFilter({
  groups,
  search,
  onSearchChange,
  name,
  allLabel,
  noneLabel,
  searchLabel,
  emptyLabel,
  selectedCount,
  total,
  allSelected: allSelectedOverride,
  onToggle,
  onToggleAll,
  onToggleResults,
  onItemSelect,
  activeKey,
}: {
  groups: MapChecklistGroup[]
  search: string
  onSearchChange: (value: string) => void
  name: string
  allLabel: string
  noneLabel: string
  searchLabel: string
  emptyLabel: string
  selectedCount: number
  total: number
  allSelected?: boolean
  onToggle: (key: string, selected: boolean) => void
  onToggleAll: (selected: boolean) => void
  onToggleResults: (keys: string[], selected: boolean) => void
  onItemSelect: (key: string) => void
  activeKey?: string
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const allSelected =
    allSelectedOverride ?? (total > 0 && selectedCount === total)
  const summary = t('map.selection_summary', { selected: selectedCount, total })
  const results = groups.flatMap((group) => group.items)
  const selectedResults = results.filter((item) => item.selected).length

  return (
    <div className="pointer-events-auto min-w-[min(100%,14rem)] max-w-xs flex-1">
      <Popover
        placement="bottom-start"
        offset={5}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
        <PopoverTrigger>
          <Button
            size="sm"
            variant="bordered"
            className="h-8 w-full justify-start gap-2 rounded-small border-default-200 bg-content1 px-2 text-small text-default-500 shadow-md data-[hover=true]:border-default-400 data-[hover=true]:opacity-100 data-[focus-visible=true]:border-default-foreground aria-expanded:border-default-foreground"
            aria-label={`${name}: ${summary}`}
            startContent={<SearchIcon size={16} />}
            endContent={<ChevronDownIcon size={14} />}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {allSelected ? allLabel : selectedCount ? name : noneLabel}
            </span>
            <span className="text-xs tabular-nums" aria-hidden="true">
              {selectedCount}/{total}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={name}
          className="w-80 max-w-[calc(100vw-1.5rem)] items-stretch overflow-hidden p-0"
        >
          <div className="border-b border-default-100 p-2">
            <Input
              autoFocus
              aria-label={searchLabel}
              placeholder={searchLabel}
              size="sm"
              variant="bordered"
              startContent={<SearchIcon size={16} />}
              value={search}
              onValueChange={onSearchChange}
              isClearable
              onClear={() => onSearchChange('')}
            />
            {search.trim() && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                <span
                  role="status"
                  aria-live="polite"
                  className="px-1 text-[11px] text-default-500"
                >
                  {t('map.search_results_count', { count: results.length })}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 min-w-0 px-1.5 text-xs"
                    isDisabled={selectedResults === results.length}
                    onPress={() =>
                      onToggleResults(
                        results.map((item) => item.key),
                        true
                      )
                    }
                  >
                    {t('map.select_results')}
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 min-w-0 px-1.5 text-xs"
                    isDisabled={selectedResults === 0}
                    onPress={() =>
                      onToggleResults(
                        results.map((item) => item.key),
                        false
                      )
                    }
                  >
                    {t('map.deselect_results')}
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <Checkbox
                size="sm"
                className="m-0 p-0"
                classNames={{ label: 'text-xs' }}
                isSelected={allSelected}
                isIndeterminate={selectedCount > 0 && !allSelected}
                onValueChange={onToggleAll}
              >
                {allLabel}
              </Checkbox>
              <span
                role="status"
                aria-live="polite"
                className="text-[11px] text-default-500"
              >
                {summary}
              </span>
            </div>
          </div>
          <ul className="max-h-[min(50vh,24rem)] overflow-y-auto px-2 pb-2">
            {groups.map((group) => (
              <li
                key={group.key}
                className={group.muted ? 'opacity-60' : undefined}
              >
                <div className="flex items-center gap-1.5 px-1 pb-1 pt-2 text-[11px] font-medium text-default-500">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="truncate">{group.label}</span>
                </div>
                <ul>
                  {group.items.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center rounded-md hover:bg-default-100"
                    >
                      <Checkbox
                        size="sm"
                        classNames={{
                          base: 'm-0 shrink-0 px-1 py-1.5',
                        }}
                        aria-label={`${item.label} · ${group.label}`}
                        title={`${item.label} · ${group.label}${item.unavailable ? ` · ${t('map.filter_unavailable')}` : ''}`}
                        isSelected={item.selected}
                        onValueChange={(selected) =>
                          onToggle(item.key, selected)
                        }
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md px-1 py-1.5 text-left text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                        aria-pressed={activeKey === item.key}
                        title={`${item.label} · ${group.label}`}
                        onClick={() => {
                          onItemSelect(item.key)
                          setIsOpen(false)
                        }}
                      >
                        <span
                          className={`block truncate ${item.unavailable ? 'text-warning-600' : ''}`}
                        >
                          {item.label}
                          {item.unavailable && (
                            <span className="ml-1 text-[10px]">
                              ({t('map.filter_unavailable_short')})
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {groups.length === 0 && (
              <li role="status" className="px-1 py-3 text-xs text-default-500">
                {emptyLabel}
              </li>
            )}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
