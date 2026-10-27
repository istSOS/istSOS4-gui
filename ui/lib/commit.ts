import { isVersioningEnabled } from '@/config/versioning'

/** The backend may require write metadata even when GUI history is hidden. */
export function commitMessageHeaders(
  message: string | undefined,
  fallback: string
): Record<string, string> {
  const resolved = message?.trim() || (!isVersioningEnabled ? fallback : '')
  return resolved ? { 'commit-message': resolved } : {}
}
