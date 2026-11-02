import type { QualityConstraint, QualityMode } from './resultQuality'

import { fitsMask, maskVerdict, rawText } from '../../qc/lib/bitmask'

/** Long explanations and unknown-code messages belong behind the info button. */
export function compactQuality(
  raw: unknown,
  constraints: QualityConstraint[] | null,
  mode: QualityMode
) {
  const verdict =
    mode === 'bitmask' &&
    constraints !== null &&
    fitsMask(raw, constraints.length)
      ? maskVerdict(raw, constraints.length)
      : null
  return {
    code: raw == null ? null : rawText(raw),
    verdict: verdict === 'unknown' ? null : verdict,
  }
}
