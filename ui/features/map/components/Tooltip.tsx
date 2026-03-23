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
import { UNSPECIFIED_NETWORK_KEY } from '@/features/map/lib/leafletDraw'
import { Card } from '@heroui/card'
import { useTranslation } from 'react-i18next'

export default function Tooltip({
  name,
  network,
}: {
  name: string
  network?: string
}) {
  const { t } = useTranslation()
  const networkLabel =
    network === UNSPECIFIED_NETWORK_KEY || !network?.trim()
      ? t('map.unspecified_network')
      : network

  return (
    <Card>
      <div className="min-w-0 flex items-center px-2 py-1">
        <div className="min-w-0">
          <div className="text-xs font-medium leading-4 truncate">{name}</div>
          <div className="text-[11px] text-default-500 leading-3 truncate">
            {networkLabel}
          </div>
        </div>
      </div>
    </Card>
  )
}
