"use server"

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
import { cookies } from 'next/headers'

import { siteConfig } from '@/config/site'

export async function resolveServerToken(token?: string | null) {
  if (!siteConfig.authorizationEnabled) return null
  if (token) return token

  const cookieStore = await cookies()
  return cookieStore.get('token')?.value ?? null
}

export async function withAuthHeaders(
  token?: string | null,
  headers: Record<string, string> = {}
) {
  const resolvedToken = await resolveServerToken(token)
  if (!siteConfig.authorizationEnabled || !resolvedToken) return headers

  return {
    ...headers,
    Authorization: `Bearer ${resolvedToken}`,
  }
}

export const fetchData = async (endpoint: string, token?: string | null) => {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: await withAuthHeaders(token),
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
