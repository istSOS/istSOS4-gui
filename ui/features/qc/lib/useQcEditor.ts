'use client'

import { getLiveDefaultWindow } from '@/features/observations/lib/observationWindow'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/context/AuthContext'

import { getTokenUsername } from '@/lib/auth'
import { getDataSourceToken } from '@/lib/dataSourceTokens'

import { appendAudit } from './audit'
import { type CheckScope, qcCheckTargets } from './checkTargets'
import { runnableSlots } from './checks'
import {
  changed,
  commitDrafts,
  editValues,
  emptyWorkspace,
  reconcileRecipes,
  redo,
  reviewHuman,
  reviewServiceQuality,
  rowValue,
  undo,
} from './model'
import { planEdits } from './operations'
import { discardSchema, prepareSchemaRows } from './schema'
import {
  configureStoredBitmask,
  hasStoredConstraints,
  storedBitmaskIssue,
} from './storedBitmask'
import { formatUtcOffset, validUtcOffset } from './timezone'
import type {
  EditRequest,
  LoadedData,
  PreviewData,
  QcDatastream,
  QcRow,
  QcSource,
  Workspace,
} from './types'

const basePath = (
  process.env.NEXT_PUBLIC_BASE_PATH?.trim() ||
  (process.env.NODE_ENV === 'production' ? '/NEXT_APP_URL' : '')
).replace(/\/+$/, '')
const inputTime = (iso: string) => iso.replace(/Z$/, '')

