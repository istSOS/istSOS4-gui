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

import { useCallback, useSyncExternalStore } from 'react'

import type { Datastream } from '@/types/domain'

import {
  getQualitySchemesRevision,
  resolveQualityScheme,
  subscribeQualitySchemes,
} from './qualitySchemeStore'

/**
 * The quality scheme resolver, re-created whenever the viewer saves rules.
 *
 * Returning a function whose identity follows the store is what lets the chart
 * list it as a memo dependency: saved rules re-classify every row on screen
 * without the chart having to know that rules exist anywhere but here.
 */
export function useQualitySchemeResolver() {
  const revision = useSyncExternalStore(
    subscribeQualitySchemes,
    getQualitySchemesRevision,
    () => 0
  )
  return useCallback(
    (datastream: Datastream | null | undefined) => {
      void revision
      return resolveQualityScheme(datastream)
    },
    [revision]
  )
}

export type QualitySchemeResolver = ReturnType<typeof useQualitySchemeResolver>
