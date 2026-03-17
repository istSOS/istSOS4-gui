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
import { siteConfig } from '@/config/site'

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
    return data
  } catch (e) {
    console.error(e)
    return null
  }
}

export async function refresh(token: string) {
  try {
    const response = await fetch(`${siteConfig.api_root}/Refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) throw new Error('Refresh failed')
    const data = await response.json()
    return data.access_token
  } catch (e) {
    console.error(e)
    return null
  }
}

export async function logout(token: string) {
  try {
    const response = await fetch(`${siteConfig.api_root}/Logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) throw new Error('Logout failed')
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}
