'use client'

import { Button } from '@heroui/button'
import { DatePicker, DateRangePicker } from '@heroui/date-picker'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/modal'
import { Select, SelectItem } from '@heroui/select'
import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
  toCalendarDateTime,
  today,
} from '@internationalized/date'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

dayjs.extend(utc)

import { CloseIcon } from '@/components/icons'
import {
  SNAPSHOT_WINDOW_DAYS,
  getSnapshotWindow,
} from '@/features/as-of/lib/snapshotWindow'
import { Datastream, Observation, Thing } from '@/types/domain'

import {
  buildRows,
  computeChangeRegions,
  makeSeriesId,
  type ChangeRegion,
  type SeriesSource,
} from '../lib/observationGraphUtils'
import type { SnapshotMarker } from '../lib/observationGraphOptions'
import { useQualitySchemeResolver } from '../lib/useQualitySchemes'
import CustomizeQualityView, {
  type CustomizeQualityHandle,
  type QualityCustomizeTarget,
} from './customize-quality/CustomizeQualityView'
import ObservationGraph from './ObservationGraph'

const DAY_MS = 24 * 60 * 60 * 1000

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
  allSeries?: SeriesSource[]
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
  const [dataStartIso, dataEndIso] = String(datastream?.phenomenonTime ?? '').split('/')
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
  isSnapshot = false,
  asOfDate = null,
  isAsOfFallback = false,
  compareAsOfDate = null,
  onCompareAsOfDateChange,
  compareAligned = true,
}: ChartModalProps) {
  const { t } = useTranslation()
  const timeZone = getLocalTimeZone()
  const isComparingSnapshots = isSnapshot && !!asOfDate && !!compareAsOfDate
  const resolveScheme = useQualitySchemeResolver()

  /**
   * Which view the modal body shows. The quality rules editor takes the whole
   * body rather than sitting beside the chart: the chart's right edge belongs
   * to the reading details rail, and the modal is already as large as the page
   * allows, so it trades the chart's height for the editor's instead.
   */
  const [view, setView] = useState<'chart' | 'quality'>('chart')
  const customizeRef = useRef<CustomizeQualityHandle | null>(null)
  const closeModal = () => {
    setView('chart')
    onClose()
  }
  // × and Esc step back out of the editor first — through it, so an unsaved
  // draft is never dropped without asking — and only close from the chart.
  const requestClose = () => {
    if (view === 'quality' && customizeRef.current) {
      customizeRef.current.requestExit()
      return
    }
    closeModal()
  }
  // While aligned, each snapshot is on its OWN window and no shared range is in
  // effect — so the picker shows its placeholder. Filling it with the primary
  // snapshot's window would contradict the notice inviting the user to pick one,
  // and re-applying those same dates would silently change mode.
  const rangeValue =
    isComparingSnapshots && compareAligned ? null : toRangeValue(start, end)
  // A snapshot of the future has no meaning — the same rule the as-of picker
  // enforces. Pinned per mount so the constraint object does not change identity
  // on every render and reset the picker mid-edit.
  const nowValue = useMemo(() => parseAbsoluteToLocal(new Date().toISOString()), [])

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
  // The default window a snapshot opens on. It is an anchor, not a bound: the
  // date picker is free to leave it, exactly as in live mode.
  const snapshotWindow = asOfDate ? getSnapshotWindow(asOfDate) : null
  const sameInstant = (a?: string | null, b?: string | null) =>
    !!a && !!b && dayjs.utc(a).valueOf() === dayjs.utc(b).valueOf()
  // True only while the chart shows the as-of anchored window — the one case
  // where the x-axis is pinned, so a sparse snapshot still draws its full 7 days.
  const isAsOfDefaultWindow =
    isSnapshot &&
    sameInstant(start, snapshotWindow?.startIso) &&
    sameInstant(end, snapshotWindow?.endIso)
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
      ? `${dayjs.utc(start).format('MMM D, YYYY HH:mm')} — ${dayjs
          .utc(end)
          .format('MMM D, YYYY HH:mm')} UTC`
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

    // One scheme for both sides: they are the same datastream, and judging the
    // two snapshots under different rules would report a rule change as a
    // change in the data.
    const scheme = resolveScheme(datastream).scheme
    const primaryRows = buildRows(observations, scheme)
    const compareRows = buildRows(comparisonObservations, scheme)
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
    resolveScheme,
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
        stack.push({ tone: 'warn', text: t('as_of.chart.compare_no_data_both') })
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
        if (dayjs.utc(end).isAfter(dayjs.utc(earliest)) && laterOutrunsEarlier) {
          stack.push({
            tone: 'info',
            text: t('as_of.chart.compare_cutoff', { date: fmtSnapshot(earliest) }),
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
    const pinToShownWindow = isComparingSnapshots || isAsOfDefaultWindow
    if (pinToShownWindow && start && end) {
      return { start: dayjs.utc(start).valueOf(), end: dayjs.utc(end).valueOf() }
    }
    return { start: null, end: null }
  }, [isComparingSnapshots, compareAligned, isAsOfDefaultWindow, start, end])
  /**
   * The datastreams the rules editor can write rules for: the ones plotted,
   * each with the readings on screen. A snapshot comparison is one datastream
   * seen twice, so only its primary snapshot is offered.
   */
  const qualityTargets = useMemo<QualityCustomizeTarget[]>(() => {
    const keyOf = (ds: Datastream) =>
      `${String(ds?.__sourceEndpoint ?? '')}::${String(ds?.['@iot.id'] ?? ds?.id ?? '')}`
    if (!isComparingSnapshots && allSeries.length > 0) {
      const plotted = allSeries.filter((series) =>
        activeDatastreamIds.includes(
          makeSeriesId(
            String(series.datastream?.['@iot.id'] ?? series.datastream?.id ?? ''),
            series.asOf
          )
        )
      )
      return (plotted.length ? plotted : allSeries.slice(0, 1)).map((series) => ({
        key: keyOf(series.datastream),
        datastream: series.datastream,
        observations: series.observations,
      }))
    }
    if (!datastream) return []
    return [
      { key: keyOf(datastream), datastream, observations },
      ...(!isComparingSnapshots && comparisonDatastream
        ? [
            {
              key: keyOf(comparisonDatastream),
              datastream: comparisonDatastream,
              observations: comparisonObservations,
            },
          ]
        : []),
    ]
  }, [
    isComparingSnapshots,
    allSeries,
    activeDatastreamIds,
    datastream,
    observations,
    comparisonDatastream,
    comparisonObservations,
  ])

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
      onOpenChange={(open) => !open && requestClose()}
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
        <ModalHeader className="flex items-center justify-between gap-3 pb-0">
          <div className="min-w-0">
            {view === 'quality' ? (
              // A breadcrumb, so the way back to the chart is where the
              // title was — and the title still says where the reader is.
              <div className="flex min-w-0 items-center gap-2 text-base font-semibold">
                <button
                  type="button"
                  className="shrink-0 font-medium text-default-500 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  title={t('quality.customize.back_to_chart')}
                  onClick={requestClose}
                >
                  Observations
                </button>
                <span aria-hidden className="font-normal text-default-400">
                  ›
                </span>
                <span className="truncate">{t('quality.customize.title')}</span>
              </div>
            ) : (
              <div className="truncate text-base font-semibold">Observations</div>
            )}
          </div>
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
                Snapshot — {dayjs.utc(asOfDate).format('MMM D, YYYY HH:mm')} UTC
              </span>
            </div>
          )}
          <Button
            isIconOnly
            size="sm"
            className="h-6 w-6 min-w-6"
            radius="none"
            variant="light"
            aria-label={
              view === 'quality'
                ? t('quality.customize.back_to_chart')
                : t('general.close')
            }
            onPress={requestClose}
          >
            <CloseIcon size={18} />
          </Button>
        </ModalHeader>
        <ModalBody className="h-full overflow-hidden p-4 pt-2">
          {view === 'quality' ? (
            <CustomizeQualityView
              ref={customizeRef}
              targets={qualityTargets}
              windowLabel={shownWindowLabel}
              onExit={() => setView('chart')}
            />
          ) : (
          <div className="flex h-full min-h-0 flex-col">
            {/* Three controls in BOTH modes. Comparison used to be a fourth
                column here, which reflowed and narrowed every other control the
                moment the user time-travelled; it now lives in its own strip
                below, so this row is stable across modes. */}
            <div className="mb-3 grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
            <Select
              label="Thing"
              labelPlacement="inside"
              placeholder="Select thing(s)"
              variant="bordered"
              radius="sm"
              size="sm"
              color="primary"
              className="w-full"
              // Comparing snapshots spends both comparison slots, so the chart
              // is down to one series' worth of selection: one thing, one
              // property, switchable but not combinable.
              selectionMode={isComparingSnapshots ? 'single' : 'multiple'}
              disallowEmptySelection={isComparingSnapshots}
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
              selectionMode={isComparingSnapshots ? 'single' : 'multiple'}
              disallowEmptySelection={isComparingSnapshots}
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
                  // The picked range is used as-is in both modes — As-Of mode
                  // adds no bounds of its own. Fetches keep sending `$as_of`,
                  // so any range still shows the data as of the snapshot.
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
                        const day = date as Parameters<
                          typeof toCalendarDateTime
                        >[0] | null
                        if (!day) return
                        onCompareAsOfDateChange?.(
                          toCalendarDateTime(day)
                            .toDate(timeZone)
                            .toISOString()
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
                snapshotMarkers={snapshotMarkers}
                windowStart={axisWindow.start}
                windowEnd={axisWindow.end}
                alignedAxis={isComparingSnapshots && compareAligned}
                isCompare={isComparingSnapshots}
                changeRegions={compareDiff.regions}
                asOfDate={isSnapshot ? asOfDate : null}
                onCustomizeQuality={
                  qualityTargets.length > 0 ? () => setView('quality') : undefined
                }
                height="100%"
              />
            </div>
          </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
