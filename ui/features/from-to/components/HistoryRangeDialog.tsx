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

/**
 * @file features/from-to/components/HistoryRangeDialog.tsx
 *
 * Collects the two ends of a `$from_to` window, then navigates to the history
 * page. Opening history is not a mode the application enters — it is a
 * different page — so this dialog's confirm is a route change and nothing here
 * touches As-Of state.
 *
 * The dialog owns validation because the API cannot report it: a reversed
 * range, a missing end, an expand it dislikes — all answer
 * `500 Internal server error` with no usable body. So the confirm button stays
 * disabled until the window is one the API will accept, and the reason is shown
 * against the offending field.
 *
 * The note about system time is the one line users most need. `$from_to`
 * filters by *when the record was edited*, which is a different axis from the
 * `phenomenonTime` range the observation chart already filters by, and the two
 * are easy to confuse when both are "a date range on sensor data".
 */

import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
  toCalendarDateTime,
} from '@internationalized/date'
import { Button } from '@heroui/button'
import { DatePicker } from '@heroui/date-picker'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { normalizedBasePath } from '@/app/home/utils'
import {
  FULL_HISTORY_WINDOW,
  fitWindowToVersions,
  validateWindow,
  type HistoryWindow,
  type WindowProblem,
} from '@/features/from-to/lib/historyWindow'

dayjs.extend(utc)

const BOUNDS_API = `${normalizedBasePath}/api/from-to/bounds`

/** Presets offered above the inputs, newest-relative except "all". */
const PRESETS = [
  { key: 'last_24_hours', hours: 24 },
  { key: 'last_7_days', hours: 24 * 7 },
  { key: 'last_30_days', hours: 24 * 30 },
  { key: 'all_history', hours: null },
] as const

/**
 * Whole-second UTC — the form the API reads without guessing a timezone.
 *
 * The pickers work in the viewer's local zone, like the chart's do. A naive
 * datetime sent to the API would be read wherever the API happens to run, so
 * the conversion is pinned here rather than left to the backend.
 */
function toUtcIso(date: Date): string {
  return dayjs.utc(date).startOf('second').toISOString().replace('.000Z', 'Z')
}

function problemFor(
  problems: WindowProblem[],
  field: 'from' | 'to',
): WindowProblem | undefined {
  return problems.find((problem) => problem.field === field)
}

export type HistoryRangeDialogProps = {
  isOpen: boolean
  onClose: () => void
  /** What the history is being opened for, e.g. `thing_name_1`. */
  entityName: string
  /** Entity kind, for the subtitle — `Thing`, `Datastream`. */
  entityKind: string
  /** Resource path the page will read, e.g. `Things(1)`. */
  entityPath: string
  /** Called with the chosen window; the caller performs the navigation. */
  onConfirm: (window: HistoryWindow) => void
}

