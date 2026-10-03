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

/**
 * @file features/observations/lib/qualitySchemeStore.ts
 *
 * Where a viewer's own quality rules live, and which rules apply to a
 * datastream.
 *
 * Rules are personal and stay in this browser: nothing here is written to the
 * API, so choosing how to read a datastream's quality never changes what anyone
 * else sees. A datastream resolves to, most specific first:
 *
 *  1. the viewer's rules for that datastream;
 *  2. the viewer's rules for its data source (every datastream that came in
 *     through the same ingest usually shares one convention);
 *  3. the istSOS quality index.
 */

import { siteConfig } from '@/config/site'
import type { Datastream } from '@/types/domain'

import {
  ISTSOS_QUALITY_SCHEME,
  QUALITY_CLASSES,
  QUALITY_OPS,
  sameQualityScheme,
  type QualityClass,
  type QualityRule,
  type QualityScheme,
} from './resultQuality'

const STORAGE_KEY = 'quality-schemes'

export type QualitySchemeScope = 'datastream' | 'source'

/** Which level of the resolution order a datastream's rules came from. */
export type QualitySchemeSource = QualitySchemeScope | 'default'

type StoredSchemes = {
  version: 1
  /** `endpoint::datastreamId` → scheme */
  datastreams: Record<string, QualityScheme>
  /** `endpoint` → scheme */
  sources: Record<string, QualityScheme>
}

const emptyStore = (): StoredSchemes => ({
  version: 1,
  datastreams: {},
  sources: {},
})

const isBrowser = () => typeof window !== 'undefined'

const normalizeEndpoint = (endpoint: string) =>
  endpoint.trim().replace(/\/+$/, '')

function sourceKeyOf(datastream: Datastream | null | undefined): string {
  return normalizeEndpoint(
    String(datastream?.__sourceEndpoint || siteConfig.api_root || '')
  )
}

function datastreamKeyOf(datastream: Datastream | null | undefined): string {
  const id = String(datastream?.['@iot.id'] ?? datastream?.id ?? '')
  return `${sourceKeyOf(datastream)}::${id}`
}

// ── validation ────────────────────────────────────────────────────────────
// Storage is written by this module, but it outlives any one version of it and
// can be edited by hand. Anything that does not read back as a whole scheme is
// dropped, so a bad entry falls back to the default instead of breaking the
// chart.

const isVerdict = (value: unknown): value is QualityClass =>
  QUALITY_CLASSES.includes(value as QualityClass)

const finiteOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function readRule(raw: unknown): QualityRule | null {
  if (!raw || typeof raw !== 'object') return null
  const rule = raw as Record<string, unknown>
  if (!QUALITY_OPS.includes(rule.op as QualityRule['op'])) return null
  if (!isVerdict(rule.verdict)) return null
  return {
    op: rule.op as QualityRule['op'],
    value: finiteOrNull(rule.value),
    max: finiteOrNull(rule.max),
    values: Array.isArray(rule.values)
      ? rule.values.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value)
        )
      : undefined,
    verdict: rule.verdict,
  }
}

function readScheme(raw: unknown): QualityScheme | null {
  if (!raw || typeof raw !== 'object') return null
  const scheme = raw as Record<string, unknown>
  if (scheme.version !== 1 || !Array.isArray(scheme.rules)) return null
  if (!isVerdict(scheme.fallback) || scheme.fallback === 'none') return null
  const rules = scheme.rules.map(readRule)
  if (rules.some((rule) => rule === null)) return null
  const labels: Partial<Record<QualityClass, string>> = {}
  if (scheme.labels && typeof scheme.labels === 'object') {
    for (const [key, label] of Object.entries(scheme.labels)) {
      if (isVerdict(key) && typeof label === 'string' && label.trim()) {
        labels[key] = label.trim().slice(0, 40)
      }
    }
  }
  return {
    version: 1,
    rules: rules as QualityRule[],
    fallback: scheme.fallback,
    ...(Object.keys(labels).length ? { labels } : {}),
  }
}

function readSchemeMap(raw: unknown): Record<string, QualityScheme> {
  const out: Record<string, QualityScheme> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw)) {
    const scheme = readScheme(value)
    if (scheme) out[key] = scheme
  }
  return out
}

// ── storage ──────────────────────────────────────────────────────────────

/**
 * Parsed once per change rather than on every classification: the chart asks
 * for a scheme per series on every render.
 */
let cache: StoredSchemes | null = null
let revision = 0
const listeners = new Set<() => void>()

function readStore(): StoredSchemes {
  if (cache) return cache
  if (!isBrowser()) return emptyStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    cache =
      parsed && parsed.version === 1
        ? {
            version: 1,
            datastreams: readSchemeMap(parsed.datastreams),
            sources: readSchemeMap(parsed.sources),
          }
        : emptyStore()
  } catch {
    cache = emptyStore()
  }
  return cache
}

function writeStore(next: StoredSchemes) {
  cache = next
  revision += 1
  if (isBrowser()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage full or blocked: the rules still apply for this session.
    }
  }
  listeners.forEach((listener) => listener())
}

if (isBrowser()) {
  // Another tab saved rules: re-read them, so both tabs judge alike.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    cache = null
    revision += 1
    listeners.forEach((listener) => listener())
  })
}

/** For `useSyncExternalStore`. */
export function subscribeQualitySchemes(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** For `useSyncExternalStore` — changes whenever any stored scheme does. */
export function getQualitySchemesRevision() {
  return revision
}

// ── public API ───────────────────────────────────────────────────────────

export type ResolvedQualityScheme = {
  scheme: QualityScheme
  source: QualitySchemeSource
}

export function resolveQualityScheme(
  datastream: Datastream | null | undefined
): ResolvedQualityScheme {
  const store = readStore()
  const own = store.datastreams[datastreamKeyOf(datastream)]
  if (own) return { scheme: own, source: 'datastream' }
  const shared = store.sources[sourceKeyOf(datastream)]
  if (shared) return { scheme: shared, source: 'source' }
  return { scheme: ISTSOS_QUALITY_SCHEME, source: 'default' }
}

/**
 * Save `scheme` for a datastream, or for every datastream of its source.
 *
 * Saving at source level clears the datastream's own entry, or the new rules
 * would not apply to the very datastream they were written against.
 *
 * The default scheme is not stored as a copy wherever removing an entry gives
 * the same result, so a datastream keeps following the default if that ever
 * changes. The one case that needs a copy is a datastream going back to the
 * default while its source has rules of its own: without an entry it would
 * inherit those instead.
 */
export function saveQualityScheme(
  datastream: Datastream | null | undefined,
  scope: QualitySchemeScope,
  scheme: QualityScheme
) {
  const store = readStore()
  const next: StoredSchemes = {
    version: 1,
    datastreams: { ...store.datastreams },
    sources: { ...store.sources },
  }
  const dsKey = datastreamKeyOf(datastream)
  const srcKey = sourceKeyOf(datastream)
  const isDefault = sameQualityScheme(scheme, ISTSOS_QUALITY_SCHEME)
  if (scope === 'datastream') {
    if (isDefault && !next.sources[srcKey]) delete next.datastreams[dsKey]
    else next.datastreams[dsKey] = scheme
  } else {
    delete next.datastreams[dsKey]
    if (isDefault) delete next.sources[srcKey]
    else next.sources[srcKey] = scheme
  }
  writeStore(next)
}
