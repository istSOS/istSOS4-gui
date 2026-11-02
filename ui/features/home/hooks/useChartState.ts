import { getSnapshotWindow } from '@/features/as-of/lib/snapshotWindow'
import {
  type DatastreamChoice,
  datastreamChoice,
  datastreamChoices,
  datastreamKey,
  toggleDatastream,
} from '@/features/observations/lib/datastreamSelection'
import {
  type SeriesSource,
  makeSeriesId,
} from '@/features/observations/lib/observationGraphUtils'
import {
  getLiveDefaultWindow,
  getWindowEndingAt,
} from '@/features/observations/lib/observationWindow'
import {
  getLatestObservationTime,
  getObservationsByDatastream,
} from '@/services/observations'
import { Datastream, Observation, Thing } from '@/types/domain'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useMemo, useRef, useState } from 'react'

import { siteConfig } from '@/config/site'

import { getDataSourceToken } from '@/lib/dataSourceTokens'

import { getThingKey } from '../lib/utils'

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
  const [selectedChartChoices, setSelectedChartChoices] = useState<
    DatastreamChoice[]
  >([])
  const [listedChartChoices, setListedChartChoices] = useState<
    DatastreamChoice[]
  >([])
  const chartRequestRef = useRef(0)
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

  // Keep the last resolved Thing when a snapshot predates its existence.
  const [retainedThing, setRetainedThing] = useState<Thing | null>(null)
  const selectedThing = useMemo(() => {
    if (!selectedThingId) return null
    return (
      localThings.find((thing) => getThingKey(thing) === selectedThingId) ??
      (asOfDate
        ? (liveThings.find((thing) => getThingKey(thing) === selectedThingId) ??
          (retainedThing && getThingKey(retainedThing) === selectedThingId
            ? retainedThing
            : null))
        : null)
    )
  }, [localThings, liveThings, selectedThingId, asOfDate, retainedThing])
  if (selectedThing && selectedThing !== retainedThing)
    setRetainedThing(selectedThing)

  const availableDatastreams = useMemo(() => {
    const choices = datastreamChoices(localThings, siteConfig.api_root)
    const byKey = new Map(choices.map((choice) => [choice.key, choice]))
    for (const choice of listedChartChoices)
      if (!byKey.has(choice.key)) byKey.set(choice.key, choice)
    return [...byKey.values()]
  }, [localThings, listedChartChoices])
  const selectedDatastreamKeysForChart = selectedChartChoices.map(
    (choice) => choice.key
  )

  const resetChartState = () => {
    chartRequestRef.current++
    setSelectedChartChoices([])
    setListedChartChoices([])
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

  const clearThingSelection = () => {
    setSelectedThingId(null)
  }

  const closePanel = () => {
    clearThingSelection()
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
        resolvedEndpoint,
        asOf
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
   * Each automatic window uses the same empty-window fallback as Details.
   * Explicit date ranges are shared by both snapshots without re-anchoring.
   */
  const loadCompareSnapshots = async (
    primaryDs: Datastream | null,
    compareDate: string,
    range: { start?: string | null; end?: string | null } | undefined,
    request: number
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

    if (request !== chartRequestRef.current) return
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
      makeSeriesId(datastreamKey(primaryDs), asOfDate),
      makeSeriesId(datastreamKey(primaryDs), compareDate),
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

  /** Load exactly the chosen streams; other streams stay in the selector only. */
  const loadChartDatastreams = async (
    choices: DatastreamChoice[],
    rangeOverride?: { start?: string | null; end?: string | null }
  ) => {
    const selected = compareAsOfRef.current
      ? choices.slice(0, 1)
      : choices.slice(0, 2)
    const primary = selected[0]
    if (!primary) return
    const request = ++chartRequestRef.current
    setIsChartOpen(true)
    setSelectedChartChoices(selected)
    if (primary.thing) {
      const key = getThingKey(primary.thing)
      setRetainedThing(primary.thing)
      setSelectedThingId(key)
    }
    setSelectedDatastream(primary.datastream)
    setComparisonDatastream(selected[1]?.datastream ?? null)
    setActiveDatastreamIds(selected.map((choice) => choice.key))
    setAllSeries([])
    setObservations([])
    setComparisonObservations([])
    setObsLoading(true)
    setObsError(null)
    const explicitRange =
      rangeOverride?.start && rangeOverride?.end
        ? { start: rangeOverride.start, end: rangeOverride.end }
        : !rangeOverride && !windowIsAutoRef.current && obsStart && obsEnd
          ? { start: obsStart, end: obsEnd }
          : null
    windowIsAutoRef.current = !explicitRange
    try {
      if (asOfDate && compareAsOfRef.current) {
        await loadCompareSnapshots(
          primary.datastream,
          compareAsOfRef.current,
          explicitRange ?? undefined,
          request
        )
        return
      }
      const ds = primary.datastream
      const id = String(ds['@iot.id'] ?? ds.id ?? '')
      const window = explicitRange
        ? null
        : asOfDate
          ? await resolveAsOfDefaultWindow(
              asOfDate,
              id,
              ds.phenomenonTime,
              ds.__sourceEndpoint
            )
          : { ...getLiveDefaultWindow(ds.phenomenonTime), isFallback: false }
      const range = explicitRange ?? {
        start: window!.startIso,
        end: window!.endIso,
      }
      const results = await Promise.all(
        selected.map(async (choice) => {
          const stream = choice.datastream
          const result = await fetchObservations(
            String(stream['@iot.id'] ?? stream.id ?? ''),
            stream.phenomenonTime,
            range,
            stream.__sourceEndpoint
          )
          return { datastream: stream, ...result }
        })
      )
      if (request !== chartRequestRef.current) return
      setAllSeries(
        results.map((result) => ({
          datastream: result.datastream,
          observations: result.data,
        }))
      )
      setObservations(results[0].data)
      setComparisonObservations(results[1]?.data ?? [])
      setObsStart(results[0].startIso)
      setObsEnd(results[0].endIso)
      setAsOfWindowFallback(window?.isFallback ?? false)
    } catch (error: unknown) {
      if (request === chartRequestRef.current)
        setObsError(toErrorMessage(error, 'Failed to load observations'))
    } finally {
      if (request === chartRequestRef.current) setObsLoading(false)
    }
  }

  const openChartForDatastream = async (ds: Datastream, owner?: Thing) => {
    if (ds['@iot.id'] == null && ds.id == null) return
    compareAsOfRef.current = null
    setCompareAsOfDate(null)
    setCompareAligned(true)
    const chartThing =
      owner ??
      localThings.find((thing) =>
        thing.Datastreams?.some(
          (stream) =>
            datastreamKey(
              datastreamChoice(stream, thing, siteConfig.api_root).datastream
            ) ===
            datastreamKey(
              datastreamChoice(ds, thing, siteConfig.api_root).datastream
            )
        )
      ) ??
      selectedThing
    const choice = datastreamChoice(ds, chartThing, siteConfig.api_root)
    setListedChartChoices([choice])
    await loadChartDatastreams([choice], { start: null, end: null })
  }

  const changeSelectedDatastreams = async (keys: string[]) => {
    const choices = [...new Set(keys)]
      .map((key) => availableDatastreams.find((choice) => choice.key === key))
      .filter((choice): choice is DatastreamChoice => !!choice)
    // Adding a stream keeps the clicked stream as the primary axis.
    const primaryKey = selectedChartChoices[0]?.key
    choices.sort(
      (a, b) => Number(b.key === primaryKey) - Number(a.key === primaryKey)
    )
    if (!choices.length) return
    setListedChartChoices((previous) => {
      const byKey = new Map(previous.map((choice) => [choice.key, choice]))
      for (const choice of choices) byKey.set(choice.key, choice)
      return [...byKey.values()]
    })
    await loadChartDatastreams(
      choices,
      obsStart && obsEnd ? { start: obsStart, end: obsEnd } : undefined
    )
  }

  const toggleChartDatastream = async (key: string) => {
    const keys = toggleDatastream(
      selectedDatastreamKeysForChart,
      key,
      !!compareAsOfRef.current
    )
    if (
      keys.length === selectedDatastreamKeysForChart.length &&
      keys.every((key, i) => key === selectedDatastreamKeysForChart[i])
    )
      return
    await changeSelectedDatastreams(keys)
  }
  const removeChartDatastream = async (key: string) => {
    if (
      selectedDatastreamKeysForChart.length === 1 &&
      selectedDatastreamKeysForChart[0] === key
    )
      return
    setListedChartChoices((choices) =>
      choices.filter((choice) => choice.key !== key)
    )
    if (selectedDatastreamKeysForChart.includes(key))
      await changeSelectedDatastreams(
        selectedDatastreamKeysForChart.filter((id) => id !== key)
      )
  }

  const applyObservationRange = async (
    start?: string | null,
    end?: string | null
  ) => {
    await loadChartDatastreams(selectedChartChoices, { start, end })
  }

  const changeCompareAsOfDate = async (nextDate: string | null) => {
    compareAsOfRef.current = nextDate
    setCompareAsOfDate(nextDate)
    const keptRange =
      obsStart && obsEnd
        ? { start: obsStart, end: obsEnd }
        : { start: null, end: null }
    setCompareAligned(!keptRange.start)
    await loadChartDatastreams(
      nextDate ? selectedChartChoices.slice(0, 1) : selectedChartChoices,
      keptRange
    )
  }

  const onMapThingSelect = (thing: Thing) => {
    setRetainedThing(thing)
    setSelectedThingId(getThingKey(thing))
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
    chartRequestRef.current++

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
      const choices = selectedChartChoices.map(
        (selected) =>
          availableDatastreams.find((choice) => choice.key === selected.key) ??
          selected
      )
      void loadChartDatastreams(choices, pending.range)
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
    if (asOfDate || !selectedThingId || selectedThing) return
    const timer = setTimeout(closePanel, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, selectedThingId, selectedThing])

  return {
    selectedThing,
    availableDatastreams,
    listedDatastreamKeys: listedChartChoices.map((choice) => choice.key),
    toggleChartDatastream,
    removeChartDatastream,
    selectedDatastreamKeysForChart,
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
    changeCompareAsOfDate,
    fetchObservations,
    resetChartState,
    onMapThingSelect,
    clearThingSelection,
    openChartForDatastream,
    changeSelectedDatastreams,
    applyObservationRange,
  }
}
