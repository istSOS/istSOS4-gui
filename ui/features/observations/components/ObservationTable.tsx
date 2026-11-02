'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import TableColumnMenu from '@/components/table/TableColumnMenu'
import TablePagination from '@/components/table/TablePagination'
import { tableStyles } from '@/components/table/tableStyles'

export const PAGE_SIZE = 25
const BROWSE_ROW_HEIGHT = 36
export type ObservationColumn = {
  uid: string
  name: string
  header?: ReactNode
  numeric?: boolean
}

/** Shared selection, column visibility and pagination for browsing and Edit/QC. */
export default function ObservationTable<
  Row extends { key: string; time: string },
>({
  rows,
  columns,
  selected,
  onSelect,
  page,
  onPage,
  renderCells,
  disabled = false,
  continuous = false,
  defaultColumns = 'all',
  focusKey,
  maxHeight = 'min(42dvh,380px)',
}: {
  rows: Row[]
  columns: ObservationColumn[]
  selected: string[]
  onSelect: (keys: string[]) => void
  page: number
  onPage: (page: number) => void
  renderCells: (row: Row, visible: (key: string) => boolean) => ReactNode
  continuous?: boolean
  disabled?: boolean
  defaultColumns?: 'all' | Set<string>
  maxHeight?: string
  focusKey?: string | null
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [visibleColumns, setVisibleColumns] = useState(defaultColumns)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(380)
  const scrollPageRef = useRef<number | null>(null)
  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  const firstKey = rows[0]?.key
  const lastKey = rows.at(-1)?.key
  const selectedKeys = useMemo(() => new Set(selected), [selected])
  const selectedCount = rows.filter((row) => selectedKeys.has(row.key)).length
  const allSelected = rows.length > 0 && selectedCount === rows.length
  const partlySelected = selectedCount > 0 && !allSelected
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1)
  )
  const focusPage = continuous ? null : currentPage
  const focusSelection = focusKey ? selected : null
  // Details renders only the viewport and one page of overscan on either side.
  // Fixed-height browsing rows keep page jumps and scrollbar positions exact.
  const startIndex = continuous
    ? Math.max(0, Math.floor(scrollTop / BROWSE_ROW_HEIGHT) - PAGE_SIZE)
    : currentPage * PAGE_SIZE
  const endIndex = continuous
    ? Math.min(
        rows.length,
        Math.ceil((scrollTop + viewportHeight) / BROWSE_ROW_HEIGHT) + PAGE_SIZE
      )
    : Math.min(rows.length, (currentPage + 1) * PAGE_SIZE)
  const shown = rows.slice(startIndex, endIndex)
  const scrollToIndex = (index: number) => {
    const scroller = scrollRef.current
    if (!scroller) return
    scroller.scrollTop = continuous ? index * BROWSE_ROW_HEIGHT : 0
    setScrollTop(scroller.scrollTop)
  }
  const selectedColumns =
    visibleColumns === 'all' ||
    !columns.some((column) => visibleColumns.has(column.uid))
      ? 'all'
      : visibleColumns
  const visible = (key: string) =>
    selectedColumns === 'all' || selectedColumns.has(key)
  const shownColumns = columns.filter((column) => visible(column.uid))
  const header = `${tableStyles.headerCell} ${tableStyles.header} text-left`

  useEffect(() => {
    if (continuous && scrollPageRef.current === currentPage) {
      scrollPageRef.current = null
      return
    }
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollTop = continuous
        ? currentPage * PAGE_SIZE * BROWSE_ROW_HEIGHT
        : 0
      setScrollTop(scroller.scrollTop)
    }
  }, [currentPage, continuous, firstKey, lastKey, rows.length])
  useEffect(() => {
    const scroller = scrollRef.current
    if (!continuous || !scroller) return
    const resize = new ResizeObserver(() =>
      setViewportHeight(scroller.clientHeight)
    )
    resize.observe(scroller)
    setViewportHeight(scroller.clientHeight)
    return () => resize.disconnect()
  }, [continuous])
  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = partlySelected
  }, [partlySelected])
  useEffect(() => {
    if (!focusKey || !focusSelection?.length) return
    if (continuous) {
      const index = rowsRef.current.findIndex((row) => row.key === focusKey)
      const scroller = scrollRef.current
      if (index >= 0 && scroller) {
        scroller.scrollTop = index * BROWSE_ROW_HEIGHT
        setScrollTop(scroller.scrollTop)
      }
      return
    }
    const target = Array.from(
      scrollRef.current?.querySelectorAll<HTMLElement>('[data-row-key]') ?? []
    ).find((row) => row.dataset.rowKey === focusKey)
    if (target && scrollRef.current) {
      // Scroll only this table; do not move the modal or the page behind it.
      scrollRef.current.scrollTop +=
        target.getBoundingClientRect().top -
        scrollRef.current.getBoundingClientRect().top -
        36
    }
  }, [focusKey, focusSelection, continuous, focusPage, firstKey, lastKey])

  return (
    <div className="min-h-0 min-w-0 space-y-1 bg-content1">
      <div
        ref={scrollRef}
        onScroll={
          continuous
            ? (event) => {
                const scroller = event.currentTarget
                // Commit an active editor before virtualization removes its row.
                const focused = document.activeElement
                const focusedRow =
                  focused?.closest<HTMLElement>('[data-row-index]')
                if (
                  focused instanceof HTMLElement &&
                  focusedRow &&
                  scroller.contains(focused)
                ) {
                  const rowIndex = Number(focusedRow.dataset.rowIndex)
                  const start = Math.max(
                    0,
                    Math.floor(scroller.scrollTop / BROWSE_ROW_HEIGHT) -
                      PAGE_SIZE
                  )
                  const end =
                    Math.ceil(
                      (scroller.scrollTop + viewportHeight) / BROWSE_ROW_HEIGHT
                    ) + PAGE_SIZE
                  if (rowIndex < start || rowIndex >= end) focused.blur()
                }
                setScrollTop(scroller.scrollTop)
                const atBottom =
                  scroller.scrollTop > 0 &&
                  scroller.scrollTop + scroller.clientHeight >=
                    scroller.scrollHeight - 1
                const index = atBottom
                  ? rows.length - 1
                  : Math.floor(scroller.scrollTop / BROWSE_ROW_HEIGHT)
                const nextPage = Math.max(
                  0,
                  Math.min(
                    Math.floor(index / PAGE_SIZE),
                    Math.ceil(rows.length / PAGE_SIZE) - 1
                  )
                )
                if (nextPage !== currentPage) {
                  scrollPageRef.current = nextPage
                  onPage(nextPage)
                }
              }
            : undefined
        }
        style={{ maxHeight, overflowAnchor: continuous ? 'none' : undefined }}
        className="overflow-auto focus-visible:outline-2 focus-visible:outline-primary"
        tabIndex={0}
        role="region"
        aria-label={t('qc.table_label')}
      >
        <table
          className="w-full border-collapse"
          aria-label={t('qc.table_label')}
          aria-rowcount={continuous ? rows.length + 1 : undefined}
        >
          <thead className="sticky top-0 z-10">
            <tr>
              <th scope="col" className={`${header} w-8`}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label={t('qc.select_filtered')}
                  aria-checked={partlySelected ? 'mixed' : allSelected}
                  checked={allSelected}
                  disabled={disabled || !rows.length}
                  onChange={(event) => {
                    const keys = new Set(rows.map((row) => row.key))
                    onSelect(
                      event.target.checked
                        ? [...new Set([...selected, ...keys])]
                        : selected.filter((key) => !keys.has(key))
                    )
                  }}
                />
              </th>
              {shownColumns.map((column) => (
                <th
                  key={column.uid}
                  scope="col"
                  className={`${header} ${column.numeric ? '!text-right' : ''}`}
                >
                  {column.header ?? column.name}
                </th>
              ))}
              <th
                scope="col"
                className={`${header} ${tableStyles.columnOptions}`}
              >
                <TableColumnMenu
                  columns={columns}
                  selectedKeys={selectedColumns}
                  label={t('general.columns')}
                  onSelectionChange={(keys) => {
                    if (keys === 'all') setVisibleColumns('all')
                    else if (keys instanceof Set && keys.size)
                      setVisibleColumns(new Set(Array.from(keys, String)))
                  }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {continuous && startIndex > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={shownColumns.length + 2}
                  style={{
                    height: startIndex * BROWSE_ROW_HEIGHT,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
            {shown.map((row, rowIndex) => (
              <tr
                key={row.key}
                data-row-key={row.key}
                data-row-index={continuous ? startIndex + rowIndex : undefined}
                aria-rowindex={
                  continuous ? startIndex + rowIndex + 2 : undefined
                }
                style={continuous ? { height: BROWSE_ROW_HEIGHT } : undefined}
                aria-selected={selectedKeys.has(row.key)}
                className={`${tableStyles.row} ${continuous ? ((startIndex + rowIndex) % 2 ? 'bg-default-100' : 'bg-content1') : `bg-content1 ${tableStyles.stripedRow}`} ${selectedKeys.has(row.key) ? tableStyles.selectedRow : ''}`}
              >
                <td className={tableStyles.cell}>
                  <input
                    type="checkbox"
                    aria-label={`${t('qc.select_row')} ${row.time}`}
                    checked={selectedKeys.has(row.key)}
                    disabled={disabled}
                    onChange={() =>
                      onSelect(
                        selectedKeys.has(row.key)
                          ? selected.filter((key) => key !== row.key)
                          : [...selected, row.key]
                      )
                    }
                  />
                </td>
                {renderCells(row, visible)}
                <td
                  className={`${tableStyles.cell} sticky right-0 bg-inherit`}
                />
              </tr>
            ))}
            {continuous && endIndex < rows.length && (
              <tr aria-hidden="true">
                <td
                  colSpan={shownColumns.length + 2}
                  style={{
                    height: (rows.length - endIndex) * BROWSE_ROW_HEIGHT,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
            {!shown.length && (
              <tr>
                <td
                  colSpan={shownColumns.length + 2}
                  className={tableStyles.empty}
                >
                  {t('qc.no_rows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={currentPage + 1}
        pages={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
        onPage={(next) => {
          scrollPageRef.current = null
          scrollToIndex((next - 1) * PAGE_SIZE)
          onPage(next - 1)
        }}
        total={`${t('general.total')}: ${rows.length.toLocaleString()}`}
      />
    </div>
  )
}
