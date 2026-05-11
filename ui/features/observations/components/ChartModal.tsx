'use client'

import { Button } from '@heroui/button'
import { DateRangePicker } from '@heroui/date-picker'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/modal'
import { Select, SelectItem } from '@heroui/select'
import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from '@internationalized/date'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from '@/components/icons'
import { Datastream, Observation, Thing } from '@/types/domain'

import ObservationGraph from './ObservationGraph'

type ChartModalProps = {
  isOpen: boolean
  onClose: () => void
  things?: Thing[]
  thing?: Thing | null
  selectedObservedPropertyName?: string | null
  selectedThingKeys?: string[]
  selectedObservedPropertyNames?: string[]
  datastream?: Datastream | null
  observations?: Observation[]
  comparisonDatastream?: Datastream | null
  comparisonObservations?: Observation[]
  allSeries?: Array<{ datastream: Datastream; observations: Observation[] }>
  loading?: boolean
  error?: string | null
  start?: string | null
  end?: string | null
  onApplyRange?: (start?: string | null, end?: string | null) => void
  onResetRange?: () => void
  onDownloadAllDatastreams?: () => Promise<{ filename: string; bytes: ArrayBuffer } | null>
  activeDatastreamIds?: string[]
  onActiveDatastreamsChange?: (datastreamIds: string[]) => void
  onThingKeysChange?: (thingKeys: string[]) => void
  onObservedPropertyNamesChange?: (observedPropertyNames: string[]) => void
}

type DateRangeChangeValue = {
  start: { toDate: (timeZone?: string) => Date } | null
  end: { toDate: (timeZone?: string) => Date } | null
} | null

function toRangeValue(start?: string | null, end?: string | null) {
  if (!start || !end) return null

  return {
    start: parseAbsoluteToLocal(start),
    end: parseAbsoluteToLocal(end),
  }
}

export default function ChartModal({
  isOpen,
  onClose,
  things = [],
  thing = null,
  selectedObservedPropertyName = null,
  selectedThingKeys = [],
  selectedObservedPropertyNames = [],
  datastream = null,
  observations = [],
  comparisonDatastream = null,
  comparisonObservations = [],
  allSeries = [],
  loading = false,
  error = null,
  start = null,
  end = null,
  onApplyRange,
  onResetRange,
  onDownloadAllDatastreams,
  activeDatastreamIds = [],
  onActiveDatastreamsChange,
  onThingKeysChange,
  onObservedPropertyNamesChange,
}: ChartModalProps) {
  const { t } = useTranslation()
  const rangeValue = toRangeValue(start, end)
  const timeZone = getLocalTimeZone()
  const thingOptions = things.map((entry) => {
    const key = `${String(entry?.__sourceId ?? entry?.__sourceEndpoint ?? '0')}::${String(
      entry?.['@iot.id'] ?? entry?.id ?? entry?.name ?? ''
    )}`
    return { key, label: String(entry?.name ?? key) }
  })
  const selectedThings = things.filter((entry) =>
    selectedThingKeys.includes(
      `${String(entry?.__sourceId ?? entry?.__sourceEndpoint ?? '0')}::${String(
        entry?.['@iot.id'] ?? entry?.id ?? entry?.name ?? ''
      )}`
    )
  )
  const observedPropertySourceThings =
    selectedThings.length > 0 ? selectedThings : thing ? [thing] : []
  const observedPropertyOptions = Array.from(
    new Set(
      observedPropertySourceThings
        .flatMap((entry) =>
          Array.isArray(entry?.Datastreams) ? entry.Datastreams : []
        )
        .map((ds) => String(ds?.ObservedProperty?.name ?? '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ key: name, label: name }))

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      hideCloseButton
      placement="center"
      scrollBehavior="inside"
      size="5xl"
      backdrop="blur"
      classNames={{
        wrapper: 'z-[6000]',
        base: 'z-[6001] h-[62vh] min-h-[62vh] max-h-[62vh] w-[94vw] max-w-[1440px]',
        backdrop: 'z-[5999]',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center justify-between gap-3 pb-0">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">Observations</div>
          </div>
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
        </ModalHeader>
        <ModalBody className="h-full overflow-hidden p-4 pt-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-4 grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
            <Select
              label="Thing"
              labelPlacement="inside"
              placeholder="Select thing(s)"
              variant="bordered"
              radius="sm"
              size="sm"
              color="primary"
              className="w-full"
              selectionMode="multiple"
              selectedKeys={new Set(selectedThingKeys)}
              onSelectionChange={(keys) =>
                onThingKeysChange?.(Array.from(keys as Set<string>))
              }
            >
              {thingOptions.map((entry) => (
                <SelectItem key={entry.key}>{entry.label}</SelectItem>
              ))}
            </Select>
            <Select
              label="Observed Property"
              labelPlacement="inside"
              placeholder="Select observed property(ies)"
              variant="bordered"
              radius="sm"
              size="sm"
              color="primary"
              className="w-full"
              selectionMode="multiple"
              selectedKeys={new Set(selectedObservedPropertyNames)}
              onSelectionChange={(keys) =>
                onObservedPropertyNamesChange?.(Array.from(keys as Set<string>))
              }
            >
              {observedPropertyOptions.map((entry) => (
                <SelectItem key={entry.key}>{entry.label}</SelectItem>
              ))}
            </Select>
            <DateRangePicker
              value={rangeValue as never}
              onChange={(value) => {
                const nextValue = value as unknown as DateRangeChangeValue

                if (!nextValue) {
                  onResetRange?.()
                  return
                }

                if (nextValue.start && nextValue.end) {
                  onApplyRange?.(
                    nextValue.start.toDate(timeZone).toISOString(),
                    nextValue.end.toDate(timeZone).toISOString()
                  )
                }
              }}
              variant="bordered"
              label={t('chart.time_range')}
              className="w-full"
              showMonthAndYearPickers
              hideTimeZone
              visibleMonths={2}
              selectorButtonPlacement="start"
              color="primary"
              size="sm"
            />
            </div>
            <div className="min-h-0 flex-1">
              <ObservationGraph
                thing={thing}
                datastream={datastream}
                observations={observations}
                comparisonDatastream={comparisonDatastream}
                comparisonObservations={comparisonObservations}
                allSeries={allSeries}
                activeDatastreamIds={activeDatastreamIds}
                onActiveDatastreamsChange={onActiveDatastreamsChange}
                loading={loading}
                error={error}
                onDownloadAllDatastreams={onDownloadAllDatastreams}
                height="100%"
              />
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
