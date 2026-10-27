export type Constraint = {
  type: string
  column?: string
  min?: number
  max?: number
  window?: string
  thresh?: number
  min_periods?: number
  min_residuals?: number
  method?: string
  center?: boolean
  [key: string]: unknown
}

export type QcDatastream = {
  id: string
  name: string
  thing: string
  unit: string
  phenomenonTime?: string
  samplingFrequency?: string
  constraints: Constraint[]
  qualityEncoding?: string
}

export type QcSource = {
  id: string
  name: string
  endpoint: string
  authorizationEnabled: boolean
}

export type QcRow = {
  key: string
  id: string
  time: string
  ts: number
  result: unknown
  resultQuality: unknown
  draftBaseQuality?: number
  scope: 'history' | 'window' | 'following'
}

export type CheckOutcome = { slot: number; state: number; reason: string }
export type Draft = {
  result: unknown
  resultQuality: unknown
  staleSlots: number[]
  outcomes?: CheckOutcome[]
  recipe?: Constraint[]
  filled?: boolean
  converted?: boolean
  qualityPending?: boolean
}
export type QualitySchema = {
  mode: 'existing' | 'converted' | 'service'
  constraints: Constraint[]
}
export type Drafts = Record<string, Draft>
export type Workspace = {
  datastream?: Pick<QcDatastream, 'id' | 'name' | 'thing'>
  sourceEndpoint?: string
  commitMessage?: string
  rows: Record<string, QcRow>
  drafts: Drafts
  undo: Drafts[]
  redo: Drafts[]
  audit?: AuditEntry[]
  qualitySchema?: QualitySchema
}
export type AuditState = Draft
export type AuditEntry = {
  id: string
  time: string
  actor: string
  source: string
  datastream: string
  action: string
  parameters: Record<string, unknown>
  changes: Array<{
    key: string
    observationId: string
    time: string
    before: AuditState
    after: AuditState
  }>
}

export type EditOperation =
  | 'constant'
  | 'offset'
  | 'missing'
  | 'fill-constant'
  | 'fill-linear'
  | 'interpolate'
export type EditRequest = {
  operation: EditOperation
  start: number
  end: number
  value?: number
  maxGapMs?: number
  includeFailedAnchors: boolean
  note: string
  /** When provided, edit exactly these observations within the interval. */
  keys?: string[]
}
export type EditPlan = {
  changes: Record<string, number | null>
  filledKeys: string[]
  targets: number
  skipped: number
  skippedRows: Array<{
    key: string
    reason: 'missing' | 'gap' | 'anchors' | 'anchor_span'
    spanMs?: number
  }>
  anchors: Array<{ key: string; time: string; value: number }>
}
export type LoadedData = {
  datastream: QcDatastream
  rows: QcRow[]
  bufferSize: number
}
export type PreviewData = LoadedData & {
  results: Array<{
    key: string
    resultQuality: number
    outcomes: CheckOutcome[]
    staleSlots: number[]
  }>
  warnings: string[]
  engineVersion: string
}
