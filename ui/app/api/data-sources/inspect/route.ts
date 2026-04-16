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
import { NextResponse } from 'next/server'

const isReachableResponse = (response: Response) => {
  return response.ok || response.status === 401 || response.status === 403
}

const appendTopParam = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}$top=1`

const normalizeApiRoot = (value: string) => value.trim().replace(/\/+$/, '')

async function detectNetworkEnabled(
  apiRoot: string,
  headers: HeadersInit = {}
): Promise<boolean> {
  const candidates = [`${apiRoot}/Networks?$top=1`, `${apiRoot}/Network?$top=1`]

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })

      if (isReachableResponse(response)) return true
      if (response.status !== 404) return false
    } catch {
      return false
    }
  }

  return false
}

async function probeSourceStatus(
  apiRoot: string,
  headers: HeadersInit = {}
): Promise<{
  status: 'online' | 'offline'
  error: string | null
}> {
  try {
    const response = await fetch(appendTopParam(`${apiRoot}/Things`), {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (response.ok) {
      return { status: 'online', error: null }
    }

    if (response.status === 401 || response.status === 403) {
      return { status: 'online', error: 'Authentication required' }
    }

    return {
      status: 'offline',
      error: `${response.status} ${response.statusText}`,
    }
  } catch (error) {
    return {
      status: 'offline',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_probe_failed' },
      { status: 400 }
    )
  }

  const mode =
    'mode' in payload && typeof payload.mode === 'string' ? payload.mode : null
  const rawApiRoot =
    'apiRoot' in payload && typeof payload.apiRoot === 'string'
      ? payload.apiRoot
      : ''
  const apiRoot = normalizeApiRoot(rawApiRoot)

  if (!mode || !apiRoot) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_probe_failed' },
      { status: 400 }
    )
  }

  if (mode === 'login-check') {
    try {
      const response = await fetch(`${apiRoot}/Login`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (response.status === 404) {
        return NextResponse.json(
          { ok: false, errorCode: 'validation_login_missing' },
          { status: 200 }
        )
      }

      return NextResponse.json({ ok: true }, { status: 200 })
    } catch {
      return NextResponse.json(
        { ok: false, errorCode: 'validation_login_check_failed' },
        { status: 200 }
      )
    }
  }

  if (mode === 'anonymous') {
    const networkEnabled = await detectNetworkEnabled(apiRoot)
    const probe = await probeSourceStatus(apiRoot)

    return NextResponse.json(
      {
        ok: true,
        networkEnabled,
        status: probe.status,
        error: probe.error,
      },
      { status: 200 }
    )
  }

  if (mode === 'authenticated') {
    const username =
      'username' in payload && typeof payload.username === 'string'
        ? payload.username.trim()
        : ''
    const password =
      'password' in payload && typeof payload.password === 'string'
        ? payload.password.trim()
        : ''

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, errorCode: 'validation_credentials_required' },
        { status: 200 }
      )
    }

    try {
      const loginResponse = await fetch(`${apiRoot}/Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username,
          password,
          grant_type: 'password',
        }).toString(),
        cache: 'no-store',
      })

      if (!loginResponse.ok) {
        return NextResponse.json(
          { ok: false, errorCode: 'validation_login_failed' },
          { status: 200 }
        )
      }

      const loginPayload = await loginResponse.json().catch(() => null)
      const token =
        loginPayload &&
        typeof loginPayload === 'object' &&
        'access_token' in loginPayload &&
        typeof loginPayload.access_token === 'string'
          ? loginPayload.access_token
          : null

      if (!token) {
        return NextResponse.json(
          { ok: false, errorCode: 'validation_login_failed' },
          { status: 200 }
        )
      }

      const headers = { Authorization: `Bearer ${token}` }
      const networkEnabled = await detectNetworkEnabled(apiRoot, headers)
      const probe = await probeSourceStatus(apiRoot, headers)

      return NextResponse.json(
        {
          ok: true,
          networkEnabled,
          status: probe.status,
          error: probe.error,
          accessToken: token,
        },
        { status: 200 }
      )
    } catch {
      return NextResponse.json(
        { ok: false, errorCode: 'validation_login_failed' },
        { status: 200 }
      )
    }
  }

  return NextResponse.json(
    { ok: false, errorCode: 'validation_probe_failed' },
    { status: 400 }
  )
}
