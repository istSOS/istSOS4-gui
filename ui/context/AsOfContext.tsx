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

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AsOfContextValue = {
  /** ISO-8601 datetime string to query, or null when showing live data */
  asOfDate: string | null
  /** True whenever asOfDate is set (i.e. not live mode) */
  isSnapshot: boolean
  /**
   * Set the snapshot datetime.
   * Pass an ISO string to activate snapshot mode.
   * Pass null to return to live mode (same as clearSnapshot).
   */
  setAsOfDate: (date: string | null) => void
  /** Convenience: clears the snapshot and returns to live mode */
  clearSnapshot: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AsOfContext = createContext<AsOfContextValue | null>(null)
AsOfContext.displayName = 'AsOfContext'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AsOfProvider({ children }: { children: ReactNode }) {
  const [asOfDate, setAsOfDateState] = useState<string | null>(null)

  const setAsOfDate = useCallback((date: string | null) => {
    setAsOfDateState(date ?? null)
  }, [])

  const clearSnapshot = useCallback(() => {
    setAsOfDateState(null)
  }, [])

  const isSnapshot = asOfDate !== null

  const value = useMemo<AsOfContextValue>(
    () => ({ asOfDate, isSnapshot, setAsOfDate, clearSnapshot }),
    [asOfDate, isSnapshot, setAsOfDate, clearSnapshot]
  )

  return <AsOfContext.Provider value={value}>{children}</AsOfContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAsOf(): AsOfContextValue {
  const ctx = useContext(AsOfContext)
  if (!ctx) {
    throw new Error('useAsOf must be used inside <AsOfProvider>')
  }
  return ctx
}
