'use client'

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
  loading?: boolean
  error?: string | null
  start?: string | null
  end?: string | null
  onApplyRange?: (start?: string | null, end?: string | null) => void
  onResetRange?: () => void
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
  loading = false,
  error = null,
  start = null,
  end = null,
  onApplyRange,
  onResetRange,
}: ChartModalProps) {
  const { t } = useTranslation()
  const rangeValue = toRangeValue(start, end)
  const timeZone = getLocalTimeZone()

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
          <div className="pb-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t('chart.time_range', 'Time range')}
              </span>
              <DateRangePicker<any>
                aria-label={t('chart.time_range', 'Time range')}
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
                maxValue={now(timeZone) as any}
                granularity="minute"
              />
            </label>
          </div>
          <ObservationGraph
            thing={thing}
            datastream={datastream}
            observations={observations}
            loading={loading}
            error={error}
            height="100%"
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
