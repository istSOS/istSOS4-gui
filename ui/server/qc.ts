import type { ConfiguredDataSource } from '@/types'

import { cookies } from 'next/headers'

import { siteConfig } from '@/config/site'

import { canUseQcWithToken } from '@/lib/qcAccess'

export function getSaqcServiceUrl(): string | null {
  return process.env.SAQC_SERVICE_URL?.trim().replace(/\/+$/, '') || null
}

/** Shared by the page and API; the browser's role check is only for navigation. */
export async function getQcAccess(options?: {
  source: ConfiguredDataSource
  token?: string | null
}): Promise<200 | 401 | 403 | 404 | 503> {
  if (!getSaqcServiceUrl()) return 404
  const authorizationEnabled =
    options?.source.authorizationEnabled ?? siteConfig.authorizationEnabled
  if (!authorizationEnabled) return 200

  const token = options ? options.token : (await cookies()).get('token')?.value
  if (!token) return 401
  if (!canUseQcWithToken(token, authorizationEnabled)) return 403

  try {
    // Unlike public observation reads, /Users always authenticates tokens,
    // even when ANONYMOUS_VIEWER is enabled. A non-admin editor receives the
    // specific "Insufficient privileges." response after authentication.
    // Do not use /Refresh as a probe: it can revoke the existing token.
    const response = await fetch(
      `${options?.source.apiRoot ?? siteConfig.api_root}/Users`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }
    )
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
