'use client'

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
import { Input } from '@heroui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/table'
import type { SortDescriptor } from '@react-types/shared'
import React, { type Key, type ReactNode } from 'react'

import { SearchIcon } from '@/components/icons'

import TableColumnMenu from './TableColumnMenu'
import TablePagination from './TablePagination'
import { orderTableItems } from './tableOrdering'
import { tableStyles } from './tableStyles'

const BROWSE_ROW_HEIGHT = 36
const BROWSE_TABLE_HEIGHT = 380
const BROWSE_PAGE_SIZE = 25
const CELL_PADDING = 24

const noopSubscribe = () => () => {}

const textOf = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children)
  return ''
}

type TableColumn<TColumnKey extends string = string> = {
  name: ReactNode
  uid: TColumnKey
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  /** Fixed width in px; otherwise it is measured from the column's text. */
  width?: number
}

type TableProps<TItem, TColumnKey extends string = string> = {
  items: TItem[]
  columns: TableColumn<TColumnKey>[]
  rowKey: (item: TItem, index: number) => Key
  renderCell: (item: TItem, columnKey: TColumnKey) => ReactNode
  onRowAction?: (item: TItem) => void

  highlightedKeys?: ReadonlySet<Key>
  pinnedKeys?: ReadonlySet<Key>
  focusRowKey?: Key | null
  focusRequest?: unknown
  scrollable?: boolean
  continuousScroll?: boolean
  autoFitRows?: boolean
  columnSelectorPlacement?: 'toolbar' | 'header'
  initialSort?: SortDescriptor
  getSortValue?: (item: TItem, columnKey: TColumnKey) => string | number | null

  enableSearch?: boolean
  searchPlaceholder?: string
  searchPredicate?: (item: TItem, query: string) => boolean

  enablePagination?: boolean

  enableColumnSelector?: boolean
  initialVisibleColumns?: 'all' | Set<string>
  columnSelectorLabel?: ReactNode
  disallowEmptyVisibleColumns?: boolean

  topLeft?: ReactNode
  topRight?: ReactNode
  emptyContent?: ReactNode

  showTotal?: boolean
  totalLabel?: (total: number) => ReactNode
}

export default function TableComponent<
  TItem,
  TColumnKey extends string = string,
