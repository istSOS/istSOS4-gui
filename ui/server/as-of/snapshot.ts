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
 * @file server/as-of/snapshot.ts
 *
 * Builds Things exactly as they stood at one instant of transaction time. The
 * map (every Thing) and the datastream panel (one Thing) both go through
 * `readThingsAsOf`, so the two can never disagree about a snapshot.
 *
 * A single `Things?$as_of=…&$expand=Datastreams(…),Locations` looks like it
 * would do, and it is what the panel used to send. It is wrong in two ways:
 *
 *  - The backend applies `$as_of` to TOP-LEVEL expands only. Anything nested
 *    (`Datastreams($expand=Observations(…))`) is joined against the live
 *    tables, so the "latest reading" was the latest reading *now*. Datastreams
 *    are therefore read as their own collection, which makes Observations,
 *    Network, Sensor and ObservedProperty top-level expands of it.
 *
 *  - `Thing_Location` is not a versioned table. Relocating a Thing rewrites
 *    its link row in place, so `$expand=Locations` joins the snapshot Thing to
 *    its CURRENT Location. Where a Thing stood is instead read from its
 *    HistoricalLocations — versioned, and written on every relocation.
 *
 * HistoricalLocation `time` is not compared with the snapshot instant: it is
 * client-settable and is a different clock (the seeded rows carry times weeks
 * before their Things existed). Which rows existed at the instant is decided
 * by `$as_of` itself; `time` only orders the rows that did.
 */

type Row = Record<string, unknown>

/** Where a snapshot Thing's `Locations` came from. */
export type AsOfLocationSource =
  /** The HistoricalLocation in force at the instant — historically exact. */
  | 'history'
  /** It has HistoricalLocations, but none yet at the instant: not placed then. */
  | 'unplaced'
  /**
   * It WAS placed at the instant, but where is no longer recorded. Deleting a
   * Thing cascades away its HistoricalLocation ↔ Location links, which are not
   * versioned, so a Thing deleted since keeps the fact of its placement and
   * loses the place. Cannot be drawn; must be reported, not dropped silently.
   */
  | 'lost'
  /**
   * No HistoricalLocation ever recorded (legacy or directly inserted data), so
   * only the current Thing ↔ Location link is known. The Location's own
   * geometry is still the one at the instant, but it may not be the Location
   * the Thing had then. Must be shown as approximate, never as fact.
   */
  | 'link'

export class SnapshotReadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/** The API's default page size (TOP_VALUE); asking for more is not honoured. */
const PAGE_SIZE = 100
/** Upper bound on pages per collection, so a looping nextLink cannot hang us. */
const MAX_PAGES = 500

/**
 * Brings a requested instant into the range `$as_of` accepts.
 *
 * The API rejects any instant after its own clock ("AS_OF value cannot be in
 * the future") with a 500. Dragging the scrubber to its right edge asks for
 * "now" by the *browser's* clock, which may run ahead of the API's; two seconds
 * of margin absorbs that without changing what the snapshot shows.
 */
export function clampAsOf(asOfDate: string): string | null {
  const requested = Date.parse(asOfDate)
  if (!Number.isFinite(requested)) return null
  const ceiling = Date.now() - 2000
  const ms = Math.min(requested, ceiling)
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d+Z$/, 'Z')
}

function idOf(row: unknown): string {
  const record = row as Row | null
  return String(record?.['@iot.id'] ?? record?.id ?? '')
}

/**
 * Every row of a collection, following pages with `$skip`.
 *
 * `@iot.nextLink` is only used as the "more pages" signal, never fetched: the
 * API builds it from its own HOSTNAME setting, which is not the address this
 * server reaches it on (inside Docker it is `localhost` of another container).
 */
export async function readAll(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<Row[]> {
  const rows: Row[] = []
  const joiner = url.includes('?') ? '&' : '?'

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(
      `${url}${joiner}$top=${PAGE_SIZE}&$skip=${rows.length}`,
      { headers, cache: 'no-store', signal }
    )
    if (!response.ok) {
      throw new SnapshotReadError(
        `${response.status} ${response.statusText}`.trim(),
        response.status
      )
    }
    const data = await response.json().catch(() => null)
    const value: Row[] = Array.isArray(data?.value) ? data.value : []
    rows.push(...value)
    if (!data?.['@iot.nextLink'] || value.length === 0) break
  }

  return rows
}