export function useQcEditor(accessUnavailable: boolean) {
  const { token } = useAuth()
  const [sources, setSources] = useState<QcSource[]>([])
  const [sourceId, setSourceId] = useState('')
  const [streams, setStreams] = useState<QcDatastream[]>([])
  const [streamId, setStreamId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [utcOffset, setUtcOffset] = useState(0)
  const [loaded, setLoaded] = useState<LoadedData | null>(null)
  const [loadedRange, setLoadedRange] = useState<{
    start: string
    end: string
  } | null>(null)
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace)
  const [selected, setSelected] = useState<string[]>([])
  const [slots, setSlots] = useState<number[]>([])
  const [busy, setBusy] = useState('')
  const [runningCheckScope, setRunningCheckScope] = useState<CheckScope | null>(
    null
  )
  const [error, setError] = useState(
    accessUnavailable
      ? 'Editing access could not be verified. Retry loading your data source.'
      : ''
  )
  const requestRef = useRef<AbortController | null>(null)
  const source = sources.find((s) => s.id === sourceId)
  const stream = loaded?.datastream ?? streams.find((s) => s.id === streamId)
  const key = source && streamId ? `${source.endpoint}::${streamId}` : ''
  const serviceMode = workspace.qualitySchema?.mode === 'service'
  const constraints = serviceMode ? [] : (stream?.constraints ?? [])
  const baseline = constraints
  const qualityIssue = loaded
    ? storedBitmaskIssue(
        loaded.datastream,
        Object.values(workspace.rows).map((row) => ({
          ...row,
          resultQuality: rowValue(row, workspace.drafts).resultQuality,
        }))
      )
    : null
  const qualityBlocked = !!qualityIssue && qualityIssue !== 'invalid_quality'
  const confirmed =
    workspace.qualitySchema?.mode === 'existing' && !qualityBlocked
  const sessionUser = getTokenUsername(token)
  const auditContext = {
    actor:
      source?.authorizationEnabled === false
        ? 'Anonymous (authorization disabled)'
        : getTokenUsername(
            (source && getDataSourceToken(source.endpoint)) ?? token
          ),
    source: source?.endpoint ?? '',
    datastream: streamId,
  }

  async function request<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const response = await fetch(`${basePath}/api/qc/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    })
    const data = await response.json()
    if (controller.signal.aborted)
      throw new DOMException('The editing session ended', 'AbortError')
    if (!response.ok) throw new Error(data.error ?? 'The request failed')
    return data
  }

  const credentials = (s: QcSource) => ({
    sourceId: s.id,
    token: getDataSourceToken(s.endpoint) ?? undefined,
  })

  async function chooseSource(id: string, list = sources) {
    const next = list.find((s) => s.id === id)
    if (!next) return
    setWorkspace(emptyWorkspace())
    setSourceId(id)
    setStreamId('')
    setLoaded(null)
    setLoadedRange(null)
    setSlots([])
    setStreams([])
    setSelected([])
    setBusy('Loading datastreams…')
    setError('')
    try {
      const data = await request<{ datastreams: QcDatastream[] }>(
        'data',
        credentials(next)
      )
      setStreams(data.datastreams.filter(hasStoredConstraints))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setError(
          error instanceof Error ? error.message : 'Could not load datastreams'
        )
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    let alive = true
    const discovery = new AbortController()
    fetch(`${basePath}/api/qc/sources`, {
      cache: 'no-store',
      signal: discovery.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Could not load data sources. Check your login and retry.'
          )
        return response.json()
      })
      .then((data) => {
        if (!alive) return
        setSources(data.sources)
        if (data.sources.length)
          void chooseSource(data.sources[0].id, data.sources)
      })
      .catch((error) => {
        if (alive) setError(error.message)
      })
    return () => {
      alive = false
      discovery.abort()
      requestRef.current?.abort()
    }
    // Initial discovery uses the authenticated server cookie, not a captured token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      setWorkspace(emptyWorkspace())
      setLoaded(null)
      setLoadedRange(null)
      setSelected([])
      setSlots([])
      const browserOffset = -new Date().getTimezoneOffset()
      setUtcOffset(validUtcOffset(browserOffset) ? browserOffset : 0)
      // Remove obsolete QC recovery copies without reading or saving drafts.
      try {
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
          const oldKey = sessionStorage.key(index)
          if (oldKey?.startsWith('istsos-qc-drafts-v1:'))
            sessionStorage.removeItem(oldKey)
        }
      } catch {
        // Browser storage is optional; all editing state stays in page memory.
      }
    })
    return () => {
      active = false
      requestRef.current?.abort()
    }
  }, [sessionUser])

  function chooseStream(id: string) {
    setWorkspace(emptyWorkspace())
    setStreamId(id)
    setLoaded(null)
    setLoadedRange(null)
    setSelected([])
    setError('')
    const ds = streams.find((s) => s.id === id)
    if (ds && (!start || !end)) {
      const range = getLiveDefaultWindow(ds.phenomenonTime)
      setStart(inputTime(range.startIso))
      setEnd(inputTime(range.endIso))
    }
    setSlots(runnableSlots(ds?.constraints ?? []))
  }

  function mergeRows(ws: Workspace, rows: QcRow[]) {
    const merged = Object.fromEntries(
      Object.entries(ws.rows).map(([key, row]) => [
        key,
        { ...row, scope: 'history' as const },
      ])
    ) as Workspace['rows']
    for (const row of rows) {
      const before = merged[row.key]
      if (
        before &&
        ws.drafts[row.key] &&
        (JSON.stringify(before.result) !== JSON.stringify(row.result) ||
          JSON.stringify(before.resultQuality) !==
            JSON.stringify(row.resultQuality))
      ) {
        throw new Error(
          'Server data changed under a draft. Export your changes and discard the draft before reloading.'
        )
      }
      merged[row.key] = row
    }
    const next = { ...ws, rows: merged }
    return ws.qualitySchema?.mode === 'existing'
      ? next
      : prepareSchemaRows(next)
  }

  async function load() {
    if (!source || !streamId || !start || !end) return false
    setBusy('Loading observations and context…')
    setError('')
    setSelected([])
    try {
      const data = await request<LoadedData>('data', {
        ...credentials(source),
        datastreamId: streamId,
        start: `${start}Z`,
        end: `${end}Z`,
      })
      if (
        workspace.qualitySchema?.mode === 'existing' &&
        JSON.stringify(workspace.qualitySchema.constraints) !==
          JSON.stringify(data.datastream.constraints)
      )
        throw new Error(
          'The stored test definition changed. Export and discard this draft before reloading.'
        )
      const merged = mergeRows(
        {
          ...workspace,
          datastream: data.datastream,
          sourceEndpoint: source.endpoint,
        },
        data.rows
      )
      if (!hasStoredConstraints(data.datastream))
        throw new Error(
          'Only datastreams with configured quality constraints can be opened in this editor.'
        )
      const next = configureStoredBitmask(merged, data.datastream)
      setWorkspace(
        appendAudit(workspace, next, auditContext, 'load-quality', {
          originalConstraints: data.datastream.constraints,
        })
      )
      setLoaded(data)
      setLoadedRange({ start, end })
      return true
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not load observations'
      )
      return false
    } finally {
      setBusy('')
    }
  }

  function update(
    next: Workspace,
    action: string,
    details: Record<string, unknown> = {},
    force = false
  ) {
    const normalized = reconcileRecipes(next, constraints, baseline)
    const audited = appendAudit(
      workspace,
      normalized,
      auditContext,
      action,
      { displayUtcOffset: formatUtcOffset(utcOffset), ...details },
      force
    )
    setWorkspace(audited)
    return audited
  }

  async function runChecks(
    scope: CheckScope = 'selected',
    checkWorkspace = workspace,
    checkSlots = slots,
    automatic = false
  ) {
    if (!source || !loaded || !confirmed || !loadedRange || serviceMode || busy)
      return
    const targetKeys = qcCheckTargets(
      scope,
      loaded.rows,
      selected,
      checkWorkspace.drafts,
      constraints.length,
      checkSlots
    )
    if (scope !== 'affected' && (!targetKeys.length || !checkSlots.length))
      return
    setRunningCheckScope(scope)
    setBusy('Running historical SaQC checks…')
    setError('')
    try {
      const data = await request<PreviewData>('preview', {
        ...credentials(source),
        datastreamId: streamId,
        start: `${loadedRange.start}Z`,
        end: `${loadedRange.end}Z`,
        constraints,
        qualityMode: checkWorkspace.qualitySchema?.mode,
        slots: checkSlots,
        scope,
        targetKeys,
        edits: Object.entries(checkWorkspace.drafts).map(([rowKey, draft]) => ({
          key: rowKey,
          originalResult: checkWorkspace.rows[rowKey].result,
          originalQuality: checkWorkspace.rows[rowKey].resultQuality,
          draft,
        })),
      })
      const next = mergeRows(checkWorkspace, data.rows)
      const drafts = { ...next.drafts }
      for (const result of data.results) {
        const row = next.rows[result.key]
        if (!row) continue
        const current = rowValue(row, drafts)
        const recipe = [...(current.recipe ?? baseline)]
        for (const slot of checkSlots) recipe[slot - 1] = constraints[slot - 1]
        drafts[row.key] = {
          ...current,
          ...result,
          recipe,
          outcomes: [
            ...(current.outcomes ?? []).filter(
              (o) => !checkSlots.includes(o.slot) && o.slot !== 0
            ),
            ...result.outcomes,
          ],
        }
      }
      const checked = reconcileRecipes(
        commitDrafts(next, drafts),
        constraints,
        baseline
      )
      setWorkspace(
        appendAudit(
          checkWorkspace,
          // A correction and its automatic check remain one Undo action.
          automatic ? { ...checked, undo: checkWorkspace.undo } : checked,
          auditContext,
          'checks',
          {
            slots: checkSlots,
            automatic,
            constraints,
            scope,
            targetKeys,
            engineVersion: data.engineVersion,
            warnings: data.warnings,
            checked: data.results.length,
          },
          true
        )
      )
      setLoaded(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Preview failed')
    } finally {
      setRunningCheckScope(null)
      setBusy('')
    }
  }

  const rows = useMemo(() => {
    const loadedKeys = new Set(
      loaded?.rows.filter((r) => r.scope === 'window').map((r) => r.key)
    )
    const followingKeys = new Set(
      loaded?.rows.filter((r) => r.scope === 'following').map((r) => r.key)
    )
    return Object.values(workspace.rows)
      .filter(
        (row) =>
          loadedKeys.has(row.key) ||
          (followingKeys.has(row.key) &&
            workspace.drafts[row.key] &&
            changed(row, workspace.drafts[row.key]))
      )
      .sort((a, b) => a.ts - b.ts)
  }, [loaded, workspace.rows, workspace.drafts])

  function applyOperation(request: EditRequest) {
    if (
      !loaded ||
      !confirmed ||
      busy ||
      loadedRange?.start !== start ||
      loadedRange?.end !== end
    )
      return false
    try {
      if (!request.note.trim())
        throw new Error('Enter a reason for this correction.')
      const plan = planEdits(
        loaded.rows.map((row) => workspace.rows[row.key] ?? row),
        workspace.drafts,
        request,
        constraints.length,
        !serviceMode
      )
      const next = editValues(
        workspace,
        plan.changes,
        constraints,
        stream?.samplingFrequency,
        baseline,
        plan.filledKeys
      )
      const corrected = update(next, request.operation, {
        ...request,
        start: new Date(request.start).toISOString(),
        end: new Date(request.end).toISOString(),
        targets: plan.targets,
        skipped: plan.skipped,
        skippedRows: plan.skippedRows,
        anchors: plan.anchors,
      })
      setError('')
      if (!serviceMode && Object.keys(plan.changes).length)
        void runChecks('affected', corrected, runnableSlots(constraints), true)
      return true
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not apply this operation'
      )
      return false
    }
  }

  return {
    sources,
    source,
    sourceId,
    streams,
    stream,
    streamId,
    start,
    end,
    setStart,
    setEnd,
    utcOffset,
    setUtcOffset,
    workspace,
    setCommitMessage: (message: string) => {
      if (!loaded || !confirmed || busy) return
      setWorkspace((previous) => ({ ...previous, commitMessage: message }))
    },
    key,
    rows,
    contextRows:
      loaded?.rows.map((row) => workspace.rows[row.key] ?? row) ?? [],
    loaded,
    constraints,
    slots,
    setSlots,
    selected,
    setSelected,
    rangeChanged:
      !!loaded && (loadedRange?.start !== start || loadedRange?.end !== end),
    busy,
    runningCheckScope,
    error,
    setError,
    confirmed,
    qualityIssue,
    qualityBlocked,
    serviceMode,
    baseline,
    chooseSource,
    chooseStream,
    load,
    runChecks: (scope: CheckScope = 'selected') => runChecks(scope),
    applyOperation,
    edit: (rowKey: string, value: number | null, reason: string) => {
      if (
        !confirmed ||
        busy ||
        !reason.trim() ||
        workspace.rows[rowKey]?.scope !== 'window'
      )
        return
      const next = editValues(
        workspace,
        { [rowKey]: value },
        constraints,
        stream?.samplingFrequency,
        baseline
      )
      if (next === workspace) return
      const corrected = update(next, 'cell-edit', {
        observationKey: rowKey,
        method: 'manual',
        reason: reason.trim(),
      })
      if (!serviceMode)
        void runChecks('affected', corrected, runnableSlots(constraints), true)
    },
    review: (keys: string[], state: number | null, reason: string) => {
      if (
        !confirmed ||
        busy ||
        !reason.trim() ||
        (!serviceMode && state === null)
      )
        return false
      try {
        update(
          serviceMode
            ? reviewServiceQuality(workspace, keys, state)
            : reviewHuman(workspace, keys, state, constraints),
          serviceMode ? 'service-quality' : 'human-review',
          { observationKeys: keys, state, reason: reason.trim() }
        )
        setError('')
        return true
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Could not review observations'
        )
        return false
      }
    },
    undo: () => update(undo(workspace), 'undo', {}, true),
    redo: () => update(redo(workspace), 'redo', {}, true),
    discard: () => {
      const clean = discardSchema(workspace)
      const next = loaded
        ? configureStoredBitmask(clean, loaded.datastream)
        : clean
      setWorkspace(
        appendAudit(
          workspace,
          next,
          auditContext,
          'discard',
          { commitMessage: workspace.commitMessage ?? '' },
          true
        )
      )
    },
  }
}
