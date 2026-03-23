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
import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown'
import { Input } from '@heroui/input'
import { Pagination } from '@heroui/pagination'
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

import { ChevronDownIcon, SearchIcon } from '@/components/icons'

type TableProps = {
  items: any[]
  columns: any[]
  rowKey: (item: any, index: number) => Key
  renderCell: (item: any, columnKey: string) => ReactNode

  initialSort?: SortDescriptor
  getSortValue?: (item: any, columnKey: string) => string | number | null

  enableSearch?: boolean
  searchPlaceholder?: string
  searchPredicate?: (item: any, query: string) => boolean

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

export default function TableComponent({
  items,
  columns,
  rowKey,
  renderCell,

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
}: TableProps) {
  const [filterValue, setFilterValue] = React.useState('')
  const q = filterValue.trim()

  const [sortDescriptor, setSortDescriptor] =
    React.useState<SortDescriptor>(initialSort)

  const [rowsPerPage, setRowsPerPage] = React.useState(5)
  const [page, setPage] = React.useState(1)

  const [visibleColumns, setVisibleColumns] = React.useState<
    'all' | Set<string>
  >(() => {
    if (initialVisibleColumns) return initialVisibleColumns
    return 'all'
  })

  React.useEffect(() => {
    setVisibleColumns((prev) => {
      if (prev === 'all') return 'all'
      const allowed = new Set(columns.map((c) => c.uid))
      const next = new Set<string>()
      for (const k of prev) if (allowed.has(k)) next.add(k)
      return next.size ? next : new Set(columns.map((c) => c.uid))
    })
  }, [columns])

  const headerColumns = React.useMemo(() => {
    if (!enableColumnSelector) return columns
    if (visibleColumns === 'all') return columns
    return columns.filter((c) => (visibleColumns as Set<string>).has(c.uid))
  }, [columns, enableColumnSelector, visibleColumns])

  const filteredItems = React.useMemo(() => {
    if (!enableSearch || !q || !searchPredicate) return items
    const qq = q.toLowerCase()
    return items.filter((it) => searchPredicate(it, qq))
  }, [items, enableSearch, q, searchPredicate])

  React.useEffect(() => setPage(1), [q, items, rowsPerPage])

  const sortedItems = React.useMemo(() => {
    if (!getSortValue || !sortDescriptor?.column) return filteredItems

    const columnKey = String(sortDescriptor.column)
    const dir = sortDescriptor.direction === 'descending' ? -1 : 1

    return [...filteredItems].sort((a, b) => {
      const first = getSortValue(a, columnKey)
      const second = getSortValue(b, columnKey)

      if (typeof first === 'number' && typeof second === 'number') {
        return (first - second) * dir
      }

      return (
        String(first ?? '').localeCompare(String(second ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * dir
      )
    })
  }, [filteredItems, getSortValue, sortDescriptor])

  const pages = React.useMemo(() => {
    if (!enablePagination) return 1
    return Math.max(1, Math.ceil(sortedItems.length / rowsPerPage))
  }, [enablePagination, sortedItems.length, rowsPerPage])

  React.useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  const pageItems = React.useMemo(() => {
    if (!enablePagination) return sortedItems
    const start = (page - 1) * rowsPerPage
    return sortedItems.slice(start, start + rowsPerPage)
  }, [enablePagination, sortedItems, page, rowsPerPage])

  const onSelectionChangeVisibleCols = (keys: any) => {
    if (keys === 'all') return setVisibleColumns('all')
    const set = new Set(Array.from(keys as Set<Key>).map(String))
    if (disallowEmptyVisibleColumns && set.size === 0) return
    setVisibleColumns(set)
  }

  const topContent = (
    <div className="flex flex-col">
      <div className="flex justify-between">
        {topLeft}

        <div className="flex gap-1 items-end">
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

          {enableColumnSelector && (
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button
                  endContent={<ChevronDownIcon className="h-6 w-6 min-w-6" />}
                  size="sm"
                  variant="flat"
                >
                  {columnSelectorLabel}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                closeOnSelect={false}
                disallowEmptySelection={disallowEmptyVisibleColumns}
                selectionMode="multiple"
                selectedKeys={
                  visibleColumns === 'all'
                    ? 'all'
                    : (visibleColumns as Set<string>)
                }
                onSelectionChange={onSelectionChangeVisibleCols}
                aria-label="Table Columns"
              >
                {columns.map((c) => (
                  <DropdownItem key={c.uid} className="capitalize">
                    {c.name}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          )}

          {topRight}
        </div>
      </div>
    </div>
  )

  const bottomContent = enablePagination ? (
    <div className="py-1 px-1 flex justify-between items-center">
      <Pagination
        showControls
        page={page}
        total={pages}
        variant="light"
        onChange={setPage}
        color="primary"
        classNames={{
          base: 'p-0 gap-1',
          wrapper: 'p-0 gap-1',
          item: 'min-w-6 h-6 px-0 text-xs leading-4',
          prev: 'min-w-6 h-6 px-0',
          next: 'min-w-6 h-6 px-0',
          cursor: 'min-w-6 h-6',
        }}
      />

      <span className="text-default-400 text-small">
        {showTotal ? totalLabel(sortedItems.length) : null}
      </span>
    </div>
  ) : (
    <div className="py-2 px-2 flex justify-end">
      <span className="text-default-400 text-small">
        {showTotal ? totalLabel(sortedItems.length) : null}
      </span>
    </div>
  )

  const classNames = {
    base: 'gap-1',
    wrapper: 'min-h-[190px]',
    th: ['text-[10px]', 'font-semibold', 'px-2', 'py-0.5', 'h-7', 'leading-4'],
    td: [
      'px-2',
      'py-0.5',
      'h-7',
      'text-xs',
      'leading-4',
      'border-b',
      'border-default-200',
    ],
    tr: 'hover:bg-[color:rgba(0,131,116,0.12)]',
    table: 'border-collapse',
  }

  return (
    <Table
      isCompact
      isStriped
      isHeaderSticky
      removeWrapper
      layout="fixed"
      aria-label="Generic table"
      topContent={topContent}
      topContentPlacement="outside"
      bottomContent={bottomContent}
      bottomContentPlacement="outside"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
      classNames={classNames}
    >
      <TableHeader columns={headerColumns}>
        {(column) => (
          <TableColumn
            key={column.uid}
            allowsSorting={Boolean(column.sortable)}
            align={column.align ?? 'start'}
          >
            {column.name}
          </TableColumn>
        )}
      </TableHeader>

      <TableBody emptyContent={emptyContent} items={pageItems}>
        {(item) => (
          <TableRow key={rowKey(item, 0)}>
            {(columnKey) => (
              <TableCell>{renderCell(item, String(columnKey))}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
