'use client'

import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete'
import { Button } from '@heroui/button'
import { DateRangePicker } from '@heroui/date-picker'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/modal'
import {
  getLocalTimeZone,
  now,
  parseAbsoluteToLocal,
} from '@internationalized/date'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from '@/components/icons'

import ObservationGraph from './ObservationGraph'

type ChartModalProps = {
  isOpen: boolean
  onClose: () => void
  thing?: any | null
  datastream?: any | null
  observations?: any[]
  comparisonDatastream?: any | null
  comparisonObservations?: any[]
  loading?: boolean
  error?: string | null
  start?: string | null
  end?: string | null
  onApplyRange?: (start?: string | null, end?: string | null) => void
  onResetRange?: () => void
  onDownloadAllDatastreams?: () => Promise<{ filename: string; bytes: ArrayBuffer } | null>
  onComparisonDatastreamChange?: (datastreamId: string | null) => void
}

type PickerDateLike = {
  toDate: (timeZone?: string) => Date
}

type PickerRangeLike = {
  start: PickerDateLike
  end: PickerDateLike
} | null

function toRangeValue(start?: string | null, end?: string | null) {
  if (!start || !end) return null

  return {
    start: parseAbsoluteToLocal(start),
    end: parseAbsoluteToLocal(end),
  } as unknown as PickerRangeLike
}

export default function ChartModal({
  isOpen,
  onClose,
  thing = null,
  datastream = null,
  observations = [],
  comparisonDatastream = null,
  comparisonObservations = [],
  loading = false,
  error = null,
  start = null,
  end = null,
  onApplyRange,
  onResetRange,
  onDownloadAllDatastreams,
  onComparisonDatastreamChange,
}: ChartModalProps) {
  const { t } = useTranslation()
  const rangeValue = toRangeValue(start, end)
  const timeZone = getLocalTimeZone()
  const selectedDatastreamId = String(
    datastream?.['@iot.id'] ?? datastream?.id ?? ''
  )
  const comparisonDatastreamId = String(
    comparisonDatastream?.['@iot.id'] ?? comparisonDatastream?.id ?? ''
  )
  const datastreamOptions = Array.isArray(thing?.Datastreams)
    ? thing.Datastreams.filter(
        (entry: any) =>
          String(entry?.['@iot.id'] ?? entry?.id ?? '') !== selectedDatastreamId
      )
    : []

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
            <div className="truncate text-base font-semibold">
              {String(datastream?.name ?? t('general.details'))}
            </div>
            <div className="truncate text-sm text-default-500">
              {String(thing?.name ?? '')}
            </div>
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
          <div className="mb-6 flex w-full flex-wrap items-end gap-4 md:mb-0">
            <DateRangePicker<any>
              value={rangeValue as any}
              onChange={(value) => {
                const nextValue = value as PickerRangeLike

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
              className="w-full md:max-w-xl"
              showMonthAndYearPickers
              hideTimeZone
              visibleMonths={2}
              selectorButtonPlacement="start"
              color="primary"
              size="sm"
            />
            <Autocomplete
              label={t('chart.compare_datastream')}
              labelPlacement="inside"
              placeholder={t('chart.none') ?? 'None'}
              variant="bordered"
              radius="sm"
              size="sm"
              color="primary"
              className="w-full max-w-md"
              selectedKey={comparisonDatastreamId || null}
              defaultItems={datastreamOptions}
              onSelectionChange={(key) => {
                const nextId = key ? String(key) : null
                onComparisonDatastreamChange?.(nextId)
              }}
            >
              {(entry: any) => {
                const optionId = String(entry?.['@iot.id'] ?? entry?.id ?? '')
                const optionName = String(entry?.name ?? optionId)
                return (
                  <AutocompleteItem key={optionId} textValue={optionName}>
                    {optionName}
                  </AutocompleteItem>
                )
              }}
            </Autocomplete>
          </div>
          <ObservationGraph
            thing={thing}
            datastream={datastream}
            observations={observations}
            comparisonDatastream={comparisonDatastream}
            comparisonObservations={comparisonObservations}
            loading={loading}
            error={error}
            onDownloadAllDatastreams={onDownloadAllDatastreams}
            height="100%"
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
