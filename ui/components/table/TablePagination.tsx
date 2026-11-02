'use client'

import { Pagination } from '@heroui/pagination'
import type { ReactNode } from 'react'

export default function TablePagination({
  page,
  pages,
  onPage,
  total,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
  total?: ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-1 py-1">
      <Pagination
        showControls
        page={page}
        total={pages}
        variant="light"
        onChange={onPage}
        color="primary"
        classNames={{
          base: 'p-0 gap-1',
          wrapper: 'p-0 gap-1',
          item: 'min-w-6 h-6 px-0 text-xs leading-4 cursor-pointer',
          prev: 'min-w-6 h-6 px-0 cursor-pointer',
          next: 'min-w-6 h-6 px-0 cursor-pointer',
          cursor: 'min-w-6 h-6 cursor-pointer',
        }}
      />
      <span className="text-small text-default-400">{total}</span>
    </div>
  )
}