/** The expand for a snapshot Datastream — the same fields the live map reads. */
const DATASTREAM_EXPAND = ['Network', 'Sensor', 'ObservedProperty'].join(',')

/**
 * Each Datastream's latest reading at the instant, read on its own.
 *
 * It used to ride in `DATASTREAM_EXPAND`, which made the whole snapshot only as
 * fast as its slowest part. On a deployment with a large Observation history
 * this expand under `$as_of` is by far the slowest read there is: on
 * hydromet.supsi.ch (248 Datastreams) it ran into the gateway's timeout and
 * answered 504 after ~50 s, where the same expand on live data took 7 s and the
 * metadata 2 s. The 504 failed the snapshot, and the source fell back to live
 * Things — so a Thing whose Location had since been corrected was drawn where
 * it is now, under a snapshot label.
 *
 * A latest reading only decorates a marker, so it must not be able to cost the
 * marker its position. It is read alongside the rest, within
 * `READINGS_BUDGET_MS`; when that read fails or runs over, the Datastreams
 * carry no reading at all and the snapshot says so. Live readings are never
 * substituted: they would show today's value under a past date.
 */
const LATEST_READING_EXPAND = 'Observations($top=1;$orderby=phenomenonTime desc)'

/** How long the latest readings may take before the snapshot goes without. */
const READINGS_BUDGET_MS = 8_000

const HISTORICAL_LOCATION_SELECT = '$select=id,time&$expand=Locations'

/**
 * Picks the Locations a Thing stood at, from its HistoricalLocations that
 * existed at the instant.
 *
 * The latest `time` wins. Relocating to several Locations at once writes one
 * HistoricalLocation per Location in one transaction — same `time` — so every
 * row sharing the latest `time` contributes, not just the first.
 */
function locationsFromHistory(rows: Row[]): Row[] {
  let latest = -Infinity
  for (const row of rows) {
    const t = Date.parse(String(row?.time ?? ''))
    if (Number.isFinite(t) && t > latest) latest = t
  }
  const current = rows.filter(
    (row) => Date.parse(String(row?.time ?? '')) === latest
  )

  const seen = new Set<string>()
  const locations: Row[] = []
  for (const row of current) {
    const rowLocations = Array.isArray(row?.Locations) ? (row.Locations as Row[]) : []
    for (const location of rowLocations) {
      const id = idOf(location)
      if (!id || seen.has(id)) continue
      seen.add(id)
      locations.push(location)
    }
  }
  return locations
}

function placeThing(
  thing: Row,
  historyAtInstant: Row[] | undefined,
  hasAnyHistory: boolean
): Row {
  let Locations: Row[]
  let source: AsOfLocationSource

  if (historyAtInstant && historyAtInstant.length > 0) {
    Locations = locationsFromHistory(historyAtInstant)
    source = Locations.length > 0 ? 'history' : 'lost'
  } else if (hasAnyHistory) {
    Locations = []
    source = 'unplaced'
  } else {
    Locations = Array.isArray(thing?.Locations) ? (thing.Locations as Row[]) : []
    source = 'link'
  }

  return { ...thing, Locations, __asOfLocationSource: source }
}

export type ThingsAsOf = {
  /** The instant actually queried, after clamping. */
  asOf: string
  things: Row[]
  /**
   * False when the latest readings could not be read in time: the Datastreams
   * then carry no `Observations`, and everything else is still exact.
   */
  readingsAvailable: boolean
}

/**
 * Every Thing that existed at `asOfDate` — or just `thingId` — with its
 * Datastreams, latest readings and Locations as they were at that instant.
 * The readings are best effort — see `LATEST_READING_EXPAND`.
 *
 * Returns null when a single `thingId` did not exist at the instant (the API
 * answers 404). Throws `SnapshotReadError` when the Things or Datastreams
 * cannot be read; a snapshot missing those would be silently wrong.
 */
