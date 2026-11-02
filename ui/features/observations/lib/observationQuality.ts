import type { QualityConstraint, QualityMode } from './resultQuality'

import { fitsMask, maskVerdict, rawText } from '../../qc/lib/bitmask'
import { qualityFlagDescription } from '../../qc/lib/qualityFlags'

/** Catalog descriptions belong behind the info button; unknown flags keep their code. */
export function compactQuality(
  raw: unknown,
  constraints: QualityConstraint[] | null,
  mode: QualityMode
) {
  const verdict =
    raw == null || qualityFlagDescription(raw)
      ? null
      : mode === 'bitmask' &&
          constraints !== null &&
          fitsMask(raw, constraints.length)
        ? maskVerdict(raw, constraints.length)
        : ('unknown' as const)
  return {
    code: raw == null ? null : rawText(raw),
    verdict,
  }
}
