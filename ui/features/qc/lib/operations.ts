import { isMissing, maskVerdict, numericValue } from './bitmask'
import { rowValue } from './model'
import type { Drafts, EditPlan, EditRequest, QcRow } from './types'

export function planEdits(
  rows: QcRow[],
  drafts: Drafts,
  request: EditRequest,
  checkCount: number,
  encoded = true
): EditPlan {
  if (
    !Number.isFinite(request.start) ||
    !Number.isFinite(request.end) ||
    request.start > request.end
  )
    throw new Error('Choose a valid UTC interval with From before To.')
  const fill = request.operation.startsWith('fill-')
  const linear =
    request.operation === 'fill-linear' || request.operation === 'interpolate'
  if (
    request.operation === 'constant' ||
    request.operation === 'fill-constant' ||
    request.operation === 'offset'
  ) {
    if (
      request.value === undefined ||
      !Number.isFinite(request.value) ||
      (request.operation !== 'offset' && isMissing(request.value))
    )
      throw new Error(
        'Enter a finite value that is not a configured no-data marker.'
      )
  }
  if (
    (fill || linear) &&
    (!request.maxGapMs ||
      !Number.isFinite(request.maxGapMs) ||
      request.maxGapMs <= 0)
  )
    throw new Error('Choose a positive maximum gap duration.')
  const drift = request.operation === 'correct-drift'
  if (
    drift &&
    (!request.windowMs ||
      !Number.isFinite(request.windowMs) ||
      request.windowMs <= 0)
  )
    throw new Error('Choose a positive averaging window.')
  if (
    drift &&
    [request.min, request.max].some(
      (bound) => bound !== undefined && !Number.isFinite(bound)
    )
  )
    throw new Error('Enter finite Min and Max values, or leave them empty.')
  if (
    drift &&
    request.min !== undefined &&
    request.max !== undefined &&
    request.min > request.max
  )
    throw new Error('Min must not be greater than Max.')
  const ordered = [...rows].sort((a, b) => a.ts - b.ts)
  const keys = request.keys ? new Set(request.keys) : null
  const values = ordered.map((row) => rowValue(row, drafts))
  const target = ordered.map(
    (row, i) =>
      row.scope === 'window' &&
      (!keys || keys.has(row.key)) &&
      row.ts >= request.start &&
      row.ts <= request.end &&
      (!fill || isMissing(values[i].result))
  )
  const plan: EditPlan = {
    changes: {},
    filledKeys: [],
    targets: target.filter(Boolean).length,
    skipped: 0,
    skippedRows: [],
    anchors: [],
  }
  // A selected drift period is bounded by the selected targets, rather than
  // the full loaded period used by the form's hidden interval fields.
  const firstTarget = target.indexOf(true)
  const lastTarget = target.lastIndexOf(true)
  const replacementStart =
    keys && firstTarget >= 0 ? ordered[firstTarget].ts : request.start
  const replacementEnd =
    keys && lastTarget >= 0 ? ordered[lastTarget].ts : request.end
  const driftAt = drift
    ? driftCurve(
        ordered,
        values.map((value) => value.result),
        replacementStart,
        replacementEnd,
        request.driftModel ?? 'linear',
        request.windowMs!,
        target,
        request.min,
        request.max
      )
    : null
  const anchors = new Map<
    string,
    { key: string; time: string; value: number }
  >()
  const valid = ordered.map((row, i) => {
    // Replaced values never anchor. An interval is replaced as a whole, from
    // anchors outside it. In a selection each run of consecutive targets is
    // interpolated between its own nearest anchors, so separate groups
    // become one interpolation per group.
    if (
      isMissing(values[i].result) ||
      (request.operation === 'interpolate' &&
        (keys ? target[i] : row.ts >= request.start && row.ts <= request.end))
    )
      return false
    const draft = values[i]
    if (!encoded) {
      // Service flags have no universal ordering; accept only explicitly
      // approved anchors unless the operator opts into other source qualities.
      const code = Number(draft.resultQuality)
      return (
        request.includeFailedAnchors ||
        (!draft.qualityPending && (code === 320 || code === 330))
      )
    }
    const verdict = maskVerdict(draft.resultQuality, checkCount)
    const originalVerdict = maskVerdict(row.resultQuality, checkCount)
    const pendingEdit =
      draft.staleSlots.length > 0 &&
      JSON.stringify(draft.result) !== JSON.stringify(row.result)
    // An unchanged bounding value can have pending checks solely because an
    // earlier gap was edited. Do not force users to allow bad-quality anchors
    // for that case, but preserve any known original failure until rechecked.
    const knownFailure =
      draft.staleSlots.length > 0 &&
      ['failed', 'unknown'].includes(originalVerdict)
    return (
      request.includeFailedAnchors ||
      (!pendingEdit &&
        !knownFailure &&
        !['failed', 'unknown', 'missing'].includes(verdict))
    )
  })
  const before: number[] = []
  const after: number[] = []
  let last = -1
  for (let i = 0; i < ordered.length; i++) {
    before[i] = last
    if (valid[i]) last = i
  }
  last = -1
  for (let i = ordered.length - 1; i >= 0; i--) {
    after[i] = last
    if (valid[i]) last = i
  }
  // Measure complete missing runs, including the part outside the chosen range.
  const missingSpan = new Map<number, number>()
  for (let i = 0; i < ordered.length; i++) {
    if (!isMissing(values[i].result)) continue
    const first = i
    while (i + 1 < ordered.length && isMissing(values[i + 1].result)) i++
    const left = first > 0 ? ordered[first - 1].ts : ordered[first].ts
    const right = i + 1 < ordered.length ? ordered[i + 1].ts : ordered[i].ts
    // A run cut off by the loaded context has no known complete duration.
    const span =
      first === 0 || i === ordered.length - 1 ? Infinity : right - left
    for (let j = first; j <= i; j++) missingSpan.set(j, span)
  }
  ordered.forEach((row, i) => {
    if (!target[i]) return
    let next = request.operation === 'missing' ? null : request.value!
    if (request.operation === 'offset' || driftAt) {
      if (isMissing(values[i].result)) {
        plan.skipped++
        plan.skippedRows.push({ key: row.key, reason: 'missing' })
        return
      }
      const current = numericValue(values[i].result)!
      next = driftAt ? current - driftAt(row.ts) : current + request.value!
      // Bounds are already met by the fitted drift; this only absorbs rounding.
      if (driftAt)
        next = Math.min(
          request.max ?? Infinity,
          Math.max(request.min ?? -Infinity, next)
        )
      if (!Number.isFinite(next) || isMissing(next))
        throw new Error(
          'The correction produces an invalid value or a no-data marker.'
        )
    }
    if (fill && (missingSpan.get(i) ?? 0) > request.maxGapMs!) {
      plan.skipped++
      plan.skippedRows.push({ key: row.key, reason: 'gap' })
      return
    }
    if (linear) {
      const left = before[i],
        right = after[i]
      if (left < 0 || right < 0 || ordered[right].ts <= ordered[left].ts) {
        plan.skipped++
        plan.skippedRows.push({ key: row.key, reason: 'anchors' })
        return
      }
      const spanMs = ordered[right].ts - ordered[left].ts
      if (spanMs > request.maxGapMs!) {
        plan.skipped++
        plan.skippedRows.push({ key: row.key, reason: 'anchor_span', spanMs })
        return
      }
      const a = numericValue(values[left].result)!,
        b = numericValue(values[right].result)!
      const ratio =
        (row.ts - ordered[left].ts) / (ordered[right].ts - ordered[left].ts)
      next = a * (1 - ratio) + b * ratio
      if (!Number.isFinite(next) || isMissing(next)) {
        plan.skipped++
        return
      }
      for (const j of [left, right])
        anchors.set(ordered[j].key, {
          key: ordered[j].key,
          time: ordered[j].time,
          value: numericValue(values[j].result)!,
        })
    }
    if (
      JSON.stringify(values[i].result) === JSON.stringify(next) ||
      (next !== null && numericValue(values[i].result) === next)
    )
      return
    plan.changes[row.key] = next
    if (next !== null && (linear || isMissing(values[i].result)))
      plan.filledKeys.push(row.key)
  })
  plan.anchors = [...anchors.values()]
  return plan
}

