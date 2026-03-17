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
import { useEffect, useMemo, useState } from 'react'

import { useTemporal } from '@/context/TemporalContext'
import { appendTemporalParams } from '@/server/temporal'

export function useTemporalQuery<T>(baseUrl: string) {
  const { mode, asOf, fromTo } = useTemporal()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const activeUrl = useMemo(() => {
    return appendTemporalParams(baseUrl, { mode, asOf, fromTo })
  }, [baseUrl, mode, asOf, fromTo])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    fetch(activeUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error fetching ${activeUrl}: ${response.status}`)
        }
        return response.json()
      })
      .then((payload) => {
        if (mounted) setData(payload)
      })
      .catch((err) => {
        if (mounted) setError(err as Error)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [activeUrl])

  return { data, loading, error, activeUrl }
}
