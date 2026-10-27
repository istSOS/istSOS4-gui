import { siteConfig } from '@/config/site'

import { decodeTokenPayload, isTokenExpired } from '@/lib/auth'

// Human observation editors only. Each QC data request also authenticates this
// token against its selected source; this helper alone does not verify a JWT.
export function canUseQcWithToken(
  token: string | null | undefined,
  authorizationEnabled = siteConfig.authorizationEnabled
): boolean {
  if (!authorizationEnabled) return true
  if (!token || isTokenExpired(token)) return false
  const role = decodeTokenPayload(token)?.role
  return ['administrator', 'editor', 'obs_manager'].includes(String(role))
}
