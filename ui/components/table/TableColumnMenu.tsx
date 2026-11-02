'use client'

import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/dropdown'
import type { ReactNode } from 'react'

import { ChevronDownIcon, MoreIcon } from '@/components/icons'

export default function TableColumnMenu({
  columns,
  selectedKeys,
  onSelectionChange,
  label,
  inHeader = true,
  disallowEmptySelection = true,
}: {
  columns: { uid: string; name: ReactNode }[]
  selectedKeys: 'all' | Set<string>
  onSelectionChange: (keys: unknown) => void
  label: ReactNode
  inHeader?: boolean
  disallowEmptySelection?: boolean
}) {
  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly={inHeader}
          aria-label={String(label)}
          title={String(label)}
          className={inHeader ? 'h-6 w-6 min-w-6' : undefined}
          endContent={inHeader ? undefined : <ChevronDownIcon size={18} />}
          size="sm"
          variant="flat"
        >
          {inHeader ? <MoreIcon size={18} /> : label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        closeOnSelect={false}
        disallowEmptySelection={disallowEmptySelection}
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        aria-label={String(label)}
      >
        <DropdownSection title={String(label)}>
          {columns.map((column) => (
            <DropdownItem key={column.uid}>{column.name}</DropdownItem>
          ))}
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  )
}
