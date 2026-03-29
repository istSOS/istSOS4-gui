export type TokenPayload = {
  sub?: string
  user_id?: number | string
  id?: number | string
  uid?: number | string
  exp?: number
  [key: string]: unknown
}

export function decodeTokenPayload(token: string | null | undefined): TokenPayload | null {
  if (!token) return null

  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function isTokenExpired(token: string | null | undefined) {
  const payload = decodeTokenPayload(token)
  if (!payload?.exp) return true

  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now
}

export function getTokenUsername(token: string | null | undefined) {
  const payload = decodeTokenPayload(token)
  return typeof payload?.sub === 'string' && payload.sub.trim()
    ? payload.sub
    : 'User'
}
