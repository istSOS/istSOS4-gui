export type PageMemoryReader = {
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>
}

export function canMeasurePageMemory(
  performance: PageMemoryReader,
  isolated: boolean
) {
  return (
    isolated && typeof performance.measureUserAgentSpecificMemory === 'function'
  )
}

/** Measures the page at request time. Never substitutes device RAM or heap limits. */
export async function measurePageMemory(
  performance: PageMemoryReader,
  isolated: boolean
) {
  if (!canMeasurePageMemory(performance, isolated))
    throw new Error('Page memory measurement is unavailable')
  const result = await performance.measureUserAgentSpecificMemory!()
  if (!Number.isFinite(result?.bytes) || result.bytes < 0)
    throw new Error('Invalid page memory measurement')
  return { bytes: result.bytes, time: Date.now() }
}