export default function HistoryRangeDialog({
  isOpen,
  onClose,
  entityName,
  entityKind,
  entityPath,
  onConfirm,
}: HistoryRangeDialogProps) {
  const { t } = useTranslation()

  /**
   * Opens on the last 30 days, then re-fits to the entity's own lifetime as
   * soon as its earliest version is known.
   *
   * A fixed 30 days is empty for anything last edited before that — which, on
   * seeded data, is most entities — and an empty first view teaches the user
   * that the feature does not work. Fitting is a correction rather than the
   * initial value so the dialog opens instantly and never blocks on a request.
   */
  const [window, setWindow] = useState<HistoryWindow>(() => {
    const now = dayjs.utc()
    return {
      from: now.subtract(30, 'day').startOf('minute').toISOString().replace('.000Z', 'Z'),
      to: now.startOf('minute').toISOString().replace('.000Z', 'Z'),
    }
  })

  /** True once the user has touched the range — never overwrite their choice. */
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let active = true

    fetch(BOUNDS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: entityPath }),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || touched || !payload?.earliest) return
        const fitted = fitWindowToVersions([payload.earliest])
        if (fitted) setWindow(fitted)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
    // `touched` is read inside, not depended on: re-fitting after the user has
    // edited the range is exactly what must not happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityPath])

  const problems = useMemo(() => validateWindow(window), [window])
  const fromProblem = problemFor(problems, 'from')
  const toProblem = problemFor(problems, 'to')

  const applyPreset = (hours: number | null) => {
    setTouched(true)
    if (hours === null) {
      setWindow(FULL_HISTORY_WINDOW)
      return
    }
    const now = dayjs.utc().startOf('minute')
    setWindow({
      from: now.subtract(hours, 'hour').toISOString().replace('.000Z', 'Z'),
      to: now.toISOString().replace('.000Z', 'Z'),
    })
  }

  const isPresetActive = (hours: number | null) => {
    if (hours === null) {
      return (
        window.from === FULL_HISTORY_WINDOW.from &&
        window.to === FULL_HISTORY_WINDOW.to
      )
    }
    const expected = dayjs.utc(window.to).subtract(hours, 'hour')
    return Math.abs(expected.diff(dayjs.utc(window.from), 'minute')) < 1
  }

  const timeZone = getLocalTimeZone()

  /**
   * HeroUI pins `shouldCloseOnSelect` to `!hasTime`, so at minute granularity
   * clicking a day never commits on its own — it waits for a time typed in
   * full, and until then the calendar appears to do nothing. The calendar's own
   * onChange is mergeable, so the day is committed here at midnight; the
   * popover stays open so a time can still be set. Same fix as ChartModal.
   */
  const commitCalendarDay = (edge: 'from' | 'to') => (date: unknown) => {
    const day = date as Parameters<typeof toCalendarDateTime>[0] | null
    if (!day) return
    setTouched(true)
    setWindow((current) => ({
      ...current,
      [edge]: toUtcIso(toCalendarDateTime(day).toDate(timeZone)),
    }))
  }

  const commitPicked = (edge: 'from' | 'to') => (value: unknown) => {
    const next = value as { toDate: (zone?: string) => Date } | null
    if (!next) return
    setTouched(true)
    setWindow((current) => ({ ...current, [edge]: toUtcIso(next.toDate(timeZone)) }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      // The map sits under a bottom panel at z-[4000], and HeroUI's modal
      // defaults to z-50 — so without this the dialog opens *behind* the panel
      // and pressing the button looks like it does nothing. Same values as
      // ChartModal and FormModal.
      classNames={{
        wrapper: 'z-[6000]',
        base: 'z-[6001]',
        backdrop: 'z-[5999]',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">
            {t('from_to.dialog.title')}
          </span>
          <span className="text-tiny text-default-500 font-normal">
            {entityName} · {entityKind} — {t('from_to.dialog.subtitle')}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker
              label={t('from_to.dialog.from')}
              granularity="minute"
              hideTimeZone
              isInvalid={!!fromProblem}
              value={parseAbsoluteToLocal(window.from) as never}
              onChange={commitPicked('from')}
              calendarProps={{ onChange: commitCalendarDay('from') } as never}
            />
            <DatePicker
              label={t('from_to.dialog.to')}
              granularity="minute"
              hideTimeZone
              isInvalid={!!toProblem}
              value={parseAbsoluteToLocal(window.to) as never}
              onChange={commitPicked('to')}
              calendarProps={{ onChange: commitCalendarDay('to') } as never}
            />
          </div>
          <p className="-mt-2 text-tiny text-default-400">
            {t('from_to.dialog.local_time_note')}
          </p>

          {/* The API answers every one of these with an opaque 500, so the
              reason has to be written here. */}
          {problems.length > 0 && (
            <p role="alert" className="text-tiny text-danger">
              {fromProblem?.reason === 'after-to'
                ? t('from_to.dialog.error_reversed')
                : t('from_to.dialog.error_incomplete')}
            </p>
          )}

          <div>
            <div className="text-tiny font-semibold uppercase tracking-wide text-default-500">
              {t('from_to.dialog.presets')}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  size="sm"
                  radius="full"
                  variant={isPresetActive(preset.hours) ? 'solid' : 'bordered'}
                  color={isPresetActive(preset.hours) ? 'primary' : 'default'}
                  onPress={() => applyPreset(preset.hours)}
                >
                  {t(`from_to.dialog.preset_${preset.key}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-r-lg border-l-[3px] border-primary bg-default-100 px-3 py-2">
            <p className="text-tiny text-default-700">
              <span className="font-semibold">
                {t('from_to.dialog.system_time_title')}
              </span>{' '}
              {t('from_to.dialog.system_time_body')}
            </p>
          </div>

          <div>
            <div className="text-tiny font-semibold uppercase tracking-wide text-default-500">
              {t('from_to.dialog.opens')}
            </div>
            <code className="mt-1 block overflow-x-auto whitespace-pre rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-tiny">
              {`/history/${entityPath}?from=${window.from}&to=${window.to}`}
            </code>
          </div>
        </ModalBody>

        <ModalFooter className="justify-between">
          <span className="text-tiny text-default-500">
            {t('from_to.dialog.overlap_note')}
          </span>
          <div className="flex gap-2">
            <Button variant="light" onPress={onClose}>
              {t('general.cancel')}
            </Button>
            <Button
              color="primary"
              isDisabled={problems.length > 0}
              onPress={() => onConfirm(window)}
            >
              {t('from_to.dialog.confirm')}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
