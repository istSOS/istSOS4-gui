import { getResultQualityConfig } from '../../../config/resultQuality'

export const MANUAL_FLAG_CODES = [310, 320, 321, 330, 110]

export function qualityFlags() {
  return getResultQualityConfig().flags
}

/** Configured descriptions take precedence over decoding, including custom codes. */
export function qualityFlagDescription(
  value: unknown,
  t?: (key: string) => string
): string {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    return ''
  const flag = qualityFlags().find((flag) => flag.code === Number(value))
  const language = t?.('qc.catalog_language') === 'it' ? 'it' : 'en'
  return flag?.description[language] ?? ''
}
