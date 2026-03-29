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
import { BasemapKey } from '@/types'
import { Button } from '@heroui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { useCallback, useMemo, useRef } from 'react'

import { BASEMAPS } from '@/config/site'

const THUMBS: Record<BasemapKey, { left: number; top: number }> = {
  satellite: { left: 0, top: 0 },
  pixelGray: { left: -104, top: 0 },
  pixelColor: { left: -205, top: 0 },
}

function normalizeBasePath(rawBasePath?: string) {
  if (!rawBasePath) return ''
  if (rawBasePath === 'undefined' || rawBasePath === 'null') return ''

  const trimmed = rawBasePath.trim()
  if (!trimmed || trimmed === '/' || trimmed === 'undefined' || trimmed === 'null') {
    return ''
  }

  const withoutTrailing = trimmed.replace(/\/+$/, '')
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`
}

const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

const SPRITE_URL = `${BASE_PATH}/basemapimage.jpeg`

function Thumb({ k }: { k: BasemapKey }) {
  const pos = THUMBS[k]
  const title = BASEMAPS[k].label

  return (
    <div className="w-[96px] rounded-lg overflow-hidden">
      <div className="px-2 py-1 text-[11px] font-semibold text-white bg-black/60">
        {title}
      </div>
      <div className="w-[96px] h-[64px] relative overflow-hidden bg-black">
        <img
          src={SPRITE_URL}
          className="absolute"
          style={{
            left: pos.left,
            top: pos.top,
            width: 320,
            height: 64,
            maxWidth: 'none',
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}

function Strip({
  active,
  items,
  onChange,
}: {
  active: BasemapKey
  items: BasemapKey[]
  onChange: (k: BasemapKey) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const scrollBy = useCallback((dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  }, [])

  return (
    <div className="flex items-center gap-2">
      <Button
        isIconOnly
        variant="flat"
        className="min-w-8 w-8 h-8 rounded-full bg-black/40 text-white"
        onPress={() => scrollBy(-240)}
        aria-label="Scroll left"
      >
        ‹
      </Button>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth max-w-[420px] py-1"
        style={{ scrollbarWidth: 'none' }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {items.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={[
              'shrink-0 rounded-xl overflow-hidden focus:outline-none',
              k === active
                ? 'ring-2 ring-[var(--color-primary)]'
                : 'ring-1 ring-white/15 hover:ring-white/35',
            ].join(' ')}
          >
            <Thumb k={k} />
          </button>
        ))}
      </div>

      <Button
        isIconOnly
        variant="flat"
        className="min-w-8 w-8 h-8 rounded-full bg-black/40 text-white"
        onPress={() => scrollBy(240)}
        aria-label="Scroll right"
      >
        ›
      </Button>
    </div>
  )
}

export default function MapMenuHorizontal({
  active,
  onChange,
}: {
  active: BasemapKey
  onChange: (k: BasemapKey) => void
}) {
  const items = useMemo(() => {
    const keys = Object.keys(BASEMAPS) as BasemapKey[]
    return keys.filter((k) => Boolean(THUMBS[k]))
  }, [])

  return (
    <Popover placement="bottom-start" offset={8}>
      <PopoverTrigger>
        <button
          type="button"
          className="rounded-xl overflow-hidden focus:outline-none bg-black/25 backdrop-blur ring-2 ring-[var(--color-primary)]"
          aria-label="Select basemap"
        >
          <Thumb k={active} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="p-2 bg-black/50 backdrop-blur rounded-2xl">
        <Strip active={active} items={items} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