// SaQC correctDrift: a curve from the clean level (start) to the fouled level
// (end) is fitted over the drift period, then the drift is removed so the end
// lands on the newly cleaned level measured after the period.
function driftCurve(
  ordered: QcRow[],
  results: unknown[],
  start: number,
  end: number,
  model: 'linear' | 'exponential',
  windowMs: number,
  targets: boolean[],
  min?: number,
  max?: number
): (ts: number) => number {
  if (end <= start)
    throw new Error('Select a drift period of at least two observations.')
  const points = ordered.flatMap((row, i) =>
    isMissing(results[i]) ? [] : [{ ts: row.ts, v: numericValue(results[i])! }]
  )
  const mean = (from: number, to: number, label: string) => {
    const window = points.filter((p) => p.ts >= from && p.ts <= to)
    if (!window.length)
      throw new Error(
        `No valid values in the ${label} window. Widen the window or load more data.`
      )
    return window.reduce((sum, p) => sum + p.v, 0) / window.length
  }
  const clean = mean(start, start + windowMs, 'clean')
  const fouled = mean(end - windowMs, end, 'fouled')
  const cleaned = mean(end + 1, end + windowMs, 'newly cleaned')
  const span = end - start
  const shape = (c: number, x: number) =>
    Math.abs(c) < 1e-9 ? x : Math.expm1(c * x) / Math.expm1(c)
  let c0 = 0
  if (model === 'exponential') {
    const drifting = points
      .filter((p) => p.ts >= start && p.ts <= end)
      .map((p) => ({ x: (p.ts - start) / span, v: p.v }))
    c0 = minimize(
      (k) =>
        drifting.reduce(
          (sum, p) =>
            sum + (p.v - clean - shape(k, p.x) * (fouled - clean)) ** 2,
          0
        ),
      0
    )
  }
  const amount0 = fouled - cleaned
  if (min === undefined && max === undefined)
    return (ts) => amount0 * shape(c0, (ts - start) / span)

  // Bounded case: constrained nonlinear least squares over the shape c and
  // the amount D. The corrected values v - D * s(c, x) stay as close as
  // possible to the unbounded SaQC correction D0 * s(c0, x) while every one
  // of them lies in [min, max]. D enters linearly, so for each c its optimum
  // is exact (the least-squares D clamped to the interval the bounds allow);
  // only c is searched (variable projection).
  const drifted = ordered.flatMap((row, i) =>
    !targets[i] || isMissing(results[i])
      ? []
      : [{ x: (row.ts - start) / span, v: numericValue(results[i])! }]
  )
  const goal = drifted.map((p) => amount0 * shape(c0, p.x))
  const project = (k: number) => {
    const s = drifted.map((p) => shape(k, p.x))
    let lo = -Infinity,
      hi = Infinity
    drifted.forEach((p, i) => {
      if (s[i] < 1e-12) {
        // The correction is zero here, so the value cannot be moved.
        if (p.v < (min ?? -Infinity) || p.v > (max ?? Infinity))
          [lo, hi] = [Infinity, -Infinity]
        return
      }
      if (max !== undefined) lo = Math.max(lo, (p.v - max) / s[i])
      if (min !== undefined) hi = Math.min(hi, (p.v - min) / s[i])
    })
    if (lo > hi) return null
    const ss = s.reduce((sum, si) => sum + si * si, 0)
    const free = ss
      ? s.reduce((sum, si, i) => sum + si * goal[i], 0) / ss
      : amount0
    const d = Math.min(hi, Math.max(lo, free))
    return {
      d,
      cost: s.reduce((sum, si, i) => sum + (d * si - goal[i]) ** 2, 0),
    }
  }
  const cost = (k: number) => project(k)?.cost ?? Infinity
  // The linear model has no shape parameter: only D moves.
  const c = model === 'exponential' && cost(c0) > 0 ? minimize(cost, c0) : c0
  const best = project(c)
  if (!best)
    throw new Error(
      'No drift correction keeps every value within Min and Max. Check the bounds or the selection.'
    )
  return (ts) => best.d * shape(c, (ts - start) / span)
}

// ponytail: coarse grid + golden-section instead of SciPy's optimizers; can
// miss a narrow second minimum, add a proper optimizer if that shows.
function minimize(f: (k: number) => number, start: number): number {
  let best = start,
    bestValue = f(start)
  const visit = (k: number) => {
    const value = f(k)
    if (value < bestValue) [best, bestValue] = [k, value]
    return value
  }
  for (let k = -30; k <= 30; k++) visit(k)
  let lo = best - 1,
    hi = best + 1
  const g = (Math.sqrt(5) - 1) / 2
  for (let n = 0; n < 40; n++) {
    const a = hi - g * (hi - lo),
      b = lo + g * (hi - lo)
    if (visit(a) < visit(b)) hi = b
    else lo = a
  }
  visit((lo + hi) / 2)
  return best
}