>({
  items,
  columns,
  rowKey,
  renderCell,
  onRowAction,
  highlightedKeys,
  pinnedKeys,
  focusRowKey,
  focusRequest,
  scrollable = false,
  continuousScroll = false,
  autoFitRows = false,
  columnSelectorPlacement = 'toolbar',

  initialSort = {
    column: String(columns[0]?.uid ?? 'id'),
    direction: 'ascending',
  },
  getSortValue,

  enableSearch = true,
  searchPlaceholder = 'Search...',
  searchPredicate,

  enablePagination = true,

  enableColumnSelector = false,
  initialVisibleColumns,
  columnSelectorLabel = 'Columns',
  disallowEmptyVisibleColumns = true,

  topLeft,
  topRight,
  emptyContent = 'No data found',

  showTotal = true,
  totalLabel = (total) => (
    <span className="text-default-400 text-small">Total {total}</span>
  ),
}: TableProps<TItem, TColumnKey>) {
  const continuous = continuousScroll && scrollable && enablePagination
  const [filterValue, setFilterValue] = React.useState('')
  const q = filterValue.trim()

  const [sortDescriptor, setSortDescriptor] =
    React.useState<SortDescriptor>(initialSort)

  const [rowsPerPage, setRowsPerPage] = React.useState(
    continuous ? BROWSE_PAGE_SIZE : 5
  )
  const [page, setPage] = React.useState(1)

  const [visibleColumns, setVisibleColumns] = React.useState<
    'all' | Set<string>
  >(() => {
    if (initialVisibleColumns) return initialVisibleColumns
    return 'all'
  })

  const availableColumns = React.useMemo(() => {
    if (visibleColumns === 'all') return 'all'
    const keys = new Set(
      columns
        .filter((column) => visibleColumns.has(String(column.uid)))
        .map((column) => String(column.uid))
    )
    return keys.size
      ? keys
      : new Set(columns.map((column) => String(column.uid)))
  }, [columns, visibleColumns])
  const headerColumns = React.useMemo(() => {
    if (!enableColumnSelector || availableColumns === 'all') return columns
    return columns.filter((column) => availableColumns.has(String(column.uid)))
  }, [columns, enableColumnSelector, availableColumns])

  const filteredItems = React.useMemo(() => {
    if (!enableSearch || !q || !searchPredicate) return items
    const qq = q.toLowerCase()
    return items.filter((it) => searchPredicate(it, qq))
  }, [items, enableSearch, q, searchPredicate])

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPage(1)
      if (continuous) {
        const wrapper = tableRoot.current?.querySelector('table')?.parentElement
        if (wrapper) wrapper.scrollTop = 0
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [q, items, rowsPerPage, continuous])

  const sortedItems = React.useMemo(
    () =>
      orderTableItems(
        filteredItems,
        sortDescriptor,
        getSortValue,
        rowKey,
        pinnedKeys
      ),
    [filteredItems, getSortValue, sortDescriptor, rowKey, pinnedKeys]
  )
  const firstPinned = pinnedKeys?.size
    ? sortedItems.find((item) => pinnedKeys.has(rowKey(item, 0)))
    : undefined
  const focusedKey = firstPinned != null ? rowKey(firstPinned, 0) : focusRowKey

  const pages = React.useMemo(() => {
    if (!enablePagination) return 1
    return Math.max(1, Math.ceil(sortedItems.length / rowsPerPage))
  }, [enablePagination, sortedItems.length, rowsPerPage])

  const currentPage = Math.min(page, pages)

  const pageItems = React.useMemo(() => {
    if (!enablePagination || continuous) return sortedItems
    const start = (currentPage - 1) * rowsPerPage
    return sortedItems.slice(start, start + rowsPerPage)
  }, [enablePagination, continuous, sortedItems, currentPage, rowsPerPage])

  const tableRoot = React.useRef<HTMLDivElement>(null)
  const jumpToPage = (next: number) => {
    setPage(next)
    const wrapper = tableRoot.current?.querySelector('table')?.parentElement
    if (continuous && wrapper) {
      wrapper.scrollTop = (next - 1) * rowsPerPage * BROWSE_ROW_HEIGHT
    }
  }

  React.useEffect(() => {
    const root = tableRoot.current
    const wrapper = root?.querySelector('table')?.parentElement
    if (!continuous || !root || !wrapper) return
    const onScroll = () => {
      const atBottom =
        wrapper.scrollTop > 0 &&
        wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 1
      const index = atBottom
        ? sortedItems.length - 1
        : Math.floor(wrapper.scrollTop / BROWSE_ROW_HEIGHT)
      setPage(Math.max(1, Math.min(pages, Math.floor(index / rowsPerPage) + 1)))
    }
    wrapper.addEventListener('scroll', onScroll, { passive: true })
    return () => wrapper.removeEventListener('scroll', onScroll)
  }, [continuous, pages, rowsPerPage, sortedItems.length])

  React.useEffect(() => {
    if (focusedKey == null) return
    const frame = requestAnimationFrame(() => {
      if (q && !filteredItems.some((item) => rowKey(item, 0) === focusedKey)) {
        setFilterValue('')
        return
      }
      const index = sortedItems.findIndex(
        (item) => rowKey(item, 0) === focusedKey
      )
      if (index >= 0 && enablePagination) {
        setPage(Math.floor(index / rowsPerPage) + 1)
        const wrapper = tableRoot.current?.querySelector('table')?.parentElement
        if (continuous && wrapper) {
          wrapper.scrollTop = index * BROWSE_ROW_HEIGHT
        }
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [
    focusedKey,
    focusRequest,
    continuous,
    sortedItems,
    rowsPerPage,
    enablePagination,
    q,
    filteredItems,
    rowKey,
  ])

  React.useEffect(() => {
    if (focusedKey == null || continuous) return
    const frame = requestAnimationFrame(() => {
      const rows =
        tableRoot.current?.querySelectorAll<HTMLElement>('[data-focus-row]')
      const row = Array.from(rows ?? []).find(
        (element) => element.dataset.focusRow === String(focusedKey)
      )
      row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusedKey, focusRequest, pageItems, continuous])

  React.useEffect(() => {
    if (continuous || !autoFitRows || !scrollable || !enablePagination) return
    const root = tableRoot.current
    const wrapper = root?.querySelector('table')?.parentElement
    const header = root?.querySelector('thead')
    if (!root || !wrapper || !header) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (wrapper.clientHeight === 0) return
        const renderedRows = root.querySelectorAll<HTMLElement>(
          'tbody tr[data-focus-row]'
        )
        const rowHeight = Math.max(
          28,
          ...Array.from(
            renderedRows,
            (row) => row.getBoundingClientRect().height
          )
        )
        const available =
          wrapper.clientHeight - header.getBoundingClientRect().height
        const count = Math.max(1, Math.floor((available - 1) / rowHeight))
        setRowsPerPage((previous) => (previous === count ? previous : count))
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(wrapper)
    observer.observe(header)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [
    autoFitRows,
    scrollable,
    enablePagination,
    pageItems,
    headerColumns,
    continuous,
  ])

  const onSelectionChangeVisibleCols = (keys: unknown) => {
    if (keys === 'all') return setVisibleColumns('all')
    if (!(keys instanceof Set)) return
    const set = new Set(Array.from(keys).map(String))
    if (disallowEmptyVisibleColumns && set.size === 0) return
    setVisibleColumns(set)
  }

  const columnMenu = (
    <TableColumnMenu
      columns={columns}
      selectedKeys={availableColumns}
      onSelectionChange={onSelectionChangeVisibleCols}
      label={columnSelectorLabel}
      inHeader={columnSelectorPlacement === 'header'}
      disallowEmptySelection={disallowEmptyVisibleColumns}
    />
  )
  const displayColumns =
    enableColumnSelector && columnSelectorPlacement === 'header'
      ? [
          ...headerColumns,
          {
            uid: '__column-options',
            name: columnMenu,
            sortable: false,
            align: 'center' as const,
          },
        ]
      : headerColumns

  const isClient = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  const columnWidths = React.useMemo(() => {
    const widths: Record<string, number> = {}
    const ctx = isClient
      ? document.createElement('canvas').getContext('2d')
      : null
    if (!ctx) return widths
    const fontFamily = getComputedStyle(document.body).fontFamily
    for (const column of columns) {
      if (column.width) {
        widths[column.uid] = column.width
        continue
      }
      ctx.font = `600 10px ${fontFamily}`
      let max =
        ctx.measureText(textOf(column.name)).width + (column.sortable ? 16 : 0)
      ctx.font = `400 12px ${fontFamily}`
      for (const item of items) {
        max = Math.max(
          max,
          ctx.measureText(textOf(renderCell(item, column.uid))).width
        )
      }
      widths[column.uid] = Math.ceil(max) + CELL_PADDING
    }
    return widths
  }, [isClient, columns, items, renderCell])

  const topContent =
    enableSearch ||
    topLeft ||
    topRight ||
    (enableColumnSelector && columnSelectorPlacement === 'toolbar') ? (
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-1">
          {topLeft}

          <div className="flex flex-wrap items-center gap-1">
            {enableSearch && (
              <Input
                isClearable
                size="sm"
                variant="bordered"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                startContent={<SearchIcon size={18} />}
                value={filterValue}
                onClear={() => setFilterValue('')}
                onValueChange={(v) => setFilterValue(v ?? '')}
                classNames={{
                  base: 'w-full sm:max-w-[44%]',
                  inputWrapper: 'border-1',
                }}
              />
            )}

            {enableColumnSelector &&
              columnSelectorPlacement === 'toolbar' &&
              columnMenu}

            {topRight}
          </div>
        </div>
      </div>
    ) : undefined

  const bottomContent = enablePagination ? (
    <TablePagination
      page={currentPage}
      pages={pages}
      onPage={jumpToPage}
      total={showTotal ? totalLabel(sortedItems.length) : null}
    />
  ) : (
    <div className="py-2 px-2 flex justify-end">
      <span className="text-default-400 text-small">
        {showTotal ? totalLabel(sortedItems.length) : null}
      </span>
    </div>
  )

  const classNames = {
    base: scrollable ? 'h-full min-h-0 gap-1' : 'gap-1',
    wrapper: scrollable
      ? 'min-h-0 flex-1 overflow-auto rounded-none p-0 shadow-none'
      : 'min-h-[190px]',
    th: `${tableStyles.headerCell} ${tableStyles.header}`,
    td: tableStyles.cell,
    tr: `${tableStyles.row} bg-content1 ${continuous ? '' : tableStyles.stripedRow}`,
    emptyWrapper: tableStyles.empty,
    table: scrollable ? 'min-w-[900px] border-collapse' : 'border-collapse',
  }

  return (
    <div ref={tableRoot} className={scrollable ? 'h-full min-h-0' : undefined}>
      <Table
        isCompact
        {...(continuous
          ? {
              isVirtualized: true,
              rowHeight: BROWSE_ROW_HEIGHT,
              // Fixed on purpose: HeroUI remounts the whole virtualized table
              // when this changes. The flex-1 wrapper takes its real height.
              maxTableHeight: BROWSE_TABLE_HEIGHT,
            }
          : {})}
        isHeaderSticky
        removeWrapper={!scrollable}
        layout="fixed"
        aria-label="Generic table"
        topContent={topContent}
        topContentPlacement="outside"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        sortDescriptor={sortDescriptor}
        onSortChange={(next) => {
          setSortDescriptor(next)
          jumpToPage(1)
        }}
        onRowAction={
          onRowAction
            ? (key) => {
                const item = pageItems.find((entry) => rowKey(entry, 0) === key)
                if (item !== undefined) onRowAction(item)
              }
            : undefined
        }
        classNames={classNames}
      >
        <TableHeader columns={displayColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              className={
                column.uid === '__column-options'
                  ? tableStyles.columnOptions
                  : undefined
              }
              allowsSorting={Boolean(column.sortable)}
              align={column.align ?? 'start'}
              width={columnWidths[column.uid]}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>

        <TableBody emptyContent={emptyContent}>
          {pageItems.map((item, itemIndex) => (
            <TableRow
              key={rowKey(item, 0)}
              data-focus-row={String(rowKey(item, 0))}
              data-highlighted={
                highlightedKeys?.has(rowKey(item, 0)) || undefined
              }
              className={
                [
                  onRowAction ? 'cursor-pointer' : '',
                  continuous && itemIndex % 2 ? 'bg-default-100' : '',
                  highlightedKeys?.has(rowKey(item, 0))
                    ? tableStyles.selectedRow
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            >
              {(columnKey) => (
                <TableCell
                  className={
                    columnKey === '__column-options'
                      ? 'sticky right-0 bg-inherit'
                      : autoFitRows
                        ? 'whitespace-nowrap'
                        : undefined
                  }
                >
                  {columnKey === '__column-options'
                    ? null
                    : renderCell(item, String(columnKey) as TColumnKey)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
