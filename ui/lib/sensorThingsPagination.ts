import type { Datastream, LocationRef, Thing } from '@/types/domain'

type CollectionPage<T> = {
  value: T[]
  '@iot.nextLink'?: string
}

type ReadPage = (url: string) => Promise<CollectionPage<unknown>>

async function readCollection<T>(
  initialUrl: string,
  readPage: ReadPage,
  firstPage?: CollectionPage<T>
): Promise<T[]> {
  const initial = new URL(initialUrl)
  const values: T[] = []
  const visited = new Set<string>()
  let url = initial
  let page = firstPage

  while (true) {
    if (visited.has(url.href)) throw new Error('Repeated SensorThings page')
    visited.add(url.href)
    const data = page ?? (await readPage(url.href))
    if (!Array.isArray(data?.value)) {
      throw new Error('Invalid SensorThings collection response')
    }
    values.push(...(data.value as T[]))
    if (!data['@iot.nextLink']) return values

    const next = new URL(data['@iot.nextLink'], url)
    // The API can advertise a public hostname while we reach it inside Docker.
    url = new URL(`${next.pathname}${next.search}`, initial.origin)
    // Nested continuation links can omit the expansion needed by the GUI.
    initial.searchParams.forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value)
    })
    page = undefined
  }
}

/** Complete both the Things collection and its expanded child collections. */
export async function readThingsWithDatastreams(
  apiRoot: string,
  datastreamExpand: string,
  readPage: ReadPage
): Promise<Thing[]> {
  const endpoint = apiRoot.replace(/\/+$/, '')
  const url = `${endpoint}/Things?$expand=Datastreams($expand=${datastreamExpand}),Locations`
  const things = await readCollection<
    Thing & {
      'Datastreams@iot.nextLink'?: string
      'Locations@iot.nextLink'?: string
    }
  >(url, readPage)

  for (const thing of things) {
    const id = thing['@iot.id'] ?? thing.id
    if (thing['Datastreams@iot.nextLink']) {
      thing.Datastreams = await readCollection<Datastream>(
        `${endpoint}/Things(${id})/Datastreams?$expand=${datastreamExpand}`,
        readPage,
        {
          value: thing.Datastreams ?? [],
          '@iot.nextLink': thing['Datastreams@iot.nextLink'],
        }
      )
      delete thing['Datastreams@iot.nextLink']
    }
    if (thing['Locations@iot.nextLink']) {
      thing.Locations = await readCollection<LocationRef>(
        `${endpoint}/Things(${id})/Locations`,
        readPage,
        {
          value: thing.Locations ?? [],
          '@iot.nextLink': thing['Locations@iot.nextLink'],
        }
      )
      delete thing['Locations@iot.nextLink']
    }
  }
  return things
}
