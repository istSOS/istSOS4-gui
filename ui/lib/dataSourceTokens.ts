import { decodeTokenPayload } from '@/lib/auth'

const DATA_SOURCE_TOKENS_STORAGE_KEY = 'data-source-tokens'

type DataSourceTokenEntry = {
  token: string
  expiresAt: number | null
}

type DataSourceTokenMap = Record<string, DataSourceTokenEntry>

const normalizeEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/, '')

const isBrowser = () => typeof window !== 'undefined'

const readTokenMap = (): DataSourceTokenMap => {
  if (!isBrowser()) return {}

  try {
    const raw = localStorage.getItem(DATA_SOURCE_TOKENS_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    return parsed as DataSourceTokenMap
  } catch {
    return {}
  }
}

const writeTokenMap = (tokenMap: DataSourceTokenMap) => {
  if (!isBrowser()) return
  localStorage.setItem(DATA_SOURCE_TOKENS_STORAGE_KEY, JSON.stringify(tokenMap))
}

const isExpired = (expiresAt: number | null) =>
  typeof expiresAt === 'number' && Number.isFinite(expiresAt)
    ? expiresAt <= Math.floor(Date.now() / 1000)
    : false

export const getDataSourceToken = (endpoint: string): string | null => {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  if (!normalizedEndpoint) return null

  const tokenMap = readTokenMap()
  const entry = tokenMap[normalizedEndpoint]
  if (!entry?.token) return null

  if (isExpired(entry.expiresAt)) {
    delete tokenMap[normalizedEndpoint]
    writeTokenMap(tokenMap)
    return null
  }

  return entry.token
}

export const getAllDataSourceTokens = (): Record<string, string> => {
  const tokenMap = readTokenMap()
  let hasExpiredEntries = false

  const result: Record<string, string> = {}
  for (const [endpoint, entry] of Object.entries(tokenMap)) {
    if (!entry?.token || isExpired(entry.expiresAt)) {
      hasExpiredEntries = true
      continue
    }
    result[endpoint] = entry.token
  }

  if (hasExpiredEntries) {
    const cleanedTokenMap: DataSourceTokenMap = {}
    for (const [endpoint, token] of Object.entries(result)) {
      const existing = tokenMap[endpoint]
      cleanedTokenMap[endpoint] = {
        token,
        expiresAt: existing?.expiresAt ?? null,
      }
    }
    writeTokenMap(cleanedTokenMap)
  }

  return result
}

export const setDataSourceToken = (endpoint: string, token: string) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  const trimmedToken = token.trim()
  if (!normalizedEndpoint || !trimmedToken) return

  const payload = decodeTokenPayload(trimmedToken)
  const expiresAt = typeof payload?.exp === 'number' ? payload.exp : null

  const tokenMap = readTokenMap()
  tokenMap[normalizedEndpoint] = {
    token: trimmedToken,
    expiresAt,
  }
  writeTokenMap(tokenMap)
}

export const removeDataSourceToken = (endpoint: string) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  if (!normalizedEndpoint) return

  const tokenMap = readTokenMap()
  if (!(normalizedEndpoint in tokenMap)) return
  delete tokenMap[normalizedEndpoint]
  writeTokenMap(tokenMap)
}

export const clearDataSourceTokens = () => {
  if (!isBrowser()) return
  localStorage.removeItem(DATA_SOURCE_TOKENS_STORAGE_KEY)
}
