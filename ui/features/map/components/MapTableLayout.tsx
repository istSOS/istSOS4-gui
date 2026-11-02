'use client'

import { Button } from '@heroui/button'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDownIcon } from '@/components/icons'

export default function MapTableLayout({
  map,
  children,
  collapsed,
  onExpand,
  onCollapse,
}: {
  map: ReactNode
  children: ReactNode
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
}) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(40)
  const clamp = (value: number) => Math.min(65, Math.max(25, value))
  return (
    <div ref={root} className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">{map}</div>
      <div className="relative flex h-6 shrink-0 items-center justify-end border-y border-default-200 bg-default-100">
        {!collapsed && (
          <div
            role="separator"
            tabIndex={0}
            aria-label={t('map.resize_table')}
            aria-controls="map-datastream-table"
            aria-orientation="horizontal"
            aria-valuemin={25}
            aria-valuemax={65}
            aria-valuenow={Math.round(height)}
            className="absolute inset-y-0 left-0 right-9 flex cursor-row-resize touch-none items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return
              const rect = root.current?.getBoundingClientRect()
              if (rect)
                setHeight(
                  clamp(((rect.bottom - event.clientY) / rect.height) * 100)
                )
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onKeyDown={(event) => {
              if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                setHeight((previous) =>
                  event.key === 'Home'
                    ? 25
                    : event.key === 'End'
                      ? 65
                      : clamp(previous + (event.key === 'ArrowUp' ? 5 : -5))
                )
              }
            }}
          >
            <span className="h-1 w-10 rounded-full bg-default-400" />
          </div>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="h-5 w-9 min-w-9"
          aria-label={t(collapsed ? 'map.show_table' : 'map.collapse_table')}
          title={t(collapsed ? 'map.show_table' : 'map.collapse_table')}
          aria-expanded={!collapsed}
          aria-controls="map-datastream-table"
          onPress={collapsed ? onExpand : onCollapse}
        >
          <ChevronDownIcon
            size={16}
            className={collapsed ? 'rotate-180' : undefined}
          />
        </Button>
      </div>

      <section
        id="map-datastream-table"
        aria-label={t('map.datastreams')}
        hidden={collapsed}
        className="min-h-0 shrink-0 overflow-hidden bg-content1 pb-[env(safe-area-inset-bottom)]"
        style={{ height: `${height}%` }}
      >
        {children}
      </section>
    </div>
  )
}
