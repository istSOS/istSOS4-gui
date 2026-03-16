'use client'

import { Button } from '@heroui/button'
import { Card } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Tooltip } from '@heroui/tooltip'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ChartIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  PlusIcon,
} from '@/components/icons'
import { TableComponent } from '@/components/table/table'

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
  thing: any | null
  onClose: () => void
  onOpenDetails?: (datastream: any) => void
}

export default function MainTable({ thing, onClose, onOpenDetails }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language

  const datastreams: any[] = useMemo(() => {
    const ds = thing?.Datastreams
    return Array.isArray(ds) ? ds : []
  }, [thing])

  const thingName = String(thing?.name ?? '')
  const networkName = String(thing?.Datastreams?.[0]?.Network?.name ?? '')

  const columns: any[] = useMemo(
    () => [
      {
        name: t('datastreams.name'),
        uid: 'name',
        sortable: true,
        align: 'left',
      },
      {
        name: t('datastreams.observed_property'),
        uid: 'observedProperty',
        sortable: true,
        align: 'left',
      },
      {
        name: t('datastreams.unit_of_measurement'),
        uid: 'unitOfMeasurement',
        sortable: true,
        align: 'center',
      },
      { name: t('general.last'), uid: 'last', sortable: true, align: 'left' },
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

  const searchPredicate = useCallback((item: any, query: string) => {
    const q = query.toLowerCase()
    return String(item?.name ?? '')
      .toLowerCase()
      .includes(q)
  }, [])

  const getSortValue = useCallback((item: any, columnKey: string) => {
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
  }, [])

  const renderCell = useCallback(
    (item: any, columnKey: string) => {
      const { start, end, endRaw } = parsePhenomenonTime(item?.phenomenonTime)

      const handleDetails = () => {
        if (onOpenDetails) {
          onOpenDetails(item)
        }
      }
      const handleEdit = () => console.log('Edit datastream:', item)
      const handleDelete = () => console.log('Delete datastream:', item)

      switch (columnKey) {
        case 'name':
          return <span>{item?.name ?? ''}</span>

        case 'observedProperty':
          return <span>{item?.ObservedProperty?.name ?? ''}</span>

        case 'unitOfMeasurement':
          return <span>{item?.unitOfMeasurement?.symbol ?? ''}</span>

        case 'last': {
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
              {value} {unit}
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
              <Tooltip content={t('general.details')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  radius="none"
                  size="sm"
                  variant="light"
                  onPress={handleDetails}
                >
                  <ChartIcon size={18} />
                </Button>
              </Tooltip>
              <Tooltip content={t('general.edit')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  radius="none"
                  size="sm"
                  variant="light"
                  onPress={handleEdit}
                >
                  <EditIcon size={18} />
                </Button>
              </Tooltip>
              <Tooltip color="danger" content={t('general.delete')}>
                <Button
                  isIconOnly
                  className="h-6 w-6 min-w-6"
                  radius="none"
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
    [lang]
  )

  if (!thing) return null

  return (
    <div
      className="fixed left-0 right-0 bottom-0 pb-[env(safe-area-inset-bottom)]"
      style={{ zIndex: 3000 }}
    >
      <Card
        radius="none"
        className="max-h-[30vh] overflow-hidden"
        classNames={{ body: 'p-0' }}
      >
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
              <div className="text-[10px]">{networkName}</div>
            </div>
          }
          topRight={
            <div className="flex gap-2">
              <Button
                endContent={<PlusIcon size={18} />}
                size="sm"
                color="primary"
              >
                {t('general.new')}
              </Button>

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
  )
}
