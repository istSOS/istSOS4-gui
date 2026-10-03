import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useMemo, useRef, useState } from 'react'

import { siteConfig } from '@/config/site'
import { getSnapshotWindow } from '@/features/as-of/lib/snapshotWindow'
import {
  getLiveDefaultWindow,
  getWindowEndingAt,
} from '@/features/observations/lib/observationWindow'
import { getDataSourceToken } from '@/lib/dataSourceTokens'
import {
  datastreamIdFromSeriesId,
  makeSeriesId,
  type SeriesSource,
} from '@/features/observations/lib/observationGraphUtils'
import {
  getLatestObservationTime,
  getObservationsByDatastream,
} from '@/services/observations'
import { Datastream, Observation, Thing } from '@/types/domain'

import { getThingKey } from './utils'

dayjs.extend(utc)

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function useChartState({
  localThings,
  liveThings,
  thingsResolvedFor,
  token,
  asOfDate,
}: {
  /** The Things in view: the snapshot list in snapshot mode, else the live one. */
  localThings: Thing[]
  /** The live list — where a Thing absent at the snapshot is still found. */
  liveThings: Thing[]
  /** The instant `localThings` belongs to (null when live). */
  thingsResolvedFor: string | null
  token?: string | null
  asOfDate?: string | null
}) {
  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [selectedObservedPropertyName, setSelectedObservedPropertyName] =
    useState<string | null>(null)
  const [tableObservedPropertyFilter, setTableObservedPropertyFilter] =
    useState<string | null>(null)
  const [selectedThingKeysForChart, setSelectedThingKeysForChart] = useState<
    string[]
  >([])
  const [
    selectedObservedPropertyNamesForChart,
    setSelectedObservedPropertyNamesForChart,
  ] = useState<string[]>([])
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [selectedDatastream, setSelectedDatastream] =
    useState<Datastream | null>(null)
  const [comparisonDatastream, setComparisonDatastream] =
    useState<Datastream | null>(null)
  const [activeDatastreamIds, setActiveDatastreamIds] = useState<string[]>([])
  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)
  const [obsStart, setObsStart] = useState<string | null>(null)
  const [obsEnd, setObsEnd] = useState<string | null>(null)
  // True when the As-Of window held no observations and the chart fell back to
  // the live-mode window (the 7 days ending at the last measurement that
  // existed at the snapshot). Purely informational — drives the modal notice.
  const [asOfWindowFallback, setAsOfWindowFallback] = useState(false)
  // False once the user picks a range in the date picker: their choice is then
  // carried across selection changes untouched, exactly as in live mode. True
  // means obsStart/obsEnd is a computed default that may be re-resolved.
  const windowIsAutoRef = useRef(true)
  const obsCacheRef = useRef<Map<string, Observation[]>>(new Map())
  // Tracks the asOfDate context that obsStart/obsEnd + cache belong to, so a
  // range left over from a different snapshot (or from live mode) is never
  // reused when the snapshot context changes.
  const prevAsOfRef = useRef(asOfDate)
  // Trailing-edge timer for the open-chart refetch (keeps continuous scrubber
  // dragging from firing a network request on every tick).
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when asOfDate moves while the chart may need refetching; consumed once
  // the Things for the new instant have arrived.
  const pendingChartRefetchRef = useRef<{
    range: { start: string | null; end: string | null }
  } | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [comparisonObservations, setComparisonObservations] = useState<
    Observation[]
  >([])
  const [allSeries, setAllSeries] = useState<SeriesSource[]>([])
  // ── As-Of snapshot comparison ────────────────────────────────────────────
  // The second snapshot to compare the current one against. Null (the default)
  // leaves every behaviour below exactly as it was. Purely chart-local: it
  // never touches the global asOfDate, so map, table and scrubber stay put.
  const [compareAsOfDate, setCompareAsOfDate] = useState<string | null>(null)
  // Mirror of compareAsOfDate for the async loaders below. They read it in the
  // same tick it changes, before React has re-rendered, so the state value in
  // their closure would still be the previous one.
  const compareAsOfRef = useRef<string | null>(null)
  // True while comparing on the *aligned* axis: each snapshot shows its own
  // 7 days ending at itself, laid on top of each other by offset. Flips to
  // false the moment the user picks an explicit range, which puts both
  // snapshots on one shared real window (the revision view).
  const [compareAligned, setCompareAligned] = useState(true)
  const isComparingSnapshots = !!asOfDate && !!compareAsOfDate

  // The last object a selection resolved to, so a Thing that exists neither at
  // the snapshot nor now (deleted, then scrubbed to before its creation) can
  // stay selected and be reported, instead of the panel silently closing.
  const retainedThingsRef = useRef<Map<string, Thing>>(new Map())

  /**
   * The Thing a key refers to in the current view. In snapshot mode a Thing
   * that did not exist at the instant is still returned — from the live list,
   * or as last seen — because the panel and the existence dialog must be able
   * to say "this did not exist then". Its snapshot resolution (useAsOfThing)
   * decides what is shown. In live mode only the live list counts: a Thing
   * gone from it is gone.
   */
  const resolveThingByKey = (
    key: string,
    keyOf: (thing: Thing) => string = getThingKey
  ): Thing | null => {
    const inView = localThings.find((thing) => keyOf(thing) === key)
    if (inView) return inView
    if (!asOfDate) return null
    return (
      liveThings.find((thing) => keyOf(thing) === key) ??
      Array.from(retainedThingsRef.current.values()).find(
        (thing) => keyOf(thing) === key
      ) ??
      null
    )
  }

  const selectedThing = useMemo(
    () => (selectedThingId ? resolveThingByKey(selectedThingId) : null),
    // resolveThingByKey reads exactly these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localThings, liveThings, selectedThingId, asOfDate]
  )

  useEffect(() => {
    if (selectedThing && selectedThingId) {
      retainedThingsRef.current.set(selectedThingId, selectedThing)
    }
  }, [selectedThing, selectedThingId])

  const isPanelOpen = !!selectedThing
  const thingKeyFor = (thing: Thing) =>
    `${String(thing?.__sourceId ?? thing?.__sourceEndpoint ?? '0')}::${String(
      thing?.['@iot.id'] ?? thing?.id ?? thing?.name ?? ''
    )}`

  const resetChartState = () => {
    setIsChartOpen(false)
    setSelectedDatastream(null)
    setComparisonDatastream(null)
    setActiveDatastreamIds([])
    setObservations([])
    setComparisonObservations([])
    setAllSeries([])
    setObsError(null)
    setObsLoading(false)
    setObsStart(null)
    setObsEnd(null)
    setAsOfWindowFallback(false)
    compareAsOfRef.current = null
    setCompareAsOfDate(null)
    setCompareAligned(true)
    windowIsAutoRef.current = true
    // Cancel any pending trailing-edge refetch so it can't fire after close
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current)
      refetchTimerRef.current = null
    }
    // Clear cache so snapshot results never bleed into live mode and vice versa
    obsCacheRef.current.clear()
  }

  const closePanel = () => {
    setSelectedThingId(null)
    setSelectedObservedPropertyName(null)
    setTableObservedPropertyFilter(null)
    resetChartState()
  }

  const fetchObservations = async (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string,
    // Compare mode reads ONE datastream at TWO snapshots, so the snapshot can
    // no longer be implied by the hook's asOfDate — it is named per fetch.
    // Undefined (not null) means "use the current asOfDate".
    asOfOverride?: string | null
  ) => {
    let startIso = range?.start ?? null
    let endIso = range?.end ?? null
    const resolvedEndpoint =
      sourceEndpoint?.trim().replace(/\/+$/, '') ?? siteConfig.api_root
    const effectiveAsOf = asOfOverride !== undefined ? asOfOverride : asOfDate

    if (!startIso || !endIso) {
      // No range asked for: anchor the default window on the snapshot in As-Of
      // mode, on the datastream's last measurement in live mode. A range that
      // IS asked for is always honoured as-is — in As-Of mode too — so the date
      // picker behaves the same in both modes. The `$as_of` parameter below is
      // what keeps the result a snapshot, not the width of the window.
      const defaultWindow = effectiveAsOf
        ? getSnapshotWindow(effectiveAsOf)
        : getLiveDefaultWindow(phenomenonTime)
      startIso = startIso ?? defaultWindow.startIso
      endIso = endIso ?? defaultWindow.endIso
    }

    // Namespace cache key by the snapshot actually queried, so the two halves
    // of a comparison (same datastream, same window, different `$as_of`) get
    // separate entries instead of the second reading back the first.
    const cacheKey = `${resolvedEndpoint}|${datastreamId}|${startIso}|${endIso}|${effectiveAsOf ?? 'live'}`
    const cached = obsCacheRef.current.get(cacheKey)
    if (cached) return { data: cached, startIso, endIso }

    const sourceToken = getDataSourceToken(resolvedEndpoint)
    const { observationData } = await getObservationsByDatastream(
      sourceToken ?? token ?? undefined,
      datastreamId,
      startIso ?? undefined,
      endIso ?? undefined,
      resolvedEndpoint,
      effectiveAsOf ?? null
    )
    obsCacheRef.current.set(cacheKey, observationData)
    return { data: observationData, startIso, endIso }
  }

  /**
   * The window a chart opens on in As-Of mode, for the datastream that drives
   * the selection.
   *
   * Default is the snapshot window [as_of-7d, as_of] — the slice of time the
   * snapshot is about. When that window holds no observations, showing an empty
   * chart for a datastream that *does* have data at this snapshot is useless,
   * so it falls back to the live-mode window: the 7 days ending at the last
   * measurement that existed at `as_of` (found with a top-1 `$as_of` probe, so
   * it never reaches past the snapshot into data written later).
   *
   * When the datastream has no observations at all at this point in time, the
   * snapshot window is kept and the modal shows its "no data" notice.
   */
  const resolveAsOfDefaultWindow = async (
    asOf: string,
    datastreamId: string,
    phenomenonTime?: string,
    sourceEndpoint?: string
  ) => {
    const snapshotWindow = getSnapshotWindow(asOf)
    const resolvedEndpoint =
      sourceEndpoint?.trim().replace(/\/+$/, '') ?? siteConfig.api_root

    try {
      const probe = await fetchObservations(
        datastreamId,
        phenomenonTime,
        { start: snapshotWindow.startIso, end: snapshotWindow.endIso },
        resolvedEndpoint
      )
      if (probe.data.length > 0) {
        return { ...snapshotWindow, isFallback: false }
      }

      const sourceToken = getDataSourceToken(resolvedEndpoint)
      const latest = await getLatestObservationTime(
        sourceToken ?? token ?? undefined,
        datastreamId,
        resolvedEndpoint,
        asOf
      )
      if (!latest) return { ...snapshotWindow, isFallback: false }

      return { ...getWindowEndingAt(latest), isFallback: true }
    } catch {
      // A failing probe must never block the chart — open on the snapshot
      // window and let the real fetch below report the error.
      return { ...snapshotWindow, isFallback: false }
    }
  }

  const loadPrimaryObservations = async (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string
  ) => {
    setObsLoading(true)
    setObsError(null)
    try {
      const result = await fetchObservations(
        datastreamId,
        phenomenonTime,
        range,
        sourceEndpoint
      )
      setObservations(result.data)
      setObsStart(result.startIso)
      setObsEnd(result.endIso)
    } catch (error: unknown) {
      setObsError(toErrorMessage(error, 'Failed to load observations'))
      setObservations([])
    } finally {
      setObsLoading(false)
    }
  }

  const loadComparisonObservations = async (
    ds: Datastream | null,
    range?: { start?: string | null; end?: string | null }
  ) => {
    if (!ds) {
      setComparisonObservations([])
      return
    }
    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
    if (!dsId) {
      setComparisonObservations([])
      return
    }
    const sourceEndpoint = String(
      ds?.__sourceEndpoint ?? selectedThing?.__sourceEndpoint ?? siteConfig.api_root
    )
    const result = await fetchObservations(
      dsId,
      ds?.phenomenonTime,
      range,
      sourceEndpoint
    )
    setComparisonObservations(result.data)
  }

  /**
   * As-Of comparison: read ONE datastream at BOTH snapshots and install the
   * result as the chart's two series.
   *
   * Two window regimes, matching the two things a user can mean:
   *
   *  - **aligned** (no explicit range) — each snapshot reads its own
   *    `[snapshot-7d, snapshot]`. Neither side can come back empty for the
   *    trivial reason that its data had not been recorded yet, and the aligned
   *    x-axis lays the two windows on top of one another by offset.
   *  - **explicit range** — both snapshots read the SAME real window. This is
   *    the revision view: whatever differs is a correction, a late arrival or
   *    a deletion that happened between the two snapshots.
   *
   * The empty-window fallback that plain As-Of mode applies is deliberately
   * NOT used here. It re-anchors a window to the last measurement, which would
   * silently leave the two series on different windows — a comparison that
   * looks fine and means nothing. An empty side is surfaced as a notice instead.
   */
  const loadCompareSnapshots = async (
    primaryDs: Datastream | null,
    compareDate: string,
    range?: { start?: string | null; end?: string | null }
  ) => {
    if (!asOfDate || !primaryDs) return
    const dsId = String(primaryDs?.['@iot.id'] ?? primaryDs?.id ?? '').trim()
    if (!dsId) return

    const sourceEndpoint = String(
      primaryDs?.__sourceEndpoint ??
        selectedThing?.__sourceEndpoint ??
        siteConfig.api_root
    )
    const hasExplicitRange = !!(range?.start && range?.end)

    // Aligned mode gives each snapshot its OWN trailing window, resolved the
    // same way a single-snapshot As-Of chart resolves its default: the literal
    // [snapshot-7d, snapshot], or — when that comes up empty — the last 7 days
    // of data that existed at that snapshot.
    //
    // The fallback is what makes this comparison work at all on data whose
    // phenomenonTime predates its insertion. `$as_of` is a SYSTEM time while the
    // window is applied to PHENOMENON time, so for such data no snapshot exists
    // whose literal preceding 7 days hold anything: before insertion the rows do
    // not exist, and after it they are already older than the window. Without
    // the fallback both series are permanently empty.
    const [primaryWindow, compareWindow] = hasExplicitRange
      ? [null, null]
      : await Promise.all([
          resolveAsOfDefaultWindow(
            asOfDate,
            dsId,
            primaryDs?.phenomenonTime,
            sourceEndpoint
          ),
          resolveAsOfDefaultWindow(
            compareDate,
            dsId,
            primaryDs?.phenomenonTime,
            sourceEndpoint
          ),
        ])

    const windowFor = (snapshot: string) => {
      if (hasExplicitRange) return { start: range?.start, end: range?.end }
      const own = snapshot === asOfDate ? primaryWindow : compareWindow
      return { start: own?.startIso, end: own?.endIso }
    }

    const [primaryResult, compareResult] = await Promise.all([
      fetchObservations(
        dsId,
        primaryDs?.phenomenonTime,
        windowFor(asOfDate),
        sourceEndpoint,
        asOfDate
      ),
      fetchObservations(
        dsId,
        primaryDs?.phenomenonTime,
        windowFor(compareDate),
        sourceEndpoint,
        compareDate
      ),
    ])

    setSelectedDatastream(primaryDs)
    setComparisonDatastream(primaryDs)
    setObservations(primaryResult.data)
    setComparisonObservations(compareResult.data)
    setAllSeries([
      {
        datastream: primaryDs,
        observations: primaryResult.data,
        asOf: asOfDate,
        // Anchor the aligned axis at each window's END rather than at the
        // snapshot itself: when a window fell back to older data, its points sit
        // weeks before the snapshot, and only the end lines the two windows up.
        anchorIso: primaryWindow?.endIso ?? asOfDate,
      },
      {
        datastream: primaryDs,
        observations: compareResult.data,
        asOf: compareDate,
        anchorIso: compareWindow?.endIso ?? compareDate,
      },
    ])
    // Both snapshots are always active — comparison has exactly two slots and
    // they are both spoken for, so the legend cannot add a third.
    setActiveDatastreamIds([
      makeSeriesId(dsId, asOfDate),
      makeSeriesId(dsId, compareDate),
    ])
    setCompareAligned(!hasExplicitRange)
    // Either snapshot falling back is worth saying: the axis no longer ends at
    // the snapshot instant, it ends at the newest data that snapshot could see.
    setAsOfWindowFallback(
      !!primaryWindow?.isFallback || !!compareWindow?.isFallback
    )
    // The displayed range tracks the *primary* snapshot's window in both
    // regimes; while aligned, the second snapshot's window is its own mirror
    // of it and the modal's notice says so.
    setObsStart(primaryResult.startIso)
    setObsEnd(primaryResult.endIso)
  }

  const loadAllDatastreamObservationsForThing = async (
    thing: Thing,
    range?: { start?: string | null; end?: string | null },
    options?: { observedPropertyNameFilter?: string | null }
  ) => {
    const allThingDatastreams = Array.isArray(thing?.Datastreams) ? thing.Datastreams : []
    const filterName = String(options?.observedPropertyNameFilter ?? '')
      .trim()
      .toLowerCase()
    const thingDatastreams = filterName
      ? allThingDatastreams.filter((ds) =>
          String(ds?.ObservedProperty?.name ?? '')
            .trim()
            .toLowerCase()
            .includes(filterName)
        )
      : allThingDatastreams
    const entries = await Promise.all(
      thingDatastreams.map(async (ds) => {
        const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
        if (!dsId) return { datastream: ds, observations: [] as Observation[] }
        const sourceEndpoint = String(
          ds?.__sourceEndpoint ?? thing?.__sourceEndpoint ?? siteConfig.api_root
        )
        const result = await fetchObservations(
          dsId,
          ds?.phenomenonTime,
          range,
          sourceEndpoint
        )
        return { datastream: ds, observations: result.data }
      })
    )
    setAllSeries(entries)
  }

  const openChartForThingAndObservedProperties = async (
    thingKeys: string[],
    observedPropertyNames: string[],
    preferredDatastreamId?: string,
    // When provided, overrides the current obsStart/obsEnd for the fetch — used
    // by the asOfDate effect to force a fresh default window (null range) on the
    // whole selection instead of reusing a range from the previous snapshot.
    rangeOverride?: { start?: string | null; end?: string | null },
    // When provided, keeps this active datastream selection instead of
    // collapsing to the primary (preserves comparisons across snapshot changes).
    activeIdsOverride?: string[]
  ) => {
    setIsChartOpen(true)
    const keys = Array.from(new Set(thingKeys)).filter(Boolean)
    const ops = Array.from(new Set(observedPropertyNames.map((name) => name.trim()).filter(Boolean)))
    setSelectedThingKeysForChart(keys)
    setSelectedObservedPropertyNamesForChart(ops)

    // Resolved like the panel selection, so a Thing missing at this instant
    // stays in the chart (showing no data then) rather than dropping out and
    // taking the selection — and the panel — with it.
    const selectedThingsForChart = keys
      .map((key) => resolveThingByKey(key, thingKeyFor))
      .filter((thing): thing is Thing => !!thing)
    const primaryThing = selectedThingsForChart[0] ?? null
    setSelectedThingId(primaryThing ? getThingKey(primaryThing) : null)
    setSelectedObservedPropertyName(ops[0] ?? null)

    const datastreamCandidates = selectedThingsForChart.flatMap((thing) =>
      (Array.isArray(thing?.Datastreams) ? thing.Datastreams : []).filter(
        (ds) =>
          ops.length === 0 ||
          ops.some(
            (op) =>
              String(ds?.ObservedProperty?.name ?? '').trim().toLowerCase() ===
              op.toLowerCase()
          )
      )
    )
    const preferredId = String(preferredDatastreamId ?? '').trim()
    const primaryDatastream =
      (preferredId
        ? datastreamCandidates.find(
            (ds) =>
              String(ds?.['@iot.id'] ?? ds?.id ?? '').trim() === preferredId
          )
        : null) ??
      datastreamCandidates[0] ??
      null
    // Preserve an existing active selection (e.g. a two-datastream comparison)
    // when the caller passes one — used by the asOfDate refetch so moving the
    // snapshot re-fetches every series without collapsing back to the primary.
    const overrideActiveIds = (activeIdsOverride ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean)
    const findCandidateById = (id: string) =>
      datastreamCandidates.find(
        (ds) => String(ds?.['@iot.id'] ?? ds?.id ?? '').trim() === id
      ) ?? null
    const secondaryDatastream =
      overrideActiveIds[1] ? findCandidateById(overrideActiveIds[1]) : null
    setSelectedDatastream(primaryDatastream)
    setComparisonDatastream(secondaryDatastream)
    setComparisonObservations([])
    setActiveDatastreamIds(
      overrideActiveIds.length
        ? overrideActiveIds
        : primaryDatastream
          ? [String(primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? '')]
          : []
    )

    const nextSeries: Array<{
      datastream: Datastream
      observations: Observation[]
    }> = []
    let resolvedStart: string | null = null
    let resolvedEnd: string | null = null
    const primaryId = String(
      primaryDatastream?.['@iot.id'] ?? primaryDatastream?.id ?? ''
    ).trim()
    const primaryEndpoint = String(
      primaryDatastream?.__sourceEndpoint ??
        primaryThing?.__sourceEndpoint ??
        siteConfig.api_root
    )

    // A range the user picked in the date picker is carried over untouched — in
    // As-Of mode as much as in live mode. Only a *computed* default is
    // re-resolved for this selection, and only in As-Of mode, where it may fall
    // back to the live-mode window (see resolveAsOfDefaultWindow). Live mode
    // keeps carrying whatever range is on screen, as it always has.
    const explicitRange =
      rangeOverride?.start && rangeOverride?.end
        ? { start: rangeOverride.start, end: rangeOverride.end }
        : !rangeOverride && !windowIsAutoRef.current && obsStart && obsEnd
          ? { start: obsStart, end: obsEnd }
          : null
    windowIsAutoRef.current = !explicitRange

    // As-Of comparison replaces the multi-datastream fetch entirely: one
    // datastream read at two snapshots. All the selection bookkeeping above
    // still applies — only what is fetched behind the chart differs.
    const activeCompareDate = compareAsOfRef.current
    if (asOfDate && activeCompareDate && primaryDatastream) {
      await loadCompareSnapshots(
        primaryDatastream,
        activeCompareDate,
        explicitRange ?? undefined
      )
      return
    }

    let fetchRange: { start?: string | null; end?: string | null } =
      explicitRange ?? rangeOverride ?? { start: obsStart, end: obsEnd }
    let fallbackApplied = false
    if (!explicitRange && asOfDate && primaryId) {
      const autoWindow = await resolveAsOfDefaultWindow(
        asOfDate,
        primaryId,
        primaryDatastream?.phenomenonTime,
        primaryEndpoint
      )
      fetchRange = { start: autoWindow.startIso, end: autoWindow.endIso }
      fallbackApplied = autoWindow.isFallback
    }
    setAsOfWindowFallback(fallbackApplied)

    for (const ds of datastreamCandidates) {
      const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
      if (!dsId) continue
      const sourceEndpoint = String(
        ds?.__sourceEndpoint ?? primaryThing?.__sourceEndpoint ?? siteConfig.api_root
      )
      const result = await fetchObservations(
        dsId,
        ds?.phenomenonTime,
        fetchRange,
        sourceEndpoint
      )
      nextSeries.push({ datastream: ds, observations: result.data })
      if (dsId === primaryId) {
        resolvedStart = result.startIso ?? null
        resolvedEnd = result.endIso ?? null
      }
    }
    setAllSeries(nextSeries)
    setObservations(nextSeries[0]?.observations ?? [])
    if (resolvedStart && resolvedEnd) {
      setObsStart(resolvedStart)
      setObsEnd(resolvedEnd)
    }
  }

  const openChartForDatastream = async (ds: Datastream) => {
    const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
    if (!dsId) {
      setObsError('Missing datastream id')
      setObservations([])
      return
    }
    const thingKeys =
      selectedThing && thingKeyFor(selectedThing) ? [thingKeyFor(selectedThing)] : []
    const opName = String(ds?.ObservedProperty?.name ?? '').trim()
    const observedPropertyNames =
      tableObservedPropertyFilter && tableObservedPropertyFilter.trim()
        ? [tableObservedPropertyFilter.trim()]
        : opName
          ? [opName]
          : []
    await openChartForThingAndObservedProperties(
      thingKeys,
      observedPropertyNames,
      dsId
    )
  }

  const applyObservationRange = async (start?: string | null, end?: string | null) => {
    const isExplicitRange = !!(start && end)
    windowIsAutoRef.current = !isExplicitRange

    // While comparing snapshots the range is what decides WHICH comparison the
    // user is looking at: cleared means each snapshot on its own trailing
    // window (aligned), set means both on one shared window (revisions).
    const activeCompareDate = compareAsOfRef.current
    if (asOfDate && activeCompareDate && selectedDatastream) {
      setObsLoading(true)
      setObsError(null)
      try {
        await loadCompareSnapshots(
          selectedDatastream,
          activeCompareDate,
          isExplicitRange ? { start, end } : undefined
        )
      } catch (error: unknown) {
        setObsError(toErrorMessage(error, 'Failed to load observations'))
      } finally {
        setObsLoading(false)
      }
      return
    }

    // Cleared range → back to the default window for the current selection,
    // resolved the same way the chart resolves it when it opens (in As-Of mode
    // that includes the fallback to the live-mode window).
    if (!isExplicitRange) {
      setObsLoading(true)
      try {
        await openChartForThingAndObservedProperties(
          selectedThingKeysForChart,
          selectedObservedPropertyNamesForChart,
          datastreamIdFromSeriesId(activeDatastreamIds[0] ?? ''),
          { start: null, end: null },
          activeDatastreamIds
        )
      } catch (error: unknown) {
        setObsError(toErrorMessage(error, 'Failed to load observations'))
      } finally {
        setObsLoading(false)
      }
      return
    }

    // An explicit range is fetched exactly as asked, in both modes.
    setAsOfWindowFallback(false)
    const dsId = String(selectedDatastream?.['@iot.id'] ?? selectedDatastream?.id ?? '')
    if (!dsId) return
    const sourceEndpoint = String(
      selectedDatastream?.__sourceEndpoint ??
        selectedThing?.__sourceEndpoint ??
        siteConfig.api_root
    )
    await loadPrimaryObservations(
      dsId,
      selectedDatastream?.phenomenonTime,
      { start, end },
      sourceEndpoint
    )
    if (comparisonDatastream) {
      try {
        await loadComparisonObservations(comparisonDatastream, { start, end })
      } catch (error: unknown) {
        setObsError(toErrorMessage(error, 'Failed to load observations'))
      }
    }
    if (selectedThing) {
      await loadAllDatastreamObservationsForThing(
        selectedThing,
        { start, end },
        { observedPropertyNameFilter: selectedObservedPropertyName }
      )
    }
  }

  /**
   * Turn snapshot comparison on (an ISO datetime) or off (null).
   *
   * Switching it on collapses the selection to a single thing + observed
   * property: the chart has exactly two comparison slots and both are now
   * spent on snapshots. Switching it off restores ordinary As-Of behaviour —
   * multi-select, default window and empty-window fallback included.
   */
  const changeCompareAsOfDate = async (nextDate: string | null) => {
    compareAsOfRef.current = nextDate
    setCompareAsOfDate(nextDate)

    // Whatever window is on screen when comparison is switched on stays in
    // effect — including one resolved automatically (the As-Of default or the
    // empty-window fallback). It is the period the user is already looking at,
    // and blanking the range box at the very moment they pick a compare date
    // reads as the chart throwing their view away.
    //
    // So comparison opens on a shared window and can answer "what changed here"
    // straight away. Aligned mode — each snapshot on its own trailing window —
    // stays reachable by clearing the range, which is a deliberate act rather
    // than a side effect of turning comparison on.
    const keptRange =
      obsStart && obsEnd ? { start: obsStart, end: obsEnd } : null
    setCompareAligned(!keptRange)
    windowIsAutoRef.current = !keptRange

    const preferredId = datastreamIdFromSeriesId(activeDatastreamIds[0] ?? '')
    // Both slots go to snapshots, so only the primary thing/property survives.
    const thingKeys = nextDate
      ? selectedThingKeysForChart.slice(0, 1)
      : selectedThingKeysForChart
    const observedPropertyNames = nextDate
      ? selectedObservedPropertyNamesForChart.slice(0, 1)
      : selectedObservedPropertyNamesForChart

    setObsLoading(true)
    setObsError(null)
    try {
      await openChartForThingAndObservedProperties(
        thingKeys,
        observedPropertyNames,
        preferredId,
        keptRange ?? { start: null, end: null }
      )
    } catch (error: unknown) {
      setObsError(toErrorMessage(error, 'Failed to load observations'))
    } finally {
      setObsLoading(false)
    }
  }

  const changeActiveDatastreams = async (nextDatastreamIds: string[]) => {
    // Comparing snapshots fills both slots by definition — the legend can
    // toggle visibility but must not re-assign what is being compared.
    if (compareAsOfRef.current) return

    const normalizedIdsRaw = Array.from(
      new Set(nextDatastreamIds.map((id) => String(id).trim()).filter(Boolean))
    ).slice(0, 2)
    const currentPrimaryId = String(activeDatastreamIds[0] ?? '')
    const normalizedIds = [...normalizedIdsRaw]
    if (
      currentPrimaryId &&
      normalizedIds.length > 1 &&
      normalizedIds.includes(currentPrimaryId) &&
      normalizedIds[0] !== currentPrimaryId
    ) {
      normalizedIds.splice(normalizedIds.indexOf(currentPrimaryId), 1)
      normalizedIds.unshift(currentPrimaryId)
    }
    setActiveDatastreamIds(normalizedIds)

    const getById = (id: string) =>
      allSeries.find(
        (entry) =>
          String(entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? '') ===
          id
      )?.datastream ?? null

    const primary = normalizedIds[0] ? getById(normalizedIds[0]) : null
    const secondary = normalizedIds[1] ? getById(normalizedIds[1]) : null
    setSelectedDatastream(primary)
    setComparisonDatastream(secondary)
    const activeObservedPropertyNames = [primary, secondary]
      .map((ds) => String(ds?.ObservedProperty?.name ?? '').trim())
      .filter(Boolean)
    const uniqueActiveObservedPropertyNames = Array.from(
      new Set(activeObservedPropertyNames)
    )
    setSelectedObservedPropertyNamesForChart(uniqueActiveObservedPropertyNames)
    setSelectedObservedPropertyName(uniqueActiveObservedPropertyNames[0] ?? null)

    if (!primary) {
      setSelectedDatastream(null)
      setComparisonDatastream(null)
      setObservations([])
      setComparisonObservations([])
      return
    }

    const primaryId = String(primary?.['@iot.id'] ?? primary?.id ?? '')
    const primarySeries =
      allSeries.find(
        (entry) =>
          String(entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? '') ===
          primaryId
      ) ?? null
    setObservations(primarySeries?.observations ?? [])

    if (!secondary) {
      setComparisonObservations([])
      return
    }

    const secondaryId = String(secondary?.['@iot.id'] ?? secondary?.id ?? '')
    const secondarySeries =
      allSeries.find(
        (entry) =>
          String(entry?.datastream?.['@iot.id'] ?? entry?.datastream?.id ?? '') ===
          secondaryId
      ) ?? null
    setComparisonObservations(secondarySeries?.observations ?? [])
  }

  const onMapThingSelect = (
    thing: Thing,
    selection?: { observedPropertyName?: string }
  ) => {
    setSelectedThingId(getThingKey(thing))
    setSelectedObservedPropertyName(selection?.observedPropertyName?.trim() || null)
    setTableObservedPropertyFilter(selection?.observedPropertyName?.trim() || null)
    setSelectedDatastream(null)
    setComparisonDatastream(null)
    setObservations([])
    setComparisonObservations([])
    setObsError(null)
  }

  // When the snapshot context (asOfDate) changes, the persisted chart range and
  // cache belong to the *old* context and must not be reused. Re-anchor the
  // range to the new default window immediately, and — only if a chart is open —
  // refetch its data on the trailing edge so continuous scrubber dragging does
  // not fire a request per tick.
  useEffect(() => {
    if (prevAsOfRef.current === asOfDate) return
    prevAsOfRef.current = asOfDate

    // Stale results must never bleed across snapshot (or live) contexts
    obsCacheRef.current.clear()

    // Leaving snapshot mode ends any comparison — there is no longer a primary
    // snapshot to compare against. Moving *between* snapshots keeps it, so the
    // scrubber can be dragged against a pinned reference.
    if (!asOfDate && compareAsOfRef.current) {
      compareAsOfRef.current = null
      setCompareAsOfDate(null)
      setCompareAligned(true)
    }

    // A comparison pinned to an explicit shared window is the one case where
    // the range must OUTLIVE a move of the primary snapshot: holding the window
    // still while dragging the scrubber is exactly how you watch one period get
    // revised. Everywhere else the range belonged to the context being left.
    const carriedRange =
      compareAsOfRef.current && !windowIsAutoRef.current && obsStart && obsEnd
        ? { start: obsStart, end: obsEnd }
        : null

    // Fresh default window: [asOfDate-7d, asOfDate] in snapshot mode; in live
    // mode leave it empty so the phenomenonTime-based default takes over.
    windowIsAutoRef.current = !carriedRange
    setAsOfWindowFallback(false)
    const snapshotWindow = asOfDate ? getSnapshotWindow(asOfDate) : null
    const [nextStart, nextEnd] = snapshotWindow
      ? [snapshotWindow.startIso, snapshotWindow.endIso]
      : [null, null]

    // Re-anchor the displayed range right away (fixes the stale "Time range").
    // The refetch below replaces it with the window actually resolved for the
    // new snapshot, which may be the live-mode fallback window.
    if (!carriedRange) {
      setObsStart(nextStart)
      setObsEnd(nextEnd)
    }

    // The refetch itself waits for the Things of the new instant (below): the
    // chart picks its datastreams from them, and the previous instant's list
    // would chart datastreams that did not exist yet, or miss ones that did.
    pendingChartRefetchRef.current = {
      range: carriedRange ?? { start: null, end: null },
    }

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = null
      }
    }
    // Only react to asOfDate; other values are read from the current closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate])

  useEffect(() => {
    const pending = pendingChartRefetchRef.current
    if (!pending) return
    if ((asOfDate ?? null) !== thingsResolvedFor) return
    pendingChartRefetchRef.current = null
    if (!isChartOpen || !selectedDatastream) return

    refetchTimerRef.current = setTimeout(() => {
      // Refetch the WHOLE current selection (all things / observed properties)
      // with a fresh null range, so every series re-anchors to the new
      // snapshot window — not just the primary datastream.
      void openChartForThingAndObservedProperties(
        selectedThingKeysForChart,
        selectedObservedPropertyNamesForChart,
        datastreamIdFromSeriesId(activeDatastreamIds[0] ?? ''),
        pending.range,
        activeDatastreamIds
      )
    }, 300)

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = null
      }
    }
    // Fires once the Things match the instant; the rest is read from this
    // render's closure, which is the one holding those Things.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, thingsResolvedFor])

  // Back in live mode, a selection that only existed in the snapshot (a Thing
  // deleted since) has nothing left to show — and must not stay open with
  // write actions enabled on a Thing that no longer exists.
  useEffect(() => {
    if (!asOfDate && selectedThingId && !selectedThing) closePanel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, selectedThingId, selectedThing])

  return {
    selectedThing,
    isPanelOpen,
    selectedObservedPropertyName,
    tableObservedPropertyFilter,
    selectedThingKeysForChart,
    selectedObservedPropertyNamesForChart,
    isChartOpen,
    selectedDatastream,
    observations,
    comparisonDatastream,
    comparisonObservations,
    allSeries,
    obsLoading,
    obsError,
    obsStart,
    obsEnd,
    asOfWindowFallback,
    activeDatastreamIds,
    compareAsOfDate,
    compareAligned,
    isComparingSnapshots,
    changeCompareAsOfDate,
    setIsChartOpen,
    setSelectedDatastream,
    setComparisonDatastream,
    setActiveDatastreamIds,
    setObservations,
    setComparisonObservations,
    setAllSeries,
    setObsError,
    setObsLoading,
    setObsStart,
    setObsEnd,
    fetchObservations,
    closePanel,
    resetChartState,
    onMapThingSelect,
    openChartForDatastream,
    openChartForThingAndObservedProperties,
    applyObservationRange,
    changeActiveDatastreams,
  }
}