export async function readThingsAsOf(
  endpoint: string,
  asOfDate: string,
  headers: Record<string, string>,
  thingId?: string
): Promise<ThingsAsOf | null> {
  const asOf = clampAsOf(asOfDate)
  if (!asOf) throw new SnapshotReadError('Invalid asOfDate', 400)
  const asOfParam = `$as_of=${encodeURIComponent(asOf)}`
  const single = thingId ? `/Things(${encodeURIComponent(thingId)})` : ''

  let things: Row[]
  if (single) {
    const response = await fetch(
      `${endpoint}${single}?${asOfParam}&$expand=Locations`,
      { headers, cache: 'no-store' }
    )
    if (response.status === 404) return null
    if (!response.ok) {
      throw new SnapshotReadError(
        `${response.status} ${response.statusText}`.trim(),
        response.status
      )
    }
    const thing = await response.json().catch(() => null)
    if (!thing || typeof thing !== 'object') {
      throw new SnapshotReadError('Malformed response from data source', 502)
    }
    things = [thing as Row]
  } else {
    things = await readAll(
      `${endpoint}/Things?${asOfParam}&$expand=Locations`,
      headers
    )
  }

  // `$filter=Thing/id eq …` answers 404 under `$as_of`, but the navigation
  // path works — and with a single parent version at one instant it does not
  // repeat rows the way it does under `$from_to`.
  const datastreamsPath = single
    ? `${endpoint}${single}/Datastreams?${asOfParam}`
    : `${endpoint}/Datastreams?${asOfParam}`

  // All four reads at once: the readings may use their whole budget, and
  // nothing else should wait behind them.
  const [datastreams, readings, history, everPlaced] = await Promise.all([
    readAll(
      single
        ? `${datastreamsPath}&$expand=${DATASTREAM_EXPAND}`
        : `${datastreamsPath}&$expand=Thing($select=id),${DATASTREAM_EXPAND}`,
      headers
    ),
    readAll(
      `${datastreamsPath}&$select=id&$expand=${LATEST_READING_EXPAND}`,
      headers,
      AbortSignal.timeout(READINGS_BUDGET_MS)
    ).catch(() => null),
    // Location history is what places a Thing, but a backend that cannot serve
    // it should still produce a snapshot: every Thing then falls back to its
    // current link and is flagged approximate, rather than the map going blank.
    // Both reads fail towards 'link' — the flagged answer — never towards
    // 'unplaced', which would hide a Thing that was really there.
    readAll(
      single
        ? `${endpoint}${single}/HistoricalLocations?${asOfParam}&${HISTORICAL_LOCATION_SELECT}`
        : `${endpoint}/HistoricalLocations?${asOfParam}&${HISTORICAL_LOCATION_SELECT},Thing($select=id)`,
      headers
    ).catch(() => null),
    // Which Things have EVER been placed: separates "not placed yet at the
    // instant" from "no history recorded at all". Read live, since a
    // HistoricalLocation is only ever added, never back-dated. (A Thing
    // deleted since has none live; its rows at the instant still place it.)
    (single
      ? readAll(`${endpoint}${single}/HistoricalLocations?$select=id`, headers).then(
          (rows) => new Set(rows.length ? [thingId!] : [])
        )
      : readAll(
          `${endpoint}/HistoricalLocations?$select=id&$expand=Thing($select=id)`,
          headers
        ).then((rows) => new Set(rows.map((row) => idOf(row?.Thing))))
    ).catch(() => new Set<string>()),
  ])

  const readingsByDatastream = new Map<string, unknown>()
  for (const row of readings ?? []) {
    readingsByDatastream.set(idOf(row), row?.Observations ?? [])
  }

  const datastreamsByThing = new Map<string, Row[]>()
  for (const datastream of datastreams) {
    const owner = single ? thingId! : idOf(datastream?.Thing)
    if (!owner) continue
    // The owner was only expanded to group by; the live shape has no `Thing`.
    const rest = { ...datastream }
    delete rest.Thing
    // Without readings the key is left off rather than set to [], which would
    // claim the Datastream had no reading at the instant.
    if (readings) rest.Observations = readingsByDatastream.get(idOf(datastream)) ?? []
    const list = datastreamsByThing.get(owner) ?? []
    list.push(rest)
    datastreamsByThing.set(owner, list)
  }

  const historyByThing = new Map<string, Row[]>()
  for (const row of history ?? []) {
    const owner = single ? thingId! : idOf(row?.Thing)
    if (!owner) continue
    const list = historyByThing.get(owner) ?? []
    list.push(row)
    historyByThing.set(owner, list)
  }

  return {
    asOf,
    things: things.map((thing) => {
      const id = idOf(thing)
      const placed = history
        ? placeThing(thing, historyByThing.get(id), everPlaced.has(id))
        : placeThing(thing, undefined, false)
      return { ...placed, Datastreams: datastreamsByThing.get(id) ?? [] }
    }),
    readingsAvailable: readings !== null,
  }
}
