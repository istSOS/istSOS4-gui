export type QualityFlag = {
  code: number
  description: { en: string; it: string }
}

export type ResultQualityConfig = {
  bitmaskEnabled: boolean
  flags: QualityFlag[]
}

export const RESULT_QUALITY_CONFIG_ID = 'result-quality-config'

/** An omitted or empty catalog deliberately has no built-in descriptions. */
export function parseResultQualityConfig(
  catalog = '',
  bitmaskEnabled = 'true'
): ResultQualityConfig {
  const enabled = bitmaskEnabled.trim().toLowerCase() || 'true'
  if (enabled !== 'true' && enabled !== 'false')
    throw new Error('RESULT_QUALITY_BITMASK_ENABLED must be true or false.')
  let flags: unknown = []
  if (catalog.trim()) {
    try {
      flags = JSON.parse(catalog)
    } catch {
      throw new Error('RESULT_QUALITY_CODES must be a valid JSON array.')
    }
  }
  if (!Array.isArray(flags))
    throw new Error('RESULT_QUALITY_CODES must be a JSON array.')
  const codes = new Set<number>()
  const validated = flags.map((flag, index): QualityFlag => {
    if (
      !flag ||
      typeof flag !== 'object' ||
      !Number.isSafeInteger(flag.code) ||
      flag.code < 0 ||
      codes.has(flag.code) ||
      !flag.description ||
      typeof flag.description.en !== 'string' ||
      !flag.description.en.trim() ||
      typeof flag.description.it !== 'string' ||
      !flag.description.it.trim()
    )
      throw new Error(
        `RESULT_QUALITY_CODES entry ${index + 1} needs a unique nonnegative integer code and nonempty description.en and description.it strings.`
      )
    codes.add(flag.code)
    return {
      code: flag.code,
      description: { en: flag.description.en, it: flag.description.it },
    }
  })
  return { bitmaskEnabled: enabled === 'true', flags: validated }
}

let cachedSource: string | undefined
let cachedEnabled: string | undefined
let cachedConfig: ResultQualityConfig | undefined
let cachedDocument: Document | undefined

/** The server supplies only these public settings, as inert JSON in the page. */
export function getResultQualityConfig(): ResultQualityConfig {
  if (
    typeof document !== 'undefined' &&
    typeof document.getElementById === 'function'
  ) {
    if (cachedConfig && cachedDocument === document) return cachedConfig
    const source =
      document.getElementById(RESULT_QUALITY_CONFIG_ID)?.textContent ?? ''
    if (cachedConfig && source === cachedSource) return cachedConfig
    const config = source
      ? JSON.parse(source)
      : { bitmaskEnabled: true, flags: [] }
    const validated = parseResultQualityConfig(
      JSON.stringify(config.flags),
      String(config.bitmaskEnabled)
    )
    cachedSource = source
    cachedConfig = validated
    cachedDocument = document
    return validated
  }
  const source = process.env.RESULT_QUALITY_CODES ?? ''
  const enabled = process.env.RESULT_QUALITY_BITMASK_ENABLED ?? 'true'
  if (cachedConfig && source === cachedSource && enabled === cachedEnabled)
    return cachedConfig
  const validated = parseResultQualityConfig(source, enabled)
  cachedSource = source
  cachedEnabled = enabled
  cachedConfig = validated
  return validated
}

export function resultQualityConfigJson(): string {
  return JSON.stringify(getResultQualityConfig()).replace(/</g, '\\u003c')
}
