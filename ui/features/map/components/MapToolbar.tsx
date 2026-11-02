'use client'

import type { FormTabKey } from '@/features/forms/components/wizard/types'
import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown'
import { Tooltip } from '@heroui/tooltip'
import { useTranslation } from 'react-i18next'

import {
  ClearSelectionIcon,
  CrosshairIcon,
  ImportFileIcon,
  LocationIcon,
  PlusIcon,
  ResetFiltersIcon,
} from '@/components/icons'

import { useAuth } from '@/context/AuthContext'

// Keep Firefox from restoring a stale disabled state before hydration.
const sessionProps = { autoComplete: 'off' }

export default function MapToolbar({
  onCreate,
  onImport,
  onReset,
  onFitExtent,
  extentAvailable,
  filtersActive,
  onClearSelection,
  selectionActive = false,
  isSnapshot,
}: {
  onCreate?: (entity: FormTabKey) => void
  onImport: () => void
  onReset: () => void
  onFitExtent: () => void
  extentAvailable: boolean
  onClearSelection?: () => void
  selectionActive?: boolean
  filtersActive: boolean
  isSnapshot: boolean
}) {
  const { t } = useTranslation()
  const { canWrite } = useAuth()
  const locked = isSnapshot || !canWrite
  return (
    <div
      role="toolbar"
      aria-label={t('map.actions')}
      aria-orientation="vertical"
      className="pointer-events-auto flex w-8 flex-col items-center gap-1 rounded-small border border-default-200 bg-content1 p-1 shadow-md"
    >
      <Tooltip
        placement="left"
        content={
          locked
            ? t(isSnapshot ? 'as_of.table.read_only' : 'general.read_only')
            : t('map.add_entity')
        }
      >
        <span>
          <Dropdown
            placement="left-start"
            classNames={{
              content:
                'w-[180px] min-w-0 rounded-xl bg-white/95 px-0 py-2 shadow-xl',
            }}
          >
            <DropdownTrigger>
              <Button
                {...sessionProps}
                isIconOnly
                size="sm"
                variant="light"
                className="h-6 w-6 min-w-6"
                aria-label={t('map.add_entity')}
                isDisabled={locked || !onCreate}
              >
                <PlusIcon size={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={t('map.add_entity')}
              className="p-0"
              itemClasses={{
                base: 'gap-3 rounded-md px-3 py-1.5 data-[hover=true]:bg-black/5',
                title: 'text-[15px] text-default-700',
              }}
            >
              <DropdownItem
                key="new"
                startContent={<LocationIcon className="text-default-800" />}
                onPress={() => onCreate?.('thing')}
              >
                {t('general.new')}
              </DropdownItem>
              <DropdownItem
                key="import"
                startContent={<ImportFileIcon className="text-default-800" />}
                onPress={onImport}
              >
                {t('import.actions.import_from_file')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </span>
      </Tooltip>
      <Tooltip placement="left" content={t('map.fit_extent')}>
        <span>
          <Button
            {...sessionProps}
            isIconOnly
            size="sm"
            variant="light"
            className="h-6 w-6 min-w-6"
            aria-label={t('map.fit_extent')}
            isDisabled={!extentAvailable}
            onPress={onFitExtent}
          >
            <CrosshairIcon size={18} fill="currentColor" />
          </Button>
        </span>
      </Tooltip>
      <Tooltip placement="left" content={t('map.reset_filters')}>
        <span>
          <Button
            {...sessionProps}
            isIconOnly
            size="sm"
            variant="light"
            className="h-6 w-6 min-w-6"
            aria-label={t('map.reset_filters')}
            isDisabled={!filtersActive}
            onPress={onReset}
          >
            <ResetFiltersIcon size={18} />
          </Button>
        </span>
      </Tooltip>
      {onClearSelection && (
        <Tooltip placement="left" content={t('map.clear_selection')}>
          <span>
            <Button
              {...sessionProps}
              isIconOnly
              size="sm"
              variant="light"
              className="h-6 w-6 min-w-6"
              aria-label={t('map.clear_selection')}
              isDisabled={!selectionActive}
              onPress={onClearSelection}
            >
              <ClearSelectionIcon size={18} />
            </Button>
          </span>
        </Tooltip>
      )}
    </div>
  )
}
