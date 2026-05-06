'use client'

import { Button } from '@heroui/button'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Divider } from '@heroui/divider'
import {
  type ChangeEvent,
  type ComponentType,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  CloseIcon,
  DatastreamIcon,
  LocationIcon,
  NetworkIcon,
  ObservedPropertyIcon,
  SensorIcon,
  ThingIcon,
} from '@/components/icons'

import { useAuth } from '@/context/AuthContext'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const importApiPath = `${normalizedBasePath}/api/data-sources/import`

type ImportFromFileButtonProps = {
  className?: string
  buttonId?: string
}

type ImportReport = {
  rowsProcessed: number
  entities?: Record<string, { created?: number; existing?: number }>
}

type ImportStreamEvent = {
  type?: 'progress' | 'done' | 'error'
  ok?: boolean
  error?: string
  message?: string
  currentRow?: number
  totalRows?: number
  report?: ImportReport
}

type ImportLogEntry = {
  message: string
  row?: number
}

type ParsedWorkbookPayload = {
  procedures: Record<string, any>[]
  constraintKeys: string[]
}

type ParseWorkerRequest = {
  buffer: ArrayBuffer
  fileName: string
}

const parseWorkbookInWorker = async (file: File): Promise<ParsedWorkbookPayload> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/importWorkbook.worker.ts', import.meta.url)
    )

    worker.onmessage = (message) => {
      const payload = message.data as
        | ParsedWorkbookPayload
        | { error?: string | null }
      worker.terminate()
      if (payload && 'error' in payload && payload.error) {
        reject(new Error(payload.error))
        return
      }
      resolve(payload as ParsedWorkbookPayload)
    }

    worker.onerror = () => {
      worker.terminate()
      reject(new Error('Failed to parse workbook in worker'))
    }

    file
      .arrayBuffer()
      .then((buffer) => {
        const payload: ParseWorkerRequest = {
          buffer,
          fileName: file.name,
        }
        worker.postMessage(payload, [buffer])
      })
      .catch((error) => {
        worker.terminate()
        reject(error)
      })
  })

function FormIcon({
  icon: Icon,
  size = 16,
}: {
  icon: ComponentType<any>
  size?: number
}) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-default-500">
      <Icon size={size} />
    </span>
  )
}

const REPORT_ORDER = [
  { key: 'Networks', label: 'Networks', icon: NetworkIcon },
  { key: 'Things', label: 'Things', icon: ThingIcon },
  { key: 'Locations', label: 'Locations', icon: LocationIcon },
  { key: 'Sensors', label: 'Sensors', icon: SensorIcon },
  {
    key: 'ObservedProperties',
    label: 'Observed Properties',
    icon: ObservedPropertyIcon,
  },
  { key: 'Datastreams', label: 'Datastreams', icon: DatastreamIcon },
] as const

type ReportRow = {
  key: string
  label: string
  icon: ComponentType<any>
  created: number
  secondaryLabel?: string
  secondaryValue?: number
}

const LOG_ENTITY_ORDER = [
  'network',
  'thing',
  'location',
  'sensor',
  'observedproperty',
  'datastream',
] as const

