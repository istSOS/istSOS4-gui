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
import { getDataSourceToken } from '@/lib/dataSourceTokens'

const resolveToken = (token?: string | null, endpoint?: string) => {
  if (token) return token
  if (!endpoint) return null
  return getDataSourceToken(endpoint)
}

export function withAuthHeaders(
  token?: string | null,
  headers: Record<string, string> = {},
  endpoint?: string
) {
  const resolvedToken = resolveToken(token, endpoint)
  if (!resolvedToken) return headers

  return {
    ...headers,
    Authorization: `Bearer ${resolvedToken}`,
  }
}

export const fetchData = async (endpoint: string, token?: string | null) => {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: withAuthHeaders(token, {}, endpoint),
    })
    if (!response.ok) {
      throw new Error(
        `Error fetching data: ${response.status} ${response.statusText}`
      )
    }
    const text = await response.text()
    const data = JSON.parse(text)
    return data
  } catch (error) {
    console.error('Error fetching data:', error)
    return null
  }
}
