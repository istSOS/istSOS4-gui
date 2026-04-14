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
import { getSession } from '@/services/auth'
import React, { createContext, useContext, useEffect, useState } from 'react'

import { siteConfig } from '@/config/site'

type AuthContextType = {
  authenticated: boolean
  username: string | null
  setSessionState: (authenticated: boolean, username?: string | null) => void
  refreshSession: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  username: null,
  setSessionState: () => {},
  refreshSession: async () => {},
  loading: true,
})

//create the auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const setSessionState = (
    isAuthenticated: boolean,
    nextUsername: string | null = null
  ) => {
    setAuthenticated(isAuthenticated)
    setUsername(nextUsername)
  }

  const refreshSession = async () => {
    if (!siteConfig.authorizationEnabled) {
      setSessionState(true, null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const session = await getSession()
      setSessionState(!!session?.authenticated, session?.username ?? null)
    } catch {
      setSessionState(false, null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshSession()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        username,
        setSessionState,
        refreshSession,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

//custom hook to use auth context
export function useAuth() {
  return useContext(AuthContext)
}
