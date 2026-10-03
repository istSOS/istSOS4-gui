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
 * @file features/from-to/lib/versionedEntities.ts
 *
 * The entity types that have a history, and how to name one of their versions.
 *
 * Every table put under system-time versioning gets a `_traveltime` view, and
 * `$from_to` reads it. Probed against a local istSOS4, nine sets answer 200 and
 * carry `systemTimeValidity`; `Commits` answers 400, because a commit is what
 * *causes* a version rather than something that has them.
 *
 * The reason this is a registry rather than a label lookup: **two of the nine
 * have no `name` field**. A HistoricalLocation is identified by its `time` and
 * an Observation by its `result` and `phenomenonTime`, so a page that reads
 * `body.name` shows a blank heading for both. Each type therefore says how to
 * title one of its own versions.
 *
 * Type names are OGC SensorThings terms and are deliberately not translated —
 * they are the same words the API path uses, which is what the breadcrumb shows.
 */

/** One version's fields, as `extractBody` returns them. */
type VersionBody = Record<string, unknown>

export type VersionedEntity = {
  /** URL segment and `@iot` collection name, e.g. `Things`. */
  set: string
  /** Singular term shown beside the title, e.g. `Thing`. */
  singular: string
  /**
   * Whether the type has a `name` column.
   *
   * Asking for one that does not exist is not ignored: `$select=@iot.id,name`
   * on Observations answers `404 Invalid field: name`. A caller that selects
   * `name` blindly therefore loses the whole response for the two types that
   * lack it, which is how HistoricalLocations went missing from every Thing's
   * entity rail.
   */
  hasName: boolean
  /**
   * A heading for one version. Receives the newest version's body; returns an
   * empty string when the body cannot identify itself, so the caller can fall
   * back to the path.
   */
  title: (body: VersionBody) => string
}

function text(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return ''
  return String(value)
}

/** `name`, which seven of the nine types carry. */
function byName(body: VersionBody): string {
  return text(body.name)
}

/**
 * The instant a phenomenonTime refers to. The API reports it either as an
 * instant or as a `start/end` interval, and the start is the useful half.
 */
function instantOf(value: unknown): string {
  const raw = text(value)
  if (!raw) return ''
  const slash = raw.indexOf('/')
  return slash === -1 ? raw : raw.slice(0, slash)
}

export const VERSIONED_ENTITIES: VersionedEntity[] = [
  { set: 'Things', singular: 'Thing', hasName: true, title: byName },
  { set: 'Locations', singular: 'Location', hasName: true, title: byName },
  { set: 'Datastreams', singular: 'Datastream', hasName: true, title: byName },
  { set: 'Sensors', singular: 'Sensor', hasName: true, title: byName },
  { set: 'ObservedProperties', singular: 'ObservedProperty', hasName: true, title: byName },
  { set: 'FeaturesOfInterest', singular: 'FeatureOfInterest', hasName: true, title: byName },
  { set: 'Networks', singular: 'Network', hasName: true, title: byName },
  {
    // No name: a historical location is a Thing's position at an instant.
    set: 'HistoricalLocations',
    singular: 'HistoricalLocation',
    hasName: false,
    title: (body) => instantOf(body.time),
  },
  {
    // No name: identified by what was measured and when.
    set: 'Observations',
    singular: 'Observation',
    hasName: false,
    title: (body) => {
      const result = text(body.result)
      const when = instantOf(body.phenomenonTime)
      if (result && when) return `${result} @ ${when}`
      return result || when
    },
  },
]

const BY_SET = new Map(VERSIONED_ENTITIES.map((entity) => [entity.set, entity]))

/**
 * Navigation-link name -> the collection it points at.
 *
 * An entity advertises its relations as `<Name>@iot.navigationLink` keys, and
 * the name is singular for a to-one relation (`Datastreams(1)` exposes `Thing`,
 * `Sensor`, `ObservedProperty`) but plural for a to-many (`Things(1)` exposes
 * `Locations`, `Datastreams`). Only the plural form is also an addressable
 * collection, so the singular ones need mapping before a path can be built.
 *
 * Reading relations off the entity rather than hard-coding them per type is
 * what lets the entity rail work for all nine versioned types without a table
 * of its own.
 */
const RELATION_TO_SET = new Map<string, string>([
  ['Thing', 'Things'],
  ['Location', 'Locations'],
  ['HistoricalLocation', 'HistoricalLocations'],
  ['Datastream', 'Datastreams'],
  ['Sensor', 'Sensors'],
  ['ObservedProperty', 'ObservedProperties'],
  ['FeatureOfInterest', 'FeaturesOfInterest'],
  ['Observation', 'Observations'],
  ['Network', 'Networks'],
  ...VERSIONED_ENTITIES.map((entity) => [entity.set, entity.set] as [string, string]),
])

/**
 * The collection a navigation-link name addresses, or `null` when it leads
 * somewhere without a history — `Commit` being the one that matters.
 */
export function relationToSet(relation: string | null): string | null {
  if (!relation) return null
  const set = RELATION_TO_SET.get(relation)
  return set && BY_SET.has(set) ? set : null
}

/** The registry entry for an entity set, or `null` if it has no history. */
export function describeEntitySet(set: string | null): VersionedEntity | null {
  if (!set) return null
  return BY_SET.get(set) ?? null
}

/**
 * Whether this entity set can be read with `$from_to`.
 *
 * `Commits` is the notable false: it answers 400, since a commit is not itself
 * versioned. Offering it a history page would promise something the API cannot
 * deliver.
 */
export function isVersionedSet(set: string | null): boolean {
  return describeEntitySet(set) !== null
}

/**
 * Whether `name` may be named in a `$select` for this set.
 *
 * Unknown sets answer false: selecting a field that does not exist costs the
 * whole response, so the safe default is not to ask.
 */
export function hasNameField(set: string | null): boolean {
  return describeEntitySet(set)?.hasName ?? false
}

/** Singular term for an entity set, falling back to the set name itself. */
export function singularOf(set: string | null): string {
  return describeEntitySet(set)?.singular ?? set ?? ''
}

/**
 * A heading for an entity, from the newest version in hand.
 *
 * Returns an empty string when the type cannot identify itself from that body,
 * leaving the caller to fall back to the resource path.
 */
export function titleOf(set: string | null, body: VersionBody | null): string {
  const entity = describeEntitySet(set)
  if (!entity || !body) return ''
  try {
    return entity.title(body).trim()
  } catch {
    return ''
  }
}
