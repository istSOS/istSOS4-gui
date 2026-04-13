'use client'

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
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { TemporalMode, TemporalState } from '@/types/temporal'

type TemporalContextType = TemporalState & {
  setMode: (mode: TemporalMode) => void
  setAsOf: (asOf: string | null) => void
  setFromTo: (fromTo: [string, string] | null) => void
  reset: () => void
}

const defaultState: TemporalState = {
  mode: 'current',
  asOf: null,
  fromTo: null,
}

const TemporalContext = createContext<TemporalContextType>({
  ...defaultState,
  setMode: () => {},
  setAsOf: () => {},
  setFromTo: () => {},
  reset: () => {},
})

function isSameState(a: TemporalState, b: TemporalState) {
  return (
    a.mode === b.mode &&
    a.asOf === b.asOf &&
    a.fromTo?.[0] === b.fromTo?.[0] &&
    a.fromTo?.[1] === b.fromTo?.[1]
  )
}

function parseTemporalFromUrl(params: URLSearchParams): TemporalState {
  const mode = (params.get('temporal_mode') || 'current') as TemporalMode
  const asOf = params.get('as_of')
  const fromToRaw = params.get('from_to')
  const fromTo = fromToRaw?.includes(',')
    ? (fromToRaw.split(',').slice(0, 2) as [string, string])
    : null

  if (mode === 'as_of' && asOf) {
    return { mode, asOf, fromTo: null }
  }

  if (mode === 'from_to' && fromTo) {
    return { mode, asOf: null, fromTo }
  }

  return defaultState
}

export function TemporalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [state, setState] = useState<TemporalState>(defaultState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const next = parseTemporalFromUrl(new URLSearchParams(searchParams.toString()))
    setState((prev) =>
      prev.mode === next.mode &&
      prev.asOf === next.asOf &&
      prev.fromTo?.[0] === next.fromTo?.[0] &&
      prev.fromTo?.[1] === next.fromTo?.[1]
        ? prev
        : next
    )
    setHydrated(true)
  }, [searchParams])

  useEffect(() => {
    if (!hydrated) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete('temporal_mode')
    params.delete('as_of')
    params.delete('from_to')

    if (state.mode !== 'current') {
      params.set('temporal_mode', state.mode)
      if (state.mode === 'as_of' && state.asOf) {
        params.set('as_of', state.asOf)
      }
      if (state.mode === 'from_to' && state.fromTo) {
        params.set('from_to', `${state.fromTo[0]},${state.fromTo[1]}`)
      }
    }

    const current = searchParams.toString()
    const next = params.toString()
    if (current !== next) {
      const url = next ? `${pathname}?${next}` : pathname
      router.replace(url, { scroll: false })
    }
  }, [state, hydrated, pathname, router, searchParams])

  const value = useMemo<TemporalContextType>(
    () => ({
      ...state,
      setMode: (mode: TemporalMode) => {
        setState((prev) => {
          let next: TemporalState

          if (mode === 'current') {
            next = defaultState
          } else if (mode === 'as_of') {
            next = {
              mode,
              asOf: prev.asOf || new Date().toISOString(),
              fromTo: null,
            }
          } else {
            const now = new Date()
            const start = new Date(now.getTime() - 60 * 60 * 1000)
            next = {
              mode,
              asOf: null,
              fromTo: prev.fromTo || [start.toISOString(), now.toISOString()],
            }
          }

          return isSameState(prev, next) ? prev : next
        })
      },
      setAsOf: (asOf: string | null) => {
        setState((prev) => {
          const next: TemporalState = {
            mode: asOf ? 'as_of' : 'current',
            asOf,
            fromTo: null,
          }
          return isSameState(prev, next) ? prev : next
        })
      },
      setFromTo: (fromTo: [string, string] | null) => {
        setState((prev) => {
          const next: TemporalState = {
            mode: fromTo ? 'from_to' : 'current',
            asOf: null,
            fromTo,
          }
          return isSameState(prev, next) ? prev : next
        })
      },
      reset: () => {
        setState((prev) => (isSameState(prev, defaultState) ? prev : defaultState))
      },
    }),
    [state]
  )

  return <TemporalContext.Provider value={value}>{children}</TemporalContext.Provider>
}

export function useTemporal() {
  return useContext(TemporalContext)
}
