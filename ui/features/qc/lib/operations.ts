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
  // Selected-point replacement is bounded by the selected targets, rather
  // than the full loaded period used by the form's hidden interval fields.
  const firstTarget = target.indexOf(true)
  const lastTarget = target.lastIndexOf(true)
  const replacementStart =
    keys && firstTarget >= 0 ? ordered[firstTarget].ts : request.start
  const replacementEnd =
    keys && lastTarget >= 0 ? ordered[lastTarget].ts : request.end
  const anchors = new Map<
    string,
    { key: string; time: string; value: number }
  >()
  const valid = ordered.map((row, i) => {
    if (
      isMissing(values[i].result) ||
      (request.operation === 'interpolate' &&
        row.ts >= replacementStart &&
        row.ts <= replacementEnd)
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
    if (request.operation === 'offset') {
      if (isMissing(values[i].result)) {
        plan.skipped++
        plan.skippedRows.push({ key: row.key, reason: 'missing' })
        return
      }
      next = numericValue(values[i].result)! + request.value!
      if (!Number.isFinite(next) || isMissing(next))
        throw new Error(
          'The offset produces an invalid value or a no-data marker.'
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
