import * as XLSX from 'xlsx'

const cleanValue = (value: any) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return value
}

const normalizeHeader = (value: any) => {
  const cleaned = cleanValue(value)
  if (cleaned === null) return null

  const key = String(cleaned).toLowerCase()
  const withoutParens = key.replace(/\(.*?\)/g, '')
  const normalized = withoutParens
    .replace(/[^0-9a-z]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || null
}

const buildColumnNames = (rows: any[][]) => {
  const headerRow2 = rows[1] ?? []
  const headerRow3 = rows[2] ?? []
  const width = Math.max(headerRow2.length, headerRow3.length)
  const names: string[] = []
  const seen = new Set<string>()

  for (let index = 0; index < width; index += 1) {
    let column =
      normalizeHeader(headerRow3[index]) ?? normalizeHeader(headerRow2[index])
    if (!column) column = `column_${index}`
    if (seen.has(column)) column = `${column}_${index}`
    names.push(column)
    seen.add(column)
  }

  return names
}

type ParseWorkbookResult = {
  procedures: Record<string, any>[]
  constraintKeys: string[]
}

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const bytes = event.data
    const workbook = XLSX.read(bytes, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      throw new Error('Workbook has no sheets')
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: null,
    }) as any[][]

    if (rows.length < 4) {
      throw new Error(
        'Excel template must contain header rows and at least one data row'
      )
    }

    const columnNames = buildColumnNames(rows)
    const constraintKeys = columnNames.filter((key) =>
      key.startsWith('constraint_')
    )

    const procedures: Record<string, any>[] = []
    for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const entry: Record<string, any> = {}
      let hasData = false

      for (let index = 0; index < columnNames.length; index += 1) {
        const value = row[index] ?? null
        entry[columnNames[index]] = value
        if (value !== null && value !== undefined && value !== '') {
          hasData = true
        }
      }

      if (!hasData) continue
      entry._source_row = rowIndex + 1
      procedures.push(entry)
    }

    const result: ParseWorkbookResult = { procedures, constraintKeys }
    self.postMessage(result)
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Failed to parse workbook',
    })
  }
}
