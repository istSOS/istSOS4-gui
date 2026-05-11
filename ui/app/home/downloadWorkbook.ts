import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as XLSX from 'xlsx'
import { Datastream, Observation, Thing } from '@/types/domain'

dayjs.extend(utc)

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
        }))
      const sheet = XLSX.utils.json_to_sheet(rows, {
        header: ['phenomenonTime', 'result'],
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
