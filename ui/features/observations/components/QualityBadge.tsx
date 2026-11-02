'use client'

import { useTranslation } from 'react-i18next'

import { VERDICT_COLORS, maskVerdict, rawText } from '../../qc/lib/bitmask'

export default function QualityBadge({
  quality,
  count,
  stale = [],
}: {
  quality: unknown
  count: number
  stale?: number[]
}) {
  const { t } = useTranslation()
  const verdict = maskVerdict(quality, count, stale)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-default-200 bg-content1 px-1.5 py-0.5 text-[11px] leading-4">
      <span
        className="h-2 w-2 rounded-sm"
        style={{ background: VERDICT_COLORS[verdict] }}
      />
      {t(`qc.verdict.${verdict}`)}{' '}
      <code className="opacity-60">{rawText(quality)}</code>
      {!!stale.length && verdict !== 'stale' && (
        <span className="text-warning-700">· {t('qc.needs_check')}</span>
      )}
    </span>
  )
}
