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
import HistoryRangeDialog from '@/features/from-to/components/HistoryRangeDialog'
import { type HistoryWindow } from '@/features/from-to/lib/historyWindow'
import { Datastream, Thing } from '@/types/domain'
import { Button } from '@heroui/button'
import { Card } from '@heroui/card'
import { Chip } from '@heroui/chip'
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

import { useRouter } from 'next/navigation'

import {
  ChartIcon,
  DeleteIcon,
  EditIcon,
  HistoryIcon,
} from '@/components/icons'
import TableComponent from '@/components/table/Table'

import { isVersioningEnabled } from '@/config/versioning'

import { useAuth } from '@/context/AuthContext'

import type { MapDatastreamRow } from '../lib/mapDatastreamRows'

// h-6 w-6 buttons with gap-1 between them.
const ACTION_ICON_PITCH = 28

/**
 * All action tooltips open right of the whole icon group: Actions is the last
 * column, so they cover no other cell. A tooltip stays open while the pointer
 * is on it, so one above an icon covered the row above and one beside it
 * covered the next icon.
 */
const actionTooltipProps = (iconsToTheRight: number) => ({
  placement: 'right' as const,
  offset: 8 + iconsToTheRight * ACTION_ICON_PITCH,
  closeDelay: 0,
})

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
  rows?: MapDatastreamRow[]
  highlightedKeys?: ReadonlySet<string>
  focusRowKey?: string | null
  focusRequest?: unknown
  observedPropertyNameFilter?: string | null
  /** True when the app is in as_of snapshot mode */
  isSnapshot?: boolean
  /** The ISO snapshot datetime, shown in the read-only banner */
  asOfDate?: string | null
  /**
   * Set when the snapshot could not be resolved — the rows below are then LIVE
   * data, and the banner has to say so instead of claiming to show the snapshot.
   */
  snapshotError?: string | null
  onSelectDatastream?: (datastream: Datastream) => void
  onOpenDetails?: (datastream: Datastream) => void
  onEditDatastream?: (datastream: Datastream) => void
  onDeleteDatastream?: (datastream: Datastream) => void
}

type DatastreamColumnKey =
  | 'id'
  | 'thing'
  | 'source'
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

// Firefox supports autocomplete on buttons, but React's button type omits it.
const actionButtonSessionProps = { autoComplete: 'off' }

function datastreamRowKey(item: Datastream, index: number) {
  return (
    (item as MapDatastreamRow).__mapKey ??
    item['@iot.id'] ??
    item.id ??
    `${item.name ?? 'row'}-${index}`
  )
}

