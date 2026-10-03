import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as XLSX from 'xlsx'
import { resolveQualityScheme } from '@/features/observations/lib/qualitySchemeStore'
import {
  ISTSOS_QUALITY_SCHEME,
  qualityClassOf,
  sameQualityScheme,
} from '@/features/observations/lib/resultQuality'
import { Datastream, Observation, Thing } from '@/types/domain'

dayjs.extend(utc)

/**
 * `resultQuality` as it goes into a spreadsheet cell.
 *
 * The column is untyped `jsonb`, so the value may be a number, a string or an
 * object. Primitives are written through unchanged; anything structured is
 * serialised, because a cell reading `[object Object]` loses the record.
 */
function formatQualityForExport(raw: unknown): string | number {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'number' || typeof raw === 'string') return raw
  if (typeof raw === 'boolean') return String(raw)
  try {
    return JSON.stringify(raw)
  } catch {
    return ''
  }
}

export type CsvDownloadPayload = {
  filename: string
  bytes: ArrayBuffer
}

export async function buildDatastreamWorkbookPayload({
  selectedThing,
  obsStart,
  obsEnd,
  fetchObservations,
}: {
  selectedThing: Thing | null
  obsStart: string | null
  obsEnd: string | null
  fetchObservations: (
    datastreamId: string,
    phenomenonTime?: string,
    range?: { start?: string | null; end?: string | null },
    sourceEndpoint?: string
  ) => Promise<{
    data: Observation[]
    startIso: string | null
    endIso: string | null
  }>
}): Promise<CsvDownloadPayload | null> {
  if (!selectedThing) return null

  const thingDatastreams = Array.isArray(selectedThing?.Datastreams)
    ? selectedThing.Datastreams
    : []
  if (thingDatastreams.length === 0) return null

  const sanitizeSheetName = (value: string, fallback: string) => {
    const base = value.trim() || fallback
    const sanitized = base.replace(/[\\/*?:[\]]/g, '_').slice(0, 31)
    return sanitized || fallback
  }

  const workbook = XLSX.utils.book_new()

  await Promise.all(
    thingDatastreams.map(async (ds: Datastream, index: number) => {
      const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '').trim()
      if (!dsId) return

      const sourceEndpoint = String(ds?.__sourceEndpoint ?? selectedThing?.__sourceEndpoint ?? '')
      const streamName = String(ds?.name ?? dsId)

      const result = await fetchObservations(
        dsId,
        ds?.phenomenonTime,
        { start: obsStart, end: obsEnd },
        sourceEndpoint
      )

      // The viewer's own reading of the column, alongside the column itself —
      // but only when it is their own: under the default, a verdict column
      // would restate the istSOS convention for every row.
      const { scheme } = resolveQualityScheme(ds)
      const withVerdict = !sameQualityScheme(scheme, ISTSOS_QUALITY_SCHEME)

      const rows = (Array.isArray(result.data) ? result.data : [])
        .slice()
        .sort((a: Observation, b: Observation) => {
          const aTs = dayjs.utc(a?.phenomenonTime).valueOf()
          const bTs = dayjs.utc(b?.phenomenonTime).valueOf()
          if (!Number.isFinite(aTs) && !Number.isFinite(bTs)) return 0
          if (!Number.isFinite(aTs)) return 1
          if (!Number.isFinite(bTs)) return -1
          return aTs - bTs
        })
        .map((obs: Observation) => ({
          phenomenonTime: String(obs?.phenomenonTime ?? ''),
          result: obs?.result ?? '',
          // The stored value, not this app's reading of it: an export is the
          // record, so a downstream consumer gets what is actually in the
          // column rather than a verdict derived from it under an assumed
          // scale. Objects (the DQ_Element shape) are serialised rather than
          // flattened to a number, which would silently discard everything the
          // number is not.
          resultQuality: formatQualityForExport(obs?.resultQuality),
          ...(withVerdict
            ? { qualityVerdict: qualityClassOf(obs?.resultQuality, scheme) }
            : {}),
        }))
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: [
          'phenomenonTime',
          'result',
          'resultQuality',
          ...(withVerdict ? ['qualityVerdict'] : []),
        ],
      })
      const sheetName = sanitizeSheetName(streamName, `Datastream_${index + 1}`)
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    })
  )

  if (workbook.SheetNames.length === 0) return null

  const thingName = String(selectedThing?.name ?? 'thing')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
  const filename = `${thingName || 'thing'}.xlsx`
  const bytes = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer

  return { filename, bytes }
}