export default function ImportFromFileButton({
  className,
  buttonId,
}: ImportFromFileButtonProps) {
  const router = useRouter()
  const { token } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const liveLogContainerRef = useRef<HTMLDivElement | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [importLog, setImportLog] = useState<ImportLogEntry[]>([])
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  })
  const reportRows: ReportRow[] = importReport
    ? REPORT_ORDER.map(({ key, label, icon }) => {
        const stats = importReport.entities?.[key]
        return {
          key,
          label,
          icon,
          created: stats?.created ?? 0,
          secondaryLabel:
            typeof stats?.existing === 'number' ? 'existing' : undefined,
          secondaryValue: stats?.existing,
        }
      })
    : []
  const visibleImportLog = importLog.filter((entry) => {
    const normalized = entry.message.trim().toLowerCase()
    return (
      normalized !== 'import started' &&
      !normalized.startsWith('processing row')
    )
  })
  const orderedImportLog = [...visibleImportLog].sort((first, second) => {
    const firstRow = first.row ?? Number.MAX_SAFE_INTEGER
    const secondRow = second.row ?? Number.MAX_SAFE_INTEGER
    if (firstRow !== secondRow) return firstRow - secondRow

    const firstEntity = first.message
      .split(':')[0]
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
    const secondEntity = second.message
      .split(':')[0]
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
    const firstIndex = LOG_ENTITY_ORDER.indexOf(
      firstEntity as (typeof LOG_ENTITY_ORDER)[number]
    )
    const secondIndex = LOG_ENTITY_ORDER.indexOf(
      secondEntity as (typeof LOG_ENTITY_ORDER)[number]
    )
    const normalizedFirstIndex =
      firstIndex === -1 ? LOG_ENTITY_ORDER.length : firstIndex
    const normalizedSecondIndex =
      secondIndex === -1 ? LOG_ENTITY_ORDER.length : secondIndex
    return normalizedFirstIndex - normalizedSecondIndex
  })

  useEffect(() => {
    const node = liveLogContainerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [orderedImportLog.length])

  const importProcedures = async ({
    procedures,
    constraintKeys,
  }: ParsedWorkbookPayload) => {
    const response = await fetch(importApiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        procedures,
        constraintKeys,
        token: token ?? null,
      }),
    })

    const reader = response.body?.getReader()
    if (!reader) {
      const fallbackText = await response.text().catch(() => '')
      throw new Error(
        fallbackText ||
          `Import failed: ${response.status} ${response.statusText}`
      )
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let finalReport: ImportReport | null = null
    let doneOk = false
    let streamError = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        let event: ImportStreamEvent | null = null
        try {
          event = JSON.parse(trimmed) as ImportStreamEvent
        } catch {
          continue
        }

        if (event.report) {
          finalReport = event.report
          setImportReport(event.report)
        }
        if (
          typeof event.currentRow === 'number' &&
          typeof event.totalRows === 'number'
        ) {
          setProgress({ current: event.currentRow, total: event.totalRows })
        }
        if (event.message) {
          setImportLog((prev) => [
            ...prev,
            {
              message: event.message as string,
              row:
                typeof event.currentRow === 'number'
                  ? event.currentRow
                  : undefined,
            },
          ])
        }
        if (event.type === 'done' && event.ok) {
          doneOk = true
        }
        if (event.type === 'error') {
          streamError = event.error || 'Import failed'
        }
      }
    }

    if (!doneOk) {
      throw new Error(streamError || `Import failed: ${response.status}`)
    }

    return finalReport
  }

  const handleImportInputChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsImporting(true)
    setImportReport({
      rowsProcessed: 0,
      entities: {
        Networks: { created: 0, existing: 0 },
        Things: { created: 0, existing: 0 },
        Locations: { created: 0, existing: 0 },
        Sensors: { created: 0, existing: 0 },
        ObservedProperties: { created: 0, existing: 0 },
        Datastreams: { created: 0, existing: 0 },
      },
    })
    setImportLog([{ message: 'Reading file...', row: 0 }])
    setProgress({ current: 0, total: 0 })
    try {
      const parsed = await parseWorkbookInWorker(file)
      setImportLog([{ message: 'File parsed. Starting import...', row: 0 }])
      const report = await importProcedures(parsed)
      setImportReport(report)
      router.refresh()
    } catch (error) {
      console.error('Import from file failed:', error)
      const message = error instanceof Error ? error.message : 'Import failed'
      if (typeof window !== 'undefined') {
        window.alert(message)
      }
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv"
        className="hidden"
        onChange={handleImportInputChange}
      />
      <Button
        id={buttonId}
        variant="light"
        className={`cursor-pointer rounded-2xl border border-default-200 px-4 text-sm font-medium transition hover:border-default-300 hover:bg-default-50 ${className ?? ''}`}
        isDisabled={isImporting}
        onPress={() => fileInputRef.current?.click()}
      >
        Import from file
      </Button>
      {importReport ? (
        <Card
          role="dialog"
          aria-modal="true"
          className="
      fixed left-1/2 top-1/2 z-[5000]
      w-[calc(100vw-2rem)] max-w-3xl
      -translate-x-1/2 -translate-y-1/2
      border border-default-200/80
      bg-background/95
      p-0 shadow-2xl backdrop-blur-md
      [box-shadow:0_24px_80px_rgba(15,23,42,0.22),0_0_0_100vmax_rgba(0,0,0,0.28)]
    "
        >
          <CardHeader className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Import</span>
              </div>
              <p className="mt-1 text-xs text-default-500">
                {importReport.rowsProcessed} rows processed
              </p>
            </div>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Close import report"
              className="shrink-0 text-default-500"
              onPress={() => setImportReport(null)}
            >
              <CloseIcon size={16} />
            </Button>
          </CardHeader>

          <Divider />

          <CardBody className="max-h-[70vh] gap-5 overflow-auto px-5 py-4">
            {progress.total > 0 ? (
              <div className="rounded-2xl border border-default-200 bg-default-50/60 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-default-600">
                  <span>Progress</span>
                  <span>
                    {progress.current}/{progress.total}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-default-200">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((progress.current / progress.total) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
              <div className="rounded-2xl border border-default-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-default-500">
                  <span>Created entities</span>
                </div>

                <div className="space-y-2 text-sm">
                  {reportRows.map((row, index) => (
                    <div
                      key={row.key}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                        index % 2 === 0
                          ? 'bg-white'
                          : 'bg-[color:rgba(0,131,116,0.12)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-default-700">
                        <FormIcon icon={row.icon} />
                        <span>{row.label}</span>
                      </span>

                      <div className="text-right text-xs text-default-500">
                        <div className="font-medium text-default-800">
                          {row.created} created
                        </div>

                        {typeof row.secondaryValue === 'number' ? (
                          <div>
                            {row.secondaryValue} {row.secondaryLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-default-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-default-500">
                    <span>Live log</span>
                  </div>

                  <span className="text-[11px] text-default-400">
                    {orderedImportLog.length} entries
                  </span>
                </div>

                <div
                  ref={liveLogContainerRef}
                  className="max-h-84 space-y-2 overflow-auto pr-1"
                >
                  {orderedImportLog.length ? (
                    orderedImportLog.map((entry, index) => (
                      <div
                        key={`${index}-${entry.row ?? 'na'}-${entry.message}`}
                        className={`rounded-lg px-3 py-2 text-[11px] leading-relaxed text-default-600 ${
                          (entry.row ?? 1) % 2 === 1
                            ? 'bg-white'
                            : 'bg-[color:rgba(0,131,116,0.12)]'
                        }`}
                      >
                        <span className="font-medium text-default-700">
                          Row {entry.row ?? '-'}:
                        </span>{' '}
                        {entry.message}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-default-200 px-3 py-6 text-center text-xs text-default-400">
                      No log entries yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  )
}
