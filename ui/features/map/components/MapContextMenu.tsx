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
import { Card } from '@heroui/card'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  CrosshairIcon,
  MarkerIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/components/icons'

type Props = {
  x: number
  y: number
  onCenterHere: () => void
  onCreateThing: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-[15px] text-default-700 hover:bg-black/5"
    >
      <span className="flex h-5 w-5 items-center justify-center text-default-800">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}

export default function MapContextMenu({
  x,
  y,
  onCenterHere,
  onCreateThing,
  onZoomIn,
  onZoomOut,
}: Props) {
  const { t } = useTranslation()

  return (
    <div
      className="absolute z-[4500]"
      style={{ left: x, top: y, transform: 'translate(8px, 8px)' }}
    >
      <Card className="w-[180px] overflow-hidden rounded-xl bg-white/95 py-2 shadow-xl">
        <MenuRow
          icon={<CrosshairIcon />}
          label={t('general.center_map_here')}
          onClick={onCenterHere}
        />
        <MenuRow
          icon={<MarkerIcon />}
          label={t('general.new')}
          onClick={onCreateThing}
        />

        <div className="mx-3 my-1 border-t border-default-200" />

        <MenuRow icon={<ZoomInIcon />} label="Zoom In" onClick={onZoomIn} />
        <MenuRow icon={<ZoomOutIcon />} label="Zoom Out" onClick={onZoomOut} />
      </Card>
    </div>
  )
}
