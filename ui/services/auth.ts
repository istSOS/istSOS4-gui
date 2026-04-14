'use server'

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
import { withAuthHeaders } from '@/services/fetch'

import { cookies } from 'next/headers'

import { siteConfig } from '@/config/site'
import { getTokenUsername, isTokenExpired } from '@/lib/auth'

const TOKEN_COOKIE_NAME = 'token'

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

function getMaxAgeFromToken(token: string) {
  try {
    const payloadBase64 = token.split('.')[1]
    if (!payloadBase64) return undefined

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
    const now = Math.floor(Date.now() / 1000)
    return typeof payload?.exp === 'number'
      ? Math.max(payload.exp - now, 0)
      : undefined
  } catch {
    return undefined
  }
}

export async function getSession() {
  if (!siteConfig.authorizationEnabled) {
    return { authenticated: true, username: null }
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value ?? null

  if (!token || isTokenExpired(token)) {
    return { authenticated: false, username: null }
  }

  return {
    authenticated: true,
    username: getTokenUsername(token),
  }
}

export async function login(username: string, password: string) {
  try {
    const response = await fetch(`${siteConfig.api_root}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username,
        password,
        grant_type: 'password',
      }).toString(),
    })
    if (!response.ok) throw new Error('Login failed')
    const data = await response.json()

    if (!data?.access_token) {
      throw new Error('Login response missing access token')
    }

    const maxAge = getMaxAgeFromToken(data.access_token)
    const cookieStore = await cookies()
    cookieStore.set(TOKEN_COOKIE_NAME, data.access_token, {
      ...baseCookieOptions,
      ...(typeof maxAge === 'number' ? { maxAge } : {}),
    })

    return {
      success: true,
      username: getTokenUsername(data.access_token),
    }
  } catch (e) {
    console.error(e)
    return null
  }
}

export async function refresh(token?: string | null) {
  if (!siteConfig.authorizationEnabled) return null

  try {
    const response = await fetch(`${siteConfig.api_root}/Refresh`, {
      method: 'POST',
      headers: await withAuthHeaders(token),
    })
    if (!response.ok) throw new Error('Refresh failed')
    const data = await response.json()

    if (data?.access_token) {
      const maxAge = getMaxAgeFromToken(data.access_token)
      const cookieStore = await cookies()
      cookieStore.set(TOKEN_COOKIE_NAME, data.access_token, {
        ...baseCookieOptions,
        ...(typeof maxAge === 'number' ? { maxAge } : {}),
      })
    }

    return data.access_token
  } catch (e) {
    console.error(e)
    return null
  }
}

export async function logout(token?: string | null) {
  if (!siteConfig.authorizationEnabled) return true

  try {
    const response = await fetch(`${siteConfig.api_root}/Logout`, {
      method: 'POST',
      headers: await withAuthHeaders(token),
    })
    if (!response.ok) throw new Error('Logout failed')

    const cookieStore = await cookies()
    cookieStore.delete(TOKEN_COOKIE_NAME)

    return true
  } catch (e) {
    console.error(e)

    const cookieStore = await cookies()
    cookieStore.delete(TOKEN_COOKIE_NAME)

    return false
  }
}
