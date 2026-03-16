'use client'

import { Card } from '@heroui/card'

export default function Tooltip({
  name,
  network,
}: {
  name: string
  network?: string
}) {
  return (
    <Card>
      <div className="min-w-0 flex items-center px-2 py-1">
        <div className="min-w-0">
          <div className="text-xs font-medium leading-4 truncate">{name}</div>
          <div className="text-[11px] text-default-500 leading-3 truncate">
            {network}
          </div>
        </div>
      </div>
    </Card>
  )
}
