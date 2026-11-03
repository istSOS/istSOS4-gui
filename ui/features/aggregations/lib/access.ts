import { decodeTokenPayload, isTokenExpired } from '@/lib/auth'

// Navigation only. Every server request also goes through the backend's
// authenticated, administrator-only AggregationJobs endpoint.
export function canManageAggregations(
  token: string | null | undefined,
  authorizationEnabled: boolean
) {
  return (
    !authorizationEnabled ||
    (!isTokenExpired(token) &&
      decodeTokenPayload(token)?.role === 'administrator')
  )
}
