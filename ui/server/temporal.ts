/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { TemporalState } from '@/types/temporal'

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

export function appendTemporalParams(
  endpoint: string,
  temporal?: TemporalState
): string {
  if (!temporal || temporal.mode === 'current') return endpoint

  const absolute = isAbsoluteUrl(endpoint)
  const base = absolute ? undefined : 'http://localhost'
  const url = new URL(endpoint, base)

  if (temporal.mode === 'as_of' && temporal.asOf) {
    url.searchParams.set('$as_of', temporal.asOf)
    url.searchParams.delete('$from_to')
  }

  if (temporal.mode === 'from_to' && temporal.fromTo) {
    url.searchParams.set('$from_to', `${temporal.fromTo[0]},${temporal.fromTo[1]}`)
    url.searchParams.delete('$as_of')
  }

  if (absolute) return url.toString()
  return `${url.pathname}${url.search}`
}
