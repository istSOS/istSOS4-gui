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
import {
  UNSPECIFIED_NETWORK_KEY,
  networkKey,
} from '@/features/map/lib/leafletDraw'
import { Button } from '@heroui/button'
import { Card } from '@heroui/card'
import { Chip } from '@heroui/chip'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import { Tooltip } from '@heroui/tooltip'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ChartIcon,
  ChevronDownIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  ImportFileIcon,
  LocationIcon,
} from '@/components/icons'
import TableComponent from '@/components/table/Table'
import ImportFromFileButton from '@/features/datastreams/components/ImportFromFileButton'
import { Datastream, Thing } from '@/types/domain'

dayjs.extend(duration)
dayjs.extend(utc)
dayjs.extend(relativeTime)

function formatUtcDateTime(value?: string) {
  if (!value) return ''
  const d = dayjs.utc(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : ''
}

function parsePhenomenonTime(phenomenonTime?: string | null) {
  if (!phenomenonTime) {
    return {
      startRaw: undefined as string | undefined,
      endRaw: undefined as string | undefined,
      start: '',
      end: '',
    }
  }

  const [startRaw, endRaw] = phenomenonTime.split('/')
  return {
    startRaw,
    endRaw,
    start: formatUtcDateTime(startRaw),
    end: formatUtcDateTime(endRaw),
  }
}

function isoDurationToMs(iso?: string) {
  if (!iso) return 0
  const ms = dayjs.duration(iso).asMilliseconds()
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

function isFresh(endRaw?: string, acquisitionIso?: string) {
  const endMs = endRaw ? dayjs.utc(endRaw).valueOf() : NaN
  if (!Number.isFinite(endMs)) return false

  const thresholdMs = isoDurationToMs(acquisitionIso) * 2
  if (thresholdMs <= 0) return false

  return Date.now() - endMs < thresholdMs
}

function ageMs(endRaw?: string) {
  const endMs = endRaw ? dayjs.utc(endRaw).valueOf() : NaN
  return Number.isFinite(endMs) ? Date.now() - endMs : NaN
}

function ageLabel(endRaw?: string) {
  if (!endRaw) return ''
  const d = dayjs.utc(endRaw)
  return d.isValid() ? d.fromNow() : ''
}

type Props = {
  thing: Thing | null
  observedPropertyNameFilter?: string | null
  onClose: () => void
  onCreateDatastream?: () => void
  onOpenDetails?: (datastream: Datastream) => void
  onEditDatastream?: (datastream: Datastream) => void
  onDeleteDatastream?: (datastream: Datastream) => void
}

type DatastreamColumnKey =
  | 'name'
  | 'observedProperty'
  | 'unitOfMeasurement'
  | 'last'
  | 'lastValue'
  | 'startDate'
  | 'endDate'
  | 'actions'

type DeletePreview = {
  network: string
  thing: string
  location: string
  sensor: string
  observedProperty: string
  datastream: string
  observationsCount: number
}

export default function DatastreamTable({
  thing,
  observedPropertyNameFilter = null,
  onClose,
  onCreateDatastream,
  onOpenDetails,
  onEditDatastream,
  onDeleteDatastream,
}: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language
  const [pendingDelete, setPendingDelete] = useState<Datastream | null>(null)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)

  const datastreams: Datastream[] = useMemo(() => {
    const ds = thing?.Datastreams
    const all = Array.isArray(ds) ? ds : []
    const filterName = String(observedPropertyNameFilter ?? '').trim().toLowerCase()
    if (!filterName) return all
    return all.filter((entry) =>
      String(entry?.ObservedProperty?.name ?? '')
        .trim()
        .toLowerCase()
        .includes(filterName)
    )
  }, [thing, observedPropertyNameFilter])

  const thingName = String(thing?.name ?? '')
  const networkName = networkKey(thing?.Datastreams?.[0]?.Network?.name)
  const networkLabel =
    networkName === UNSPECIFIED_NETWORK_KEY
      ? t('map.unspecified_network')
      : networkName

  const columns: Array<{
    name: string
    uid: DatastreamColumnKey
    sortable: boolean
    align: 'start' | 'center'
  }> = useMemo(
    () => [
      {
        name: t('datastreams.name'),
        uid: 'name',
        sortable: true,
        align: 'start',
      },
      {
        name: t('datastreams.observed_property'),
        uid: 'observedProperty',
        sortable: true,
        align: 'start',
      },
      {
        name: t('datastreams.unit_of_measurement'),
        uid: 'unitOfMeasurement',
        sortable: true,
        align: 'center',
      },
      { name: t('general.last'), uid: 'last', sortable: true, align: 'start' },
      {
        name: t('general.last_value'),
        uid: 'lastValue',
        sortable: false,
        align: 'center',
      },
      {
        name: t('general.start_date'),
        uid: 'startDate',
        sortable: true,
        align: 'center',
      },
      {
        name: t('general.end_date'),
        uid: 'endDate',
        sortable: true,
        align: 'center',
      },
      {
        name: t('general.actions'),
        uid: 'actions',
        sortable: false,
        align: 'center',
      },
    ],
    [lang]
  )

  const searchPredicate = useCallback((item: Datastream, query: string) => {
    const q = query.toLowerCase()
    return String(item?.name ?? '')
      .toLowerCase()
      .includes(q)
  }, [])

  const getSortValue = useCallback(
    (item: Datastream, columnKey: DatastreamColumnKey) => {
    switch (columnKey) {
      case 'name':
        return item?.name ?? ''
      case 'observedProperty':
        return item?.ObservedProperty?.name ?? ''
      case 'unitOfMeasurement':
        return item?.unitOfMeasurement?.symbol ?? ''
      case 'last': {
        const { endRaw } = parsePhenomenonTime(item?.phenomenonTime)
        const ms = ageMs(endRaw)
        return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER
      }
      case 'startDate':
        return parsePhenomenonTime(item?.phenomenonTime).start
      case 'endDate':
        return parsePhenomenonTime(item?.phenomenonTime).end
      default:
        return ''
    }
    },
    []
  )

  const renderCell = useCallback(
    (item: Datastream, columnKey: DatastreamColumnKey) => {
      const { start, end, endRaw } = parsePhenomenonTime(item?.phenomenonTime)

      const handleDetails = () => {
        if (onOpenDetails) {
          onOpenDetails(item)
        }
      }
      const handleEdit = () => {
        if (onEditDatastream) {
          onEditDatastream(item)
        }
      }
      const handleDelete = () => {
        setPendingDelete(item)
        setDeletePreview({
          network: String(item?.Network?.name ?? ''),
          thing: String(thing?.name ?? ''),
          location: String(thing?.Locations?.[0]?.name ?? ''),
          sensor: String(item?.Sensor?.name ?? ''),
          observedProperty: String(item?.ObservedProperty?.name ?? ''),
          datastream: String(item?.name ?? ''),
          observationsCount: Array.isArray(item?.Observations)
            ? item.Observations.length
            : 0,
        })
      }

      switch (columnKey) {
        case 'name':
          return <span>{item?.name ?? ''}</span>

        case 'observedProperty':
          return <span>{item?.ObservedProperty?.name ?? ''}</span>

        case 'unitOfMeasurement':
          return <span>{item?.unitOfMeasurement?.symbol ?? ''}</span>

        case 'last': {
          const hasObservations = Array.isArray(item?.Observations)
            ? item.Observations.length > 0
            : false

          if (!hasObservations || !endRaw) {
            return <span>{''}</span>
          }

          const acquisition = item?.properties?.acquisitionFrequency
          const fresh = isFresh(endRaw, acquisition)

          return (
            <Chip variant="dot" color={fresh ? 'success' : 'danger'} size="sm">
              {ageLabel(endRaw)}
            </Chip>
          )
        }

        case 'lastValue': {
          const value = item?.Observations?.[0]?.result
          const unit = item?.unitOfMeasurement?.symbol

          return value !== undefined && unit ? (
            <span>
              {String(value)} {unit}
            </span>
          ) : (
            <span>{''}</span>
          )
        }

        case 'startDate':
          return <span>{start}</span>

        case 'endDate':
          return <span>{end}</span>

        case 'actions':
          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip color="primary" content={t('general.details')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={handleDetails}
                >
                  <ChartIcon size={18} />
                </Button>
              </Tooltip>
              <Tooltip color="primary" content={t('general.edit')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={handleEdit}
                >
                  <EditIcon size={18} />
                </Button>
              </Tooltip>
              <Tooltip color="danger" content={t('general.delete')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={handleDelete}
                >
                  <DeleteIcon size={18} />
                </Button>
              </Tooltip>
            </div>
          )

        default:
          return <span>{''}</span>
      }
    },
    [lang, onDeleteDatastream, onEditDatastream, onOpenDetails, t, thing]
  )

  if (!thing) return null

  const closeDeleteModal = () => {
    setPendingDelete(null)
    setDeletePreview(null)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    onDeleteDatastream?.(pendingDelete)
    closeDeleteModal()
  }

  return (
    <>
      <div
        className="fixed left-0 right-0 bottom-0 pb-[env(safe-area-inset-bottom)]"
        style={{ zIndex: 3000 }}
      >
        <Card className="h-[27vh] overflow-hidden rounded-none">
          <TableComponent
          key={lang}
          items={datastreams}
          columns={columns}
          rowKey={(item, index) =>
            item?.id ?? `${item?.name ?? 'row'}-${index}`
          }
          initialSort={{ column: 'name', direction: 'ascending' }}
          getSortValue={getSortValue}
          enableSearch
          searchPlaceholder={t('general.search')}
          searchPredicate={searchPredicate}
          enablePagination
          showTotal
          totalLabel={(total) => (
            <span className="text-default-400 text-small">
              {t('general.total')}: {total}
            </span>
          )}
          enableColumnSelector
          columnSelectorLabel={t('general.columns')}
          emptyContent={t('general.no_data')}
          topLeft={
            <div className="min-w-0 flex-1 p-1">
              <div className="text-xs font-medium ">{thingName}</div>
              <div className="text-[10px]">{networkLabel}</div>
            </div>
          }
          topRight={
            <div className="flex gap-2">
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    endContent={<ChevronDownIcon size={18} />}
                    size="sm"
                    color="primary"
                  >
                    {t('general.new')}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Datastream actions" variant="light">
                  <DropdownItem
                    key="new-datastream"
                    startContent={<LocationIcon size={16} />}
                    onPress={onCreateDatastream}
                  >
                    {t('general.new')}
                  </DropdownItem>
                  <DropdownItem
                    key="import-from-file"
                    startContent={<ImportFileIcon size={16} />}
                    onPress={() =>
                      document
                        .getElementById('datastream-import-trigger')
                        ?.click()
                    }
                  >
                    {t('import.actions.import_from_file')}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
              <ImportFromFileButton
                buttonId="datastream-import-trigger"
                className="hidden"
              />

              <Tooltip content={t('general.close')}>
                <Button
                  isIconOnly
                  size="sm"
                  className="h-6 w-6 min-w-6"
                  radius="none"
                  variant="light"
                  aria-label={t('general.close')}
                  onPress={onClose}
                >
                  <CloseIcon size={18} />
                </Button>
              </Tooltip>
            </div>
          }
            renderCell={(item, columnKey) => renderCell(item, columnKey)}
          />
        </Card>
      </div>

      <Modal
        isOpen={pendingDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDeleteModal()
        }}
      >
        <ModalContent>
          <ModalHeader>{t('datastreams.delete_confirm_title')}</ModalHeader>
          <ModalBody className="flex flex-col gap-2 text-sm">
            <p>{t('datastreams.delete_confirm_impacted')}</p>
            <p>
              {t('datastreams.delete_confirm_network')}: {deletePreview?.network || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_thing')}: {deletePreview?.thing || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_location')}: {deletePreview?.location || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_sensor')}: {deletePreview?.sensor || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_observed_property')}:{' '}
              {deletePreview?.observedProperty || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_datastream')}: {deletePreview?.datastream || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_observations')}:{' '}
              {deletePreview?.observationsCount ?? 0}
            </p>
            <p className="pt-1 text-default-500">
              {t('datastreams.delete_confirm_footer')}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeDeleteModal}>
              {t('general.cancel')}
            </Button>
            <Button color="danger" onPress={confirmDelete}>
              {t('general.delete')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
