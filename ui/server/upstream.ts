// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @file server/upstream.ts
 *
 * Shared plumbing for route handlers that call the istSOS4 API on the
 * browser's behalf. The API is reached over the Docker network name configured
 * in NEXT_PUBLIC_ISTSOS4_URL, which a browser cannot resolve, and it sends no
 * CORS headers — so such reads run inside the Next server instead.
 */

import { cookies } from 'next/headers'

import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'

export const normalizeApiRoot = (value: string) =>
  value.trim().replace(/\/+$/, '')

/**
 * Resolves a client-supplied endpoint against the configured data sources.
 *
 * Only endpoints this deployment is configured to talk to are accepted — the
 * route must never become an open proxy for arbitrary URLs. Returns null when
 * the endpoint is not one of ours.
 */
export async function resolveConfiguredEndpoint(
  requested?: string | null
): Promise<string | null> {
  const sources = await readDataSourcesConfigFile()
  const normalizedRequested = requested ? normalizeApiRoot(requested) : ''

  if (!normalizedRequested) {
    return normalizeApiRoot(getPrimaryDataSource(sources).apiRoot)
  }

  const match = sources.find(
    (source) => normalizeApiRoot(source.apiRoot) === normalizedRequested
  )
  return match ? normalizeApiRoot(match.apiRoot) : null
}

/** Bearer token for the request: the caller's, falling back to the cookie. */
export async function resolveAuthHeaders(
  token?: string | null
): Promise<Record<string, string>> {
  const explicit = typeof token === 'string' ? token.trim() : ''
  if (explicit) return { Authorization: `Bearer ${explicit}` }

  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('token')?.value ?? ''
  return cookieToken ? { Authorization: `Bearer ${cookieToken}` } : {}
}
