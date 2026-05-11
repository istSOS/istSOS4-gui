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
import { siteConfig } from '@/config/site'

type ImportPayload = {
  procedures?: Array<Record<string, unknown>>
  constraintKeys?: string[]
  token?: string | null
}

type EntityStats = { created: number; existing: number }
type ImportReport = {
  rowsProcessed: number
  entities: Record<string, EntityStats>
}

const UOM_MAPPING: Record<string, string> = {
  V: 'Voltage',
  '°C': 'Celsius degree',
  mm: 'Millimeter',
  '%': 'Percentage',
  g: 'Gram',
  m: 'Meter',
}

const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/, '')

const cleanValue = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return value
}

const toNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

const splitValues = (value: unknown) => {
  const cleaned = cleanValue(value)
  if (cleaned === null) return [] as string[]
  return String(cleaned)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

const getListValue = <T>(values: T[], index: number, fallback?: T) => {
  if (!values.length) return fallback
  if (index < values.length) return values[index]
  return values[values.length - 1]
}

const parseJsonValue = (
  value: unknown,
  fallback: Record<string, unknown> = {}
) => {
  const cleaned = cleanValue(value)
  if (cleaned === null) return fallback
  if (typeof cleaned === 'object') return cleaned
  try {
    return JSON.parse(String(cleaned))
  } catch {
    return fallback
  }
}

const parseDefinition = (value: unknown) => {
  const cleaned = cleanValue(value)
  if (cleaned === null) return ''
  try {
    return JSON.parse(String(cleaned))
  } catch {
    return cleaned
  }
}

const parseCoordinates = (value: unknown) => {
  const cleaned = cleanValue(value)
  if (cleaned === null) return null

  if (Array.isArray(cleaned)) {
    return [toNumber(cleaned[0]), toNumber(cleaned[1])]
  }

  const text = String(cleaned)
  if (text.toUpperCase().startsWith('POINT')) {
    const matches = text.match(/[-+]?\d*\.?\d+/g) ?? []
    if (matches.length >= 2) {
      return [toNumber(matches[0]), toNumber(matches[1])]
    }
  }

  const parts = text.split(',').map((part) => part.trim())
  return [toNumber(parts[0]), toNumber(parts[1])]
}

const parseCreatedEntityId = (
  value: Record<string, unknown> | null,
  locationHeader?: string | null
) => {
  const raw = value?.['@iot.id'] ?? value?.id
  if (raw !== undefined && raw !== null) return String(raw).trim()

  if (locationHeader) {
    const match = locationHeader.match(/\(([^)]+)\)\s*$/)
    return match?.[1]?.trim() ?? ''
  }

  return ''
}

const toEntityReferenceId = (id: string) => {
  const trimmed = id.trim()
  if (!trimmed) return trimmed
  const numericId = Number(trimmed)
  return Number.isFinite(numericId) ? numericId : trimmed
}

const withAuthHeaders = (
  token?: string | null,
  extra: Record<string, string> = {}
) => (token ? { ...extra, Authorization: `Bearer ${token}` } : extra)

const requireField = (procedure: Record<string, unknown>, key: string) => {
  const value = cleanValue(procedure[key])
  if (value === null) {
    throw new Error(
      `Missing required field '${key}' in Excel row ${procedure._source_row ?? '?'}`
    )
  }
  return String(value)
}

