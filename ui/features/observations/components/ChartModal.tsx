'use client'

import { SNAPSHOT_WINDOW_DAYS } from '@/features/as-of/lib/snapshotWindow'
import { Datastream, Observation } from '@/types/domain'
import { Button } from '@heroui/button'
import { DatePicker } from '@heroui/date-picker'
import { Modal, ModalBody, ModalContent } from '@heroui/modal'
import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
  toCalendarDateTime,
  today,
} from '@internationalized/date'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from '@/components/icons'

import DatastreamControls from './DatastreamControls'
import ObservationGraph from './ObservationGraph'
import ObservationTimeRange from './ObservationTimeRange'

import { browserUtcOffset, formatObservationTime } from '../../qc/lib/timezone'
import type { DatastreamChoice } from '../lib/datastreamSelection'
import type { SnapshotMarker } from '../lib/observationGraphOptions'
import {
  type ChangeRegion,
  type SeriesSource,
  buildRows,
  computeChangeRegions,
} from '../lib/observationGraphUtils'
import { qualityConstraintsOf, qualityModeOf } from '../lib/resultQuality'
import {
  saveSeriesAppearance,
  useSeriesAppearances,
} from '../lib/seriesAppearanceStore'

dayjs.extend(utc)

const EMPTY_OBSERVATIONS: Observation[] = []
const EMPTY_SERIES: SeriesSource[] = []
const EMPTY_IDS: string[] = []

const DAY_MS = 24 * 60 * 60 * 1000

type ChartModalProps = {
  isOpen: boolean
  onClose: () => void
  datastreamChoices: DatastreamChoice[]
  selectedDatastreamKeys: string[]
  listedDatastreamKeys: string[]
  onToggleDatastream: (key: string) => void
  onRemoveDatastream: (key: string) => void
  datastream?: Datastream | null
  observations?: Observation[]
  comparisonDatastream?: Datastream | null
  comparisonObservations?: Observation[]
  allSeries?: SeriesSource[]
  loading?: boolean
  error?: string | null
  start?: string | null
  end?: string | null
  onApplyRange?: (start?: string | null, end?: string | null) => void
  onResetRange?: () => void
  onDownloadAllDatastreams?: () => Promise<{
    filename: string
    bytes: ArrayBuffer
  } | null>
  activeDatastreamIds?: string[]
  /** True when the app is in As-Of snapshot mode */
  isSnapshot?: boolean
  /** ISO-8601 snapshot datetime — anchors the default window and shows the badge */
  asOfDate?: string | null
  /**
   * True when the snapshot window held no observations and the chart fell back
   * to the live-mode window (the 7 days ending at the last measurement that
   * existed at the snapshot).
   */
  isAsOfFallback?: boolean
  /**
   * ISO-8601 second snapshot to compare against, or null for the ordinary
   * As-Of chart. Chart-local — it never moves the global as-of.
   */
  compareAsOfDate?: string | null
  onCompareAsOfDateChange?: (date: string | null) => void
  /**
   * True while comparing on the aligned axis (each snapshot on its own trailing
   * window). False once an explicit range puts both on one shared window.
   */
  compareAligned?: boolean
}

/**
 * Builds a human-readable reason for why the shown window is empty, using the
 * datastream's own phenomenonTime extent ("isoStart/isoEnd").
 *
 * Purely informational — it never changes the as-of state. It is reached only
 * when the datastream has no observations at this point in time at all (an
 * empty [as_of-7d, as_of] window falls back to the live-mode window before the
 * chart ever renders empty).
 */
