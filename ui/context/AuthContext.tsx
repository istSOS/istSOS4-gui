'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

import fetchRefresh from '@/server/fetchRefresh'
import { fetchUserRole } from '@/server/fetchUser'

type AuthContextType = {
  token: string | null
  setToken: (token: string | null) => void
  role: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  role: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  //decode jwt token
  const decodeToken = (jwt: string) => {
    try {
      return JSON.parse(atob(jwt.split('.')[1]))
    } catch {
      return null
    }
  }

  //refresh token if expiring
  useEffect(() => {
    if (!token) return

    const payload = decodeToken(token)
    if (!payload?.exp) return

    const now = Math.floor(Date.now() / 1000)
    const timeLeft = payload.exp - now

    if (timeLeft < 120) {
      fetchRefresh(token).then((newToken) => {
        if (newToken) setToken(newToken)
        else setToken(null)
      })
    }
  }, [token])

  //fetch user role
  useEffect(() => {
    const getRole = async () => {
      if (!token) {
        setRole(null)
        return
      }

      const payload = decodeToken(token)
      const username = payload?.username

      if (!username) return

      try {
        const userRole = await fetchUserRole(token, username)
        setRole(userRole)
      } catch {
        setRole(null)
      }
    }

    getRole()
  }, [token])

  //initialize token from local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token')
      if (storedToken) setTokenState(storedToken)
      setLoading(false)
    }
  }, [])

  //set token
  const setToken = (newToken: string | null) => {
    setTokenState(newToken)

    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
      setRole(null)
    }
  }

  return (
    <AuthContext.Provider value={{ token, setToken, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}