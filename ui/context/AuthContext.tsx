'use client'

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
import { refresh } from '@/services/auth'
import { deleteCookie, setCookie } from 'cookies-next'
import React, { createContext, useContext, useEffect, useState } from 'react'

import { siteConfig } from '@/config/site'

import { canWriteWithToken, decodeTokenPayload } from '@/lib/auth'
import {
  removeDataSourceToken,
  setDataSourceToken,
} from '@/lib/dataSourceTokens'

type AuthContextType = {
  token: string | null
  setToken: (token: string | null) => void
  loading: boolean
  canWrite: boolean
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  loading: true,
  canWrite: false,
})

//create the auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  //check token expiration and refresh if necessary
  useEffect(() => {
    if (!siteConfig.authorizationEnabled) return
    if (!token) return
    const payload = decodeTokenPayload(token)
    if (!payload?.exp) return

    //set now to current time in seconds
    const now = Math.floor(Date.now() / 1000)

    const timeLeft = payload.exp - now

    //refresh 2 minutes before expiry. A timer, not a one-off check: checking
    //only when the token changes let an open tab outlive its token while still
    //showing the user as signed in — unnoticed on reads when the API allows
    //anonymous viewers, since those ignore the token.
    //ACCESS_TOKEN_EXPIRE_MINUTES varies per deployment (the API defaults to 5).
    //A token living under 4 minutes is refreshed at half its remaining life
    //instead, or each refresh would be due at once and loop; the delay is
    //capped at setTimeout's 32-bit limit, past which it would fire immediately.
    const refreshIn = timeLeft > 240 ? timeLeft - 120 : Math.max(timeLeft / 2, 0)
    const timer = setTimeout(
      () => {
        refresh(token).then((newToken) => {
          //if the refresh was successful, set the new token
          if (newToken) setToken(newToken)
          //if the refresh failed, clear the token
          else setToken(null)
        })
      },
      Math.min(refreshIn * 1000, 2_147_483_647)
    )
    return () => clearTimeout(timer)
  }, [token])

  //initialize token from local storage
  useEffect(() => {
    if (!siteConfig.authorizationEnabled) {
      setLoading(false)
      return
    }

    if (typeof window !== 'undefined') {
      //take the token from local storage if it exists
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        setTokenState(storedToken)
        setDataSourceToken(siteConfig.api_root, storedToken)
      }
      setLoading(false)
    }
  }, [])

  //set token in state and local storage
  const setToken = (newToken: string | null) => {
    setTokenState(newToken)

    if (!siteConfig.authorizationEnabled) {
      return
    }

    if (newToken) {
      localStorage.setItem('token', newToken)
      setDataSourceToken(siteConfig.api_root, newToken)
      const payload = decodeTokenPayload(newToken)
      const now = Math.floor(Date.now() / 1000)
      const maxAge =
        typeof payload?.exp === 'number'
          ? Math.max(payload.exp - now, 0)
          : undefined

      setCookie('token', newToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        ...(typeof maxAge === 'number' ? { maxAge } : {}),
        path: '/',
      })
    } else {
      localStorage.removeItem('token')
      removeDataSourceToken(siteConfig.api_root)
      deleteCookie('token')
    }
  }

  return (
    <AuthContext.Provider
      value={{ token, setToken, loading, canWrite: canWriteWithToken(token) }}
    >
      {children}
    </AuthContext.Provider>
  )
}

//custom hook to use auth context
export function useAuth() {
  return useContext(AuthContext)
}