function describeSnapshotGap(
  datastream: Datastream | null,
  start: string | null | undefined,
  end: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const fmt = (d: dayjs.Dayjs) => d.utc().format('MMM D, YYYY')
  const [dataStartIso, dataEndIso] = String(
    datastream?.phenomenonTime ?? ''
  ).split('/')
  const dataStart = dataStartIso ? dayjs.utc(dataStartIso) : null
  const dataEnd = dataEndIso ? dayjs.utc(dataEndIso) : null
  const winStart = start ? dayjs.utc(start) : null
  const winEnd = end ? dayjs.utc(end) : null

  if (dataEnd && winStart && dataEnd.isBefore(winStart)) {
    return t('as_of.chart.no_data_ends_before', { date: fmt(dataEnd) })
  }
  if (dataStart && winEnd && dataStart.isAfter(winEnd)) {
    return t('as_of.chart.no_data_starts_after', { date: fmt(dataStart) })
  }
  return t('as_of.chart.no_data_in_window')
}

export default function ChartModal({
  isOpen,
  onClose,
  datastreamChoices,
  selectedDatastreamKeys,
  listedDatastreamKeys,
  onToggleDatastream,
  onRemoveDatastream,
  datastream = null,
  observations = EMPTY_OBSERVATIONS,
  comparisonDatastream = null,
  comparisonObservations = EMPTY_OBSERVATIONS,
  allSeries = EMPTY_SERIES,
  loading = false,
  error = null,
  start = null,
  end = null,
  onApplyRange,
  onResetRange,
  onDownloadAllDatastreams,
  activeDatastreamIds = EMPTY_IDS,
  isSnapshot = false,
  asOfDate = null,
  isAsOfFallback = false,
  compareAsOfDate = null,
  onCompareAsOfDateChange,
  compareAligned = true,
}: ChartModalProps) {
  const { t } = useTranslation()
  const seriesStyles = useSeriesAppearances()
  const [utcOffset, setUtcOffset] = useState(0)
  // From/To show the readings' own range when the chart fits them (≤ 7 days).
  const [dataRange, setDataRange] = useState<{
    start: number
    end: number
  } | null>(null)
  useEffect(() => {
    let mounted = true
    // Read the browser after hydration; the server can use a different zone.
    Promise.resolve().then(() => {
      if (mounted) setUtcOffset(browserUtcOffset())
    })
    return () => {
      mounted = false
    }
  }, [])
  const timeZone = getLocalTimeZone()
  const isComparingSnapshots = isSnapshot && !!asOfDate && !!compareAsOfDate
  // A snapshot of the future has no meaning — the same rule the as-of picker
  // enforces. Pinned per mount so the constraint object does not change identity
  // on every render and reset the picker mid-edit.
  const nowValue = useMemo(
    () => parseAbsoluteToLocal(new Date().toISOString()),
    []
  )

  // Picking a date in the compare picker should land on midnight, not on
  // whatever o'clock it happens to be — a snapshot at "Aug 25, 14:37" is an
  // accident of when the user clicked, and comparing two such instants makes
  // the boundary between them arbitrary. `toCalendarDateTime` zeroes the time,
  // and react-aria uses this placeholder for the time part of a date chosen
  // from the calendar. Matches the As-Of navbar picker, which already defaults
  // to 00:00.
  const compareTimeDefault = useMemo(
    () => toCalendarDateTime(today(getLocalTimeZone())),
    []
  )

  /**
   * Which instant the Live button set, so the button can tell "comparing with
   * live" from "comparing with a date that happens to be recent" and act as a
   * toggle. Local to the modal: it is a property of this control, not of the
   * comparison, and picking a date in the picker simply stops matching it.
   */
  const [liveCompareIso, setLiveCompareIso] = useState<string | null>(null)
  const isLiveCompare = !!compareAsOfDate && compareAsOfDate === liveCompareIso

  // `nowValue` is fixed at mount, so a "Live" comparison taken minutes later is
  // a moment past it and the picker would flag its own value as out of range.
  // Let the ceiling follow the value it is validating.
  const maxCompareValue = useMemo(() => {
    if (!compareAsOfDate) return nowValue
    const picked = parseAbsoluteToLocal(compareAsOfDate)
    return picked.compare(nowValue) > 0 ? picked : nowValue
  }, [compareAsOfDate, nowValue])
  // The snapshot marker is drawn only when as_of falls inside the shown window;
  // outside it, it would stretch the axis across the gap and squash the data.
  const isAsOfInsideWindow =
    !!asOfDate &&
    !!start &&
    !!end &&
    !dayjs.utc(asOfDate).isBefore(dayjs.utc(start)) &&
    !dayjs.utc(asOfDate).isAfter(dayjs.utc(end))
  // Snapshot-mode notices: informational only, they never mutate as-of.
  const hasData =
    observations.length > 0 ||
    allSeries.some((series) => series.observations.length > 0)
  const showSnapshotNoData =
    isSnapshot && !loading && !error && !!datastream && !hasData
  const snapshotNoDataMessage = showSnapshotNoData
    ? describeSnapshotGap(datastream, start, end, t)
    : null
  // Says that the snapshot window was empty and the chart moved to the latest
  // data that existed at the snapshot, so the dates on screen are never a surprise.
  const fallbackMessage =
    isSnapshot && isAsOfFallback && !loading && !error && hasData && asOfDate
      ? t('as_of.chart.fallback_notice', {
          date: dayjs.utc(asOfDate).format('MMM D, YYYY HH:mm'),
        })
      : null
  // The window currently on screen, restated alongside a notice so the message
  // is unambiguously tied to the dates being shown.
  const shownWindowLabel =
    start && end
      ? `${formatObservationTime(start, utcOffset)} — ${formatObservationTime(end, utcOffset)}`
      : null

  const fmtSnapshot = (iso: string) =>
    `${dayjs.utc(iso).format('MMM D, YYYY HH:mm')} UTC`

  /**
   * Do the two snapshots hold exactly the same measurements?
   *
   * Only meaningful on a shared window — on the aligned axis the two series
   * cover different periods, so equality would say nothing. This is the notice
   * that keeps a *correct* comparison of two unchanged snapshots from reading
   * as a broken one: the dashed overlay alone is easy to misread as one line.
   */
  const compareDiff = useMemo(() => {
    const none = {
      unchanged: false,
      regions: [] as ChangeRegion[],
      valueChanged: 0,
      qualityChanged: 0,
    }
    if (!isComparingSnapshots) return none

    const primaryRows = buildRows(
      observations,
      qualityConstraintsOf(datastream),
      qualityModeOf(datastream)
    )
    const compareRows = buildRows(
      comparisonObservations,
      qualityConstraintsOf(comparisonDatastream ?? datastream),
      qualityModeOf(comparisonDatastream ?? datastream)
    )
    if (primaryRows.length === 0) return none

    // Aligned mode gives each snapshot its own window, and comparing values at
    // equal timestamps means nothing when the windows cover different dates.
    //
    // But they don't always: when both snapshots fall back to the same trailing
    // range — the common case on data whose phenomenonTime predates its
    // insertion — the two series cover exactly the same instants and the
    // comparison is as valid as it is in shared-window mode. Gating on the dates
    // the series actually landed on, rather than on the mode, keeps the verdict
    // wherever it is meaningful and drops it only where it would be a guess.
    if (compareAligned) {
      const sameDomain =
        primaryRows.length === compareRows.length &&
        primaryRows[0]?.ts === compareRows[0]?.ts &&
        primaryRows[primaryRows.length - 1]?.ts ===
          compareRows[compareRows.length - 1]?.ts
      if (!sameDomain) return none
    }

    return computeChangeRegions(primaryRows, compareRows)
  }, [
    isComparingSnapshots,
    compareAligned,
    observations,
    comparisonObservations,
    datastream,
    comparisonDatastream,
  ])

  const compareUnchanged = compareDiff.unchanged

  /**
   * Notice stack — at most one "what am I looking at" line plus one "what is
   * odd about the data" line, so the chart never loses more than two rows.
   */
  const notices = useMemo(() => {
    const stack: Array<{ text: string; tone: 'info' | 'warn' }> = []
    if (loading || error) return stack

    if (isComparingSnapshots && asOfDate && compareAsOfDate) {
      // ── Mode line ────────────────────────────────────────────────────────
      stack.push({
        tone: 'info',
        text: compareAligned
          ? // When a snapshot's own window was empty the chart moved to the
            // newest data that snapshot could see, so the axis no longer ends
            // AT the snapshot — saying otherwise would misread the dates.
            isAsOfFallback
            ? t('as_of.chart.compare_aligned_fallback_notice', {
                days: SNAPSHOT_WINDOW_DAYS,
              })
            : t('as_of.chart.compare_aligned_notice', {
                days: SNAPSHOT_WINDOW_DAYS,
              })
          : t('as_of.chart.compare_shared_notice'),
      })

      // ── Data line ────────────────────────────────────────────────────────
      const primaryEmpty = observations.length === 0
      const compareEmpty = comparisonObservations.length === 0
      if (primaryEmpty && compareEmpty) {
        stack.push({
          tone: 'warn',
          text: t('as_of.chart.compare_no_data_both'),
        })
      } else if (primaryEmpty) {
        stack.push({
          tone: 'warn',
          text: t('as_of.chart.compare_no_data_one', {
            date: fmtSnapshot(asOfDate),
          }),
        })
      } else if (compareEmpty) {
        stack.push({
          tone: 'warn',
          text: t('as_of.chart.compare_no_data_one', {
            date: fmtSnapshot(compareAsOfDate),
          }),
        })
      } else if (compareUnchanged) {
        stack.push({ tone: 'info', text: t('as_of.chart.compare_no_changes') })
      } else if (
        compareDiff.qualityChanged > 0 &&
        compareDiff.valueChanged === 0
      ) {
        // The revision a quality run makes: every measured value identical,
        // every verdict about them rewritten. Nothing in the plotted lines shows
        // it — without this line the chart would look like two agreeing
        // snapshots, which is what it used to claim.
        stack.push({
          tone: 'info',
          text: t('as_of.chart.compare_quality_only', {
            count: compareDiff.qualityChanged,
          }),
        })
      } else if (compareDiff.qualityChanged > 0) {
        stack.push({
          tone: 'info',
          text: t('as_of.chart.compare_quality_and_values', {
            values: compareDiff.valueChanged,
            quality: compareDiff.qualityChanged,
          }),
        })
      } else if (!compareAligned && end) {
        // A shared window running past the earlier snapshot cuts that series
        // short — those measurements had not been recorded yet. That gap is the
        // most informative part of the chart, so it is explained, not hidden.
        //
        // Only when one line genuinely outruns the other, though: if both stop
        // at the same place for an unrelated reason (the datastream's own data
        // simply ends earlier), nothing is cut off and the notice would be a
        // confident explanation of something that is not on screen.
        const primaryIsEarlier = dayjs
          .utc(asOfDate)
          .isBefore(dayjs.utc(compareAsOfDate))
        const earliest = primaryIsEarlier ? asOfDate : compareAsOfDate
        const laterRows = buildRows(
          primaryIsEarlier ? comparisonObservations : observations
        )
        const earliestTs = dayjs.utc(earliest).valueOf()
        const laterOutrunsEarlier = laterRows.some((row) => row.ts > earliestTs)
        if (
          dayjs.utc(end).isAfter(dayjs.utc(earliest)) &&
          laterOutrunsEarlier
        ) {
          stack.push({
            tone: 'info',
            text: t('as_of.chart.compare_cutoff', {
              date: fmtSnapshot(earliest),
            }),
          })
        }
      }
      return stack
    }

    const single = snapshotNoDataMessage ?? fallbackMessage
    if (single) {
      stack.push({
        tone: snapshotNoDataMessage ? 'warn' : 'info',
        text: single,
      })
    }
    return stack
  }, [
    loading,
    error,
    isComparingSnapshots,
    asOfDate,
    compareAsOfDate,
    compareAligned,
    observations,
    comparisonObservations,
    compareUnchanged,
    compareDiff,
    end,
    snapshotNoDataMessage,
    fallbackMessage,
    isAsOfFallback,
    t,
  ])

  /**
   * Amber dashed verticals. On the aligned axis both snapshots sit at offset 0
   * (that is what "aligned" means), so there is one marker; on a shared real
   * window each snapshot gets its own, drawn only when it falls inside the view.
   */
  const snapshotMarkers = useMemo<SnapshotMarker[]>(() => {
    if (!isSnapshot || !asOfDate) return []

    if (isComparingSnapshots && compareAsOfDate) {
      if (compareAligned) {
        return [{ value: 0, label: t('as_of.chart.marker_snapshot') }]
      }
      const insideWindow = (iso: string) =>
        !!start &&
        !!end &&
        !dayjs.utc(iso).isBefore(dayjs.utc(start)) &&
        !dayjs.utc(iso).isAfter(dayjs.utc(end))
      const markers: SnapshotMarker[] = []
      if (insideWindow(asOfDate)) {
        markers.push({
          value: dayjs.utc(asOfDate).valueOf(),
          label: t('as_of.chart.marker_primary'),
        })
      }
      if (insideWindow(compareAsOfDate)) {
        markers.push({
          value: dayjs.utc(compareAsOfDate).valueOf(),
          label: t('as_of.chart.marker_compare'),
        })
      }
      return markers
    }

    return isAsOfInsideWindow
      ? [
          {
            value: dayjs.utc(asOfDate).valueOf(),
            label: t('as_of.chart.marker_snapshot'),
          },
        ]
      : []
  }, [
    isSnapshot,
    asOfDate,
    isComparingSnapshots,
    compareAsOfDate,
    compareAligned,
    start,
    end,
    isAsOfInsideWindow,
    t,
  ])

  /**
   * Axis bounds, in whatever space the axis is in. Pinning matters most when a
   * series is empty or short: without it the chart silently rescales to the
   * data that *is* there and the missing stretch stops being visible.
   */
  const axisWindow = useMemo(() => {
    if (isComparingSnapshots && compareAligned) {
      // Every aligned window is the same width, ending at its own snapshot.
      return { start: -SNAPSHOT_WINDOW_DAYS * DAY_MS, end: 0 }
    }
    if (start && end) {
      return {
        start: dayjs.utc(start).valueOf(),
        end: dayjs.utc(end).valueOf(),
      }
    }
    return { start: null, end: null }
  }, [isComparingSnapshots, compareAligned, start, end])

  return (
    <Modal
      aria-label={t('observations.title')}
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      hideCloseButton
      placement="center"
      scrollBehavior="inside"
      size="5xl"
      backdrop="blur"
      classNames={{
        wrapper: 'z-[6000]',
        // Pinned to 90vh rather than the old 62: everything stacked above the
        // chart is subtracted from this one fixed budget, and in snapshot mode
        // that is the compare strip plus up to two notices — ~160px that used
        // to come straight out of the plot, leaving it shorter than the axis
        // furniture around it. Matches the 94vw already used across.
        base: 'z-[6001] h-[90vh] min-h-[480px] max-h-[90vh] w-[94vw] max-w-[1440px]',
        backdrop: 'z-[5999]',
      }}
    >
      <ModalContent>
        <ModalBody className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 shrink-0 space-y-2 border-b border-default-200 pb-2">
              <ObservationTimeRange
                start={
                  isComparingSnapshots && compareAligned
                    ? null
                    : dataRange
                      ? new Date(dataRange.start).toISOString()
                      : start
                }
                end={
                  isComparingSnapshots && compareAligned
                    ? null
                    : dataRange
                      ? new Date(dataRange.end).toISOString()
                      : end
                }
                utcOffset={utcOffset}
                onOffsetChange={setUtcOffset}
                onApply={onApplyRange}
                onReset={onResetRange}
                loading={loading}
                trailingAction={
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
                }
              />
              <DatastreamControls
                choices={datastreamChoices}
                listedKeys={listedDatastreamKeys}
                activeKeys={selectedDatastreamKeys}
                onToggle={onToggleDatastream}
                onRemove={onRemoveDatastream}
                styles={seriesStyles}
                onStyleChange={saveSeriesAppearance}
                snapshots={isComparingSnapshots}
              />
            </div>
            {/* Comparison gets its own strip instead of a fourth column.
                As a column it was snapshot-only, so entering snapshot mode
                reflowed and narrowed every other control; and it holds two
                controls where the grid allowed one cell's width, leaving the
                field that shows the longest value the narrowest on the row.
                The amber tint is the same snapshot chrome as the navbar chip
                and the badge above. */}
            {isSnapshot && (
              <div
                className="mb-3 flex w-full shrink-0 flex-wrap items-start gap-3 rounded-md px-3 py-2"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}
              >
                {/* Snapshot badge — only visible in As-Of mode */}
                {isSnapshot && asOfDate && (
                  <div
                    className="flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: 'rgba(251,191,36,0.15)',
                      border: '1px solid rgba(251,191,36,0.4)',
                      color: '#b45309',
                    }}
                  >
                    <span>⏱</span>
                    <span>
                      Snapshot —{' '}
                      {dayjs.utc(asOfDate).format('MMM D, YYYY HH:mm')} UTC
                    </span>
                  </div>
                )}
                {/* Comparing against the present is the common case and the one
                    the date picker serves worst — it means reading a clock and
                    typing today's date and time. This fills the same slot in one
                    press, and presses again to undo, so live comparison needs no
                    separate clear control. Bordered and stretched to the row so
                    it reads as a peer of the picker beside it, not a chip stuck
                    onto it. */}
                <Button
                  size="sm"
                  variant={isLiveCompare ? 'solid' : 'bordered'}
                  radius="sm"
                  color="primary"
                  className="h-12 shrink-0 px-3"
                  aria-pressed={isLiveCompare}
                  aria-label={
                    isLiveCompare
                      ? t('as_of.chart.compare_live_stop')
                      : t('as_of.chart.compare_live_hint')
                  }
                  title={
                    isLiveCompare
                      ? t('as_of.chart.compare_live_stop')
                      : t('as_of.chart.compare_live_hint')
                  }
                  onPress={() => {
                    if (isLiveCompare) {
                      setLiveCompareIso(null)
                      onCompareAsOfDateChange?.(null)
                      return
                    }
                    const iso = new Date().toISOString()
                    setLiveCompareIso(iso)
                    onCompareAsOfDateChange?.(iso)
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                  />
                  <span className="whitespace-nowrap text-xs font-semibold">
                    {t('as_of.chart.compare_live')}
                  </span>
                </Button>
                {/* The two controls fill the same slot, so a rule reads them
                    as alternatives rather than as two separate settings. */}
                <span
                  aria-hidden="true"
                  className="hidden h-12 w-px shrink-0 sm:block"
                  style={{ background: 'rgba(251,191,36,0.35)' }}
                />
                <DatePicker
                  label={t('as_of.chart.compare_label')}
                  value={
                    (compareAsOfDate
                      ? parseAbsoluteToLocal(compareAsOfDate)
                      : null) as never
                  }
                  onChange={(value) => {
                    const next = value as unknown as {
                      toDate: (timeZone?: string) => Date
                    } | null
                    onCompareAsOfDateChange?.(
                      next ? next.toDate(timeZone).toISOString() : null
                    )
                  }}
                  maxValue={maxCompareValue as never}
                  placeholderValue={compareTimeDefault as never}
                  // HeroUI pins shouldCloseOnSelect to `!hasTime`, so with a
                  // time granularity picking a day never commits on its own —
                  // it waits for a time that must be typed in full, and until
                  // then choosing a date in the calendar appears to do nothing.
                  // The calendar's own onChange is mergeable (HeroUI chains
                  // `on*` handlers), so the date is committed here at midnight.
                  // The popover stays open afterwards, so a time can still be
                  // set when a same-day comparison needs one.
                  calendarProps={
                    {
                      onChange: (date: unknown) => {
                        const day = date as
                          | Parameters<typeof toCalendarDateTime>[0]
                          | null
                        if (!day) return
                        onCompareAsOfDateChange?.(
                          toCalendarDateTime(day).toDate(timeZone).toISOString()
                        )
                      },
                    } as never
                  }
                  granularity="minute"
                  // The picker reads local time while the snapshot badge and
                  // every notice speak UTC. Echoing the UTC instant keeps the
                  // two from being silently confused for one another.
                  description={
                    compareAsOfDate ? fmtSnapshot(compareAsOfDate) : undefined
                  }
                  variant="bordered"
                  className="w-full sm:w-[268px]"
                  showMonthAndYearPickers
                  hideTimeZone
                  color="primary"
                  size="sm"
                />
                {/* Only for a comparison the toggle cannot undo: a date picked
                    in the field. A live one is cleared by pressing Live again. */}
                {compareAsOfDate && !isLiveCompare && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="sm"
                    className="h-12 shrink-0"
                    aria-label={t('as_of.chart.compare_clear')}
                    title={t('as_of.chart.compare_clear')}
                    onPress={() => onCompareAsOfDateChange?.(null)}
                  >
                    <CloseIcon size={16} />
                  </Button>
                )}
              </div>
            )}
            {notices.map((notice, index) => (
              <div
                key={notice.text}
                className="mb-2 flex shrink-0 items-start gap-2 rounded px-3 py-2 text-xs"
                role="status"
                style={{
                  background:
                    notice.tone === 'warn'
                      ? 'rgba(251,191,36,0.12)'
                      : 'rgba(148,163,184,0.12)',
                  border:
                    notice.tone === 'warn'
                      ? '1px solid rgba(251,191,36,0.4)'
                      : '1px solid rgba(148,163,184,0.35)',
                  color: notice.tone === 'warn' ? '#b45309' : '#475569',
                }}
              >
                <span aria-hidden>{notice.tone === 'warn' ? '⚠' : '⏱'}</span>
                <span>
                  {notice.text}
                  {/* The window is restated once, on the first notice only, so
                      the message is unambiguously tied to the dates on screen. */}
                  {index === 0 && shownWindowLabel && !compareAligned && (
                    <>
                      {' '}
                      <span className="whitespace-nowrap opacity-80">
                        ({shownWindowLabel})
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}
            <div className="min-h-0 flex-1">
              <ObservationGraph
                utcOffset={utcOffset}
                datastream={datastream}
                observations={observations}
                comparisonDatastream={comparisonDatastream}
                comparisonObservations={comparisonObservations}
                allSeries={allSeries}
                activeDatastreamIds={activeDatastreamIds}
                seriesStyles={seriesStyles}
                loading={loading}
                error={error}
                onDownloadAllDatastreams={onDownloadAllDatastreams}
                snapshotMarkers={snapshotMarkers}
                windowStart={axisWindow.start}
                windowEnd={axisWindow.end}
                onDataRangeChange={setDataRange}
                alignedAxis={isComparingSnapshots && compareAligned}
                isCompare={isComparingSnapshots}
                changeRegions={compareDiff.regions}
                asOfDate={isSnapshot ? asOfDate : null}
                height="100%"
              />
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