export default function DatastreamTable({
  thing,
  rows,
  highlightedKeys,
  focusRowKey,
  focusRequest,
  observedPropertyNameFilter = null,
  isSnapshot = false,
  asOfDate = null,
  snapshotError = null,
  onSelectDatastream,
  onOpenDetails,
  onEditDatastream,
  onDeleteDatastream,
}: Props) {
  const { t } = useTranslation()
  const { canWrite } = useAuth()
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState<Datastream | null>(null)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)

  // Address datastream history through its top-level path: a nested Thing
  // path can return duplicate versions when both parent and stream changed.
  const [historySubject, setHistorySubject] = useState<{
    name: string
    kind: string
    path: string
  } | null>(null)

  const openDatastreamHistory = useCallback((datastream: Datastream) => {
    const id = datastream?.['@iot.id'] ?? datastream?.id
    if (!isVersioningEnabled || id == null) return
    setHistorySubject({
      name: String(datastream?.name ?? ''),
      kind: 'Datastream',
      path: `Datastreams(${id})`,
    })
  }, [])

  /**
   * History is a page, not a mode: confirming navigates and leaves the map
   * behind, and the window travels in the URL so the link can be shared.
   */
  const goToHistory = useCallback(
    (window: HistoryWindow) => {
      if (!isVersioningEnabled || !historySubject) return
      const query = new URLSearchParams({ from: window.from, to: window.to })
      setHistorySubject(null)
      router.push(`/history/${historySubject.path}?${query.toString()}`)
    },
    [historySubject, router]
  )

  const datastreams: Datastream[] = useMemo(() => {
    if (rows) return rows
    const ds = thing?.Datastreams
    const all = Array.isArray(ds) ? ds : []
    const filterName = String(observedPropertyNameFilter ?? '')
      .trim()
      .toLowerCase()
    if (!filterName) return all
    return all.filter((entry) =>
      String(entry?.ObservedProperty?.name ?? '')
        .trim()
        .toLowerCase()
        .includes(filterName)
    )
  }, [rows, thing, observedPropertyNameFilter])

  const isMapTable = rows !== undefined
  const columns: Array<{
    name: string
    uid: DatastreamColumnKey
    sortable: boolean
    align: 'start' | 'center' | 'end'
    width?: number
  }> = useMemo(
    () => [
      { name: 'ID', uid: 'id', sortable: true, align: 'start' },
      ...(isMapTable
        ? [
            {
              name: t('map.things'),
              uid: 'thing' as const,
              sortable: true,
              align: 'start' as const,
            },
            {
              name: t('map.data_source'),
              uid: 'source' as const,
              sortable: true,
              align: 'start' as const,
            },
          ]
        : []),
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
      {
        name: t('general.last'),
        uid: 'last',
        sortable: true,
        align: 'start',
        width: 150,
      },
      {
        name: t('general.last_value'),
        uid: 'lastValue',
        sortable: false,
        align: 'end',
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
        width: 130,
      },
    ],
    [isMapTable, t]
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
        case 'id':
          return item['@iot.id'] ?? item.id ?? ''
        case 'thing':
          return (item as MapDatastreamRow).__thing?.name ?? ''
        case 'source':
          return item.__sourceName ?? ''
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
      const rowThing = (item as MapDatastreamRow).__thing ?? thing
      const { start, end, endRaw } = parsePhenomenonTime(item?.phenomenonTime)
      const locked = isSnapshot || !canWrite
      const lockedReason = isSnapshot
        ? t('as_of.table.read_only')
        : !canWrite
          ? t('general.read_only')
          : null

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
          thing: String(rowThing?.name ?? ''),
          location: String(rowThing?.Locations?.[0]?.name ?? ''),
          sensor: String(item?.Sensor?.name ?? ''),
          observedProperty: String(item?.ObservedProperty?.name ?? ''),
          datastream: String(item?.name ?? ''),
          observationsCount: Array.isArray(item?.Observations)
            ? item.Observations.length
            : 0,
        })
      }

      switch (columnKey) {
        case 'id':
          return (
            <span className="tabular-nums">
              {item['@iot.id'] ?? item.id ?? ''}
            </span>
          )
        case 'thing':
          return <span>{rowThing?.name ?? ''}</span>
        case 'source':
          return <span>{item.__sourceName ?? ''}</span>
        case 'name':
          return <span>{item?.name ?? ''}</span>

        case 'observedProperty':
          return <span>{item?.ObservedProperty?.name ?? ''}</span>

        case 'unitOfMeasurement':
          return <span>{item?.unitOfMeasurement?.symbol ?? ''}</span>

        case 'last': {
          if (!endRaw) {
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
            <span className="tabular-nums">
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
              <Tooltip
                color="primary"
                content={t('general.details')}
                {...actionTooltipProps(isVersioningEnabled ? 3 : 2)}
              >
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
              {/* History remains available in snapshot mode because it is read-only. */}
              {isVersioningEnabled && (
                <Tooltip
                  color="primary"
                  {...actionTooltipProps(2)}
                  content={t('from_to.table.row_history_tooltip', {
                    name: String(item?.name ?? ''),
                  })}
                >
                  <Button
                    isIconOnly
                    className="h-6 w-6 min-w-6"
                    size="sm"
                    variant="light"
                    color="primary"
                    // An icon-only button needs a name of its own: the tooltip
                    // only exists on hover, so without this the control is
                    // unlabelled to a screen reader — and it is precisely the
                    // label that identifies the datastream being inspected.
                    aria-label={t('from_to.table.row_history_tooltip', {
                      name: String(item?.name ?? ''),
                    })}
                    onPress={() => openDatastreamHistory(item)}
                  >
                    <HistoryIcon size={18} />
                  </Button>
                </Tooltip>
              )}
              {/* In snapshot mode, or without write permission, the write
                  actions stay visible but greyed out and inert, so a row's
                  actions read the same everywhere and the reason is one hover
                  away. The wrapping span keeps the tooltip hoverable — a
                  disabled button receives no events. Firefox button-state
                  restoration is disabled so reloads retain the server-rendered
                  permission state during hydration. */}
              <Tooltip
                color={locked ? 'foreground' : 'primary'}
                {...actionTooltipProps(1)}
                content={lockedReason ?? t('general.edit')}
              >
                <span className={locked ? 'cursor-not-allowed' : undefined}>
                  <Button
                    isIconOnly
                    isDisabled={locked}
                    {...actionButtonSessionProps}
                    className={`h-6 w-6 min-w-6 ${locked ? 'opacity-40' : ''}`}
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={handleEdit}
                  >
                    <EditIcon size={18} />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip
                color={locked ? 'foreground' : 'danger'}
                {...actionTooltipProps(0)}
                content={lockedReason ?? t('general.delete')}
              >
                <span className={locked ? 'cursor-not-allowed' : undefined}>
                  <Button
                    isIconOnly
                    isDisabled={locked}
                    {...actionButtonSessionProps}
                    className={`h-6 w-6 min-w-6 ${locked ? 'opacity-40' : ''}`}
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={handleDelete}
                  >
                    <DeleteIcon size={18} />
                  </Button>
                </span>
              </Tooltip>
            </div>
          )

        default:
          return <span>{''}</span>
      }
    },
    // isSnapshot and canWrite decide whether the write actions render disabled,
    // so leaving either out would keep the cells stale when they change.
    [
      canWrite,
      isSnapshot,
      onEditDatastream,
      onOpenDetails,
      openDatastreamHistory,
      t,
      thing,
    ]
  )

  if (!thing && !rows) return null

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
      <div className="h-full min-h-0">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none p-2">
          {isSnapshot && (
            <div
              className="flex items-center gap-2 px-3 py-1 text-xs font-medium"
              style={{
                background: snapshotError
                  ? 'linear-gradient(90deg, rgba(153,27,27,0.14) 0%, rgba(185,28,28,0.14) 100%)'
                  : 'linear-gradient(90deg, rgba(120,53,15,0.12) 0%, rgba(146,64,14,0.12) 100%)',
                borderBottom: snapshotError
                  ? '1px solid rgba(248,113,113,0.35)'
                  : '1px solid rgba(251,191,36,0.25)',
                color: snapshotError ? '#b91c1c' : '#b45309',
              }}
            >
              {snapshotError ? (
                <span>
                  ⚠ Snapshot could not be loaded — showing{' '}
                  <span className="font-bold">live</span> data ({snapshotError})
                </span>
              ) : (
                <span>
                  ⚙ Snapshot mode — read-only — showing data as of{' '}
                  <span className="font-bold">
                    {asOfDate
                      ? dayjs.utc(asOfDate).format('MMM D, YYYY HH:mm') + ' UTC'
                      : ''}
                  </span>
                </span>
              )}
            </div>
          )}
          <TableComponent
            items={datastreams}
            highlightedKeys={highlightedKeys}
            pinnedKeys={highlightedKeys}
            focusRowKey={focusRowKey}
            focusRequest={focusRequest}
            scrollable
            continuousScroll
            columns={columns}
            rowKey={datastreamRowKey}
            onRowAction={onSelectDatastream}
            initialSort={{ column: 'name', direction: 'ascending' }}
            getSortValue={getSortValue}
            enableSearch={!rows}
            searchPlaceholder={t('general.search')}
            searchPredicate={searchPredicate}
            enablePagination
            showTotal
            totalLabel={(total) => (
              <span className="text-default-400 text-small">
                {t('general.total')}: {total}
              </span>
            )}
            autoFitRows
            columnSelectorPlacement="header"
            enableColumnSelector
            initialVisibleColumns={
              new Set(
                columns
                  .filter((column) => column.uid !== 'id')
                  .map((column) => column.uid)
              )
            }
            columnSelectorLabel={t('general.columns')}
            emptyContent={t(rows ? 'map.table_empty' : 'general.no_data')}
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
              {t('datastreams.delete_confirm_network')}:{' '}
              {deletePreview?.network || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_thing')}:{' '}
              {deletePreview?.thing || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_location')}:{' '}
              {deletePreview?.location || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_sensor')}:{' '}
              {deletePreview?.sensor || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_observed_property')}:{' '}
              {deletePreview?.observedProperty || '-'}
            </p>
            <p>
              {t('datastreams.delete_confirm_datastream')}:{' '}
              {deletePreview?.datastream || '-'}
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

      {isVersioningEnabled && historySubject && (
        <HistoryRangeDialog
          isOpen
          entityName={historySubject.name}
          entityKind={historySubject.kind}
          entityPath={historySubject.path}
          onClose={() => setHistorySubject(null)}
          onConfirm={goToHistory}
        />
      )}
    </>
  )
}