export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => '')
  const payload = (() => {
    if (!rawBody.trim()) return null
    try {
      return JSON.parse(rawBody) as ImportPayload
    } catch {
      return null
    }
  })()

  if (
    !payload ||
    !Array.isArray(payload.procedures) ||
    !Array.isArray(payload.constraintKeys)
  ) {
    return Response.json(
      {
        ok: false,
        error: 'Invalid import payload',
        debug: {
          contentType: request.headers.get('content-type') ?? null,
          bodyLength: rawBody.length,
        },
      },
      { status: 400 }
    )
  }

  const apiRoot = normalizeEndpoint(siteConfig.api_root)
  const token =
    typeof payload.token === 'string' && payload.token.trim()
      ? payload.token.trim()
      : null
  const entityIdCache = new Map<string, string>()
  const report: ImportReport = {
    rowsProcessed: payload.procedures.length,
    entities: {
      Locations: { created: 0, existing: 0 },
      Things: { created: 0, existing: 0 },
      Sensors: { created: 0, existing: 0 },
      ObservedProperties: { created: 0, existing: 0 },
      Networks: { created: 0, existing: 0 },
      Datastreams: { created: 0, existing: 0 },
    },
  }
  const cacheKeyFor = (collection: string, name: string) =>
    `${collection}::${name.trim().toLowerCase()}`
  const encoder = new TextEncoder()
  const reportSnapshot = () => ({
    rowsProcessed: report.rowsProcessed,
    entities: Object.fromEntries(
      Object.entries(report.entities).map(([k, v]) => [k, { ...v }])
    ),
  })

  const stream = new ReadableStream({
    start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      const readEntityByName = async (collection: string, name: string) => {
        const normalizedName = String(name).trim()
        if (!normalizedName) return null

        const cacheKey = cacheKeyFor(collection, normalizedName)
        const cached = entityIdCache.get(cacheKey)
        if (cached) return cached

        const filter = `name eq '${normalizedName.replace(/'/g, "''")}'`
        const url = `${apiRoot}/${collection}?$filter=${encodeURIComponent(filter)}&$top=1`
        const response = await fetch(url, {
          method: 'GET',
          headers: withAuthHeaders(token),
          cache: 'no-store',
        })

        if (!response.ok) return null
        const json = await response.json().catch(() => null)
        const first = Array.isArray(json?.value) ? json.value[0] : null
        if (!first) return null

        const id = parseCreatedEntityId(first)
        if (id) entityIdCache.set(cacheKey, id)
        return id || null
      }

      const createEntity = async (
        collection: string,
        payload: Record<string, unknown>,
        commitMessage?: string
      ) => {
        const resolvedCommitMessage =
          commitMessage?.trim() || `Import from file: create ${collection}`
        const response = await fetch(`${apiRoot}/${collection}`, {
          method: 'POST',
          headers: withAuthHeaders(token, {
            'Content-Type': 'application/json',
            'commit-message': resolvedCommitMessage,
          }),
          body: JSON.stringify(payload),
          cache: 'no-store',
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          throw new Error(
            errorText ||
              `Create ${collection} failed: ${response.status} ${response.statusText}`
          )
        }

        const text = await response.text().catch(() => '')
        const parsed = text ? JSON.parse(text) : null
        return parseCreatedEntityId(parsed, response.headers.get('location'))
      }

      const resolveId = async (
        collection: string,
        name: string,
        createPayload: Record<string, unknown>,
        commitMessage?: string
      ) => {
        const normalizedName = String(name).trim()
        const existing = await readEntityByName(collection, normalizedName)
        if (existing) return { id: existing, created: false as const }

        const createdId = await createEntity(
          collection,
          createPayload,
          commitMessage
        )
        if (createdId) {
          entityIdCache.set(cacheKeyFor(collection, normalizedName), createdId)
          return { id: createdId, created: true as const }
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const recovered = await readEntityByName(collection, normalizedName)
          if (recovered) return { id: recovered, created: true as const }
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
        }

        throw new Error(`${collection} "${normalizedName}" created without id`)
      }

      ;(async () => {
        try {
          emit({
            type: 'progress',
            message: 'Import started',
            currentRow: 0,
            totalRows: payload.procedures.length,
            report: reportSnapshot(),
          })

          for (let rowIndex = 0; rowIndex < payload.procedures.length; rowIndex += 1) {
            const rawProcedure = payload.procedures[rowIndex]
            emit({
              type: 'progress',
              message: `Processing row ${rowIndex + 1} of ${payload.procedures.length}`,
              currentRow: rowIndex + 1,
              totalRows: payload.procedures.length,
              report: reportSnapshot(),
            })
      const procedure = Object.fromEntries(
        Object.entries(rawProcedure ?? {}).map(([key, value]) => [
          key,
          cleanValue(value),
        ])
      )

      const constraints = payload.constraintKeys
        .map((key) => cleanValue(procedure[key]))
        .filter((value) => value !== null)
        .map((value) => {
          try {
            return JSON.parse(String(value))
          } catch {
            return value
          }
        })

      const locationCoordinates = parseCoordinates(
        requireField(procedure, 'location_coordinates')
      )
      const epsgRaw = cleanValue(procedure.location_epsg) ?? '4326'
      const epsgNumber = Number(epsgRaw)
      const epsg = Number.isFinite(epsgNumber) ? epsgNumber : epsgRaw

      const locationName = requireField(procedure, 'location_name')
      const locationResolved = await resolveId(
        'Locations',
        locationName,
        {
          name: locationName,
          description: String(procedure.location_description ?? ''),
          encodingType: 'application/json',
          location: {
            type: 'Point',
            coordinates: locationCoordinates,
            crs: {
              type: 'name',
              properties: { name: `EPSG:${epsg}` },
            },
          },
        },
        `Import location ${locationName}`
      )
      report.entities.Locations[
        locationResolved.created ? 'created' : 'existing'
      ] += 1
      const locationId = locationResolved.id
      emit({
        type: 'progress',
        message: `Location ${locationResolved.created ? 'created' : 'found'}: ${locationName}`,
        currentRow: rowIndex + 1,
        totalRows: payload.procedures.length,
        report: reportSnapshot(),
      })

      const thingName = requireField(procedure, 'thing_name')
      const thingResolved = await resolveId(
        'Things',
        thingName,
        {
          name: thingName,
          description: String(procedure.thing_description ?? ''),
          properties: parseJsonValue(procedure.thing_properties, {}),
          Locations: [{ '@iot.id': toEntityReferenceId(locationId) }],
        },
        `Import thing ${thingName}`
      )
      report.entities.Things[thingResolved.created ? 'created' : 'existing'] += 1
      const thingId = thingResolved.id
      emit({
        type: 'progress',
        message: `Thing ${thingResolved.created ? 'created' : 'found'}: ${thingName}`,
        currentRow: rowIndex + 1,
        totalRows: payload.procedures.length,
        report: reportSnapshot(),
      })

      const sensorName = requireField(procedure, 'sensor_name')
      const modelNumber = cleanValue(procedure.model_number)
      const sensorMetadata =
        cleanValue(procedure.sensor_metadata) ??
        (modelNumber ? `http://example.org/${modelNumber}.pdf` : '')
      const sensorProperties = Object.fromEntries(
        Object.entries({
          modelNumber,
          brand: cleanValue(procedure.brand),
          type: cleanValue(procedure.type),
        }).filter(([, value]) => value !== null)
      )

      const sensorResolved = await resolveId(
        'Sensors',
        sensorName,
        {
          name: sensorName,
          description: String(procedure.sensor_description ?? ''),
          metadata: String(sensorMetadata ?? ''),
          encodingType: String(
            procedure.sensor_encoding_type ?? 'application/pdf'
          ),
          properties: sensorProperties,
        },
        `Import sensor ${sensorName}`
      )
      report.entities.Sensors[
        sensorResolved.created ? 'created' : 'existing'
      ] += 1
      const sensorId = sensorResolved.id
      emit({
        type: 'progress',
        message: `Sensor ${sensorResolved.created ? 'created' : 'found'}: ${sensorName}`,
        currentRow: rowIndex + 1,
        totalRows: payload.procedures.length,
        report: reportSnapshot(),
      })

      const observedPropertyNames = splitValues(
        requireField(procedure, 'observed_property_name')
      )
      const observedPropertyDescriptions = splitValues(
        procedure.observed_property_description
      )
      const observedPropertyDefinitions = splitValues(
        procedure.observed_property_definition
      )
      const datastreamNames = splitValues(procedure.datastream_name)
      const datastreamDescriptions = splitValues(
        procedure.datastream_description
      )
      const uoms = splitValues(procedure.datastream_uom)

      const observedPropertyIds: string[] = []
      for (let index = 0; index < observedPropertyNames.length; index += 1) {
        const opName = observedPropertyNames[index]
        const opResolved = await resolveId(
          'ObservedProperties',
          opName,
          {
            name: opName,
            description: String(
              getListValue(observedPropertyDescriptions, index, opName) ??
                opName
            ),
            definition: parseDefinition(
              getListValue(observedPropertyDefinitions, index, '')
            ),
          },
          `Import observed property ${opName}`
        )
        report.entities.ObservedProperties[
          opResolved.created ? 'created' : 'existing'
        ] += 1
        observedPropertyIds.push(opResolved.id)
        emit({
          type: 'progress',
          message: `ObservedProperty ${opResolved.created ? 'created' : 'found'}: ${opName}`,
          currentRow: rowIndex + 1,
          totalRows: payload.procedures.length,
          report: reportSnapshot(),
        })
      }

      const networkNames = splitValues(requireField(procedure, 'network_name'))
      for (const networkName of networkNames) {
        const networkResolved = await resolveId(
          'Networks',
          networkName,
          {
            name: networkName,
          },
          `Import network ${networkName}`
        )
        report.entities.Networks[
          networkResolved.created ? 'created' : 'existing'
        ] += 1
        const networkId = networkResolved.id
        emit({
          type: 'progress',
          message: `Network ${networkResolved.created ? 'created' : 'found'}: ${networkName}`,
          currentRow: rowIndex + 1,
          totalRows: payload.procedures.length,
          report: reportSnapshot(),
        })

        for (let index = 0; index < observedPropertyIds.length; index += 1) {
          const observedPropertyId = observedPropertyIds[index]
          const uom = getListValue(uoms, index, '') ?? ''
          const datastreamName =
            getListValue(datastreamNames, index) ??
            getListValue(observedPropertyNames, index) ??
            sensorName

          const datastreamExistingId = await readEntityByName(
            'Datastreams',
            String(datastreamName)
          )
          if (datastreamExistingId) {
            report.entities.Datastreams.existing += 1
            emit({
              type: 'progress',
              message: `Datastream found: ${datastreamName}`,
              currentRow: rowIndex + 1,
              totalRows: payload.procedures.length,
              report: reportSnapshot(),
            })
            continue
          }

          const properties: Record<string, unknown> = Object.fromEntries(
            Object.entries({
              samplingFrequency: cleanValue(procedure.sampling_frequency),
              acquisitionFrequency: cleanValue(procedure.acquisition_frequency),
            }).filter(([, value]) => value !== null)
          )
          if (constraints.length) {
            properties.constraints = constraints
          }

          await createEntity(
            'Datastreams',
            {
              name: String(datastreamName),
              description: String(
                getListValue(datastreamDescriptions, index, '') ?? ''
              ),
              observationType:
                'http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement',
              phenomenonTime: requireField(procedure, 'datastream_begin'),
              unitOfMeasurement: {
                name: UOM_MAPPING[uom] ?? uom,
                symbol: uom,
                definition: '',
              },
              properties,
              Network: { '@iot.id': toEntityReferenceId(networkId) },
              Thing: { '@iot.id': toEntityReferenceId(thingId) },
              Sensor: { '@iot.id': toEntityReferenceId(sensorId) },
              ObservedProperty: {
                '@iot.id': toEntityReferenceId(observedPropertyId),
              },
            },
            `Import datastream ${datastreamName}`
          )
          report.entities.Datastreams.created += 1
          emit({
            type: 'progress',
            message: `Datastream created: ${datastreamName}`,
            currentRow: rowIndex + 1,
            totalRows: payload.procedures.length,
            report: reportSnapshot(),
          })
        }
      }
          }

          emit({
            type: 'done',
            ok: true,
            imported: payload.procedures.length,
            report: reportSnapshot(),
          })
          controller.close()
        } catch (error) {
          emit({
            type: 'error',
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            report: reportSnapshot(),
          })
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
    status: 200,
  })
}
