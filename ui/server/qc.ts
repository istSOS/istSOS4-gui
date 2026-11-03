import type { ConfiguredDataSource } from '@/types'

import { canUseQcWithToken } from '@/lib/qcAccess'

export function getSaqcServiceUrl(): string | null {
  return process.env.SAQC_SERVICE_URL?.trim().replace(/\/+$/, '') || null
}

/**
 * Without a source, only whether quality control is enabled: the page and its
 * source list are open, and each source is checked when it is used.
 */
export async function getQcAccess(options?: {
  source: ConfiguredDataSource
  token?: string | null
}): Promise<200 | 401 | 403 | 404 | 503> {
  if (!getSaqcServiceUrl()) return 404
  if (!options) return 200
  // An anonymous source is read-only: quality control writes need an editor.
  if (!options.source.authorizationEnabled) return 403

  const { source, token } = options
  if (!token) return 401
  if (!canUseQcWithToken(token, true)) return 403

  try {
    // Unlike public observation reads, /Users always authenticates tokens,
    // even when ANONYMOUS_VIEWER is enabled. A non-admin editor receives the
    // specific "Insufficient privileges." response after authentication.
    // Do not use /Refresh as a probe: it can revoke the existing token.
    const response = await fetch(`${source.apiRoot}/Users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      await response.body?.cancel()
      return 200
    }
    const body = await response.json().catch(() => null)
    if (
      (response.status === 401 || response.status === 403) &&
      body?.message === 'Insufficient privileges.'
    ) {
      return 200
    }
    return response.status === 401 || response.status === 403 ? 401 : 503
  } catch {
    return 503
  }
}
