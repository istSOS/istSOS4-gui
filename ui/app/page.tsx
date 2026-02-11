'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import { siteConfig } from '@/config/site'

import { useEntities } from '@/context/EntitiesContext'

const mainColor = siteConfig.main_color

export default function Page() {
  const router = useRouter()
  const { t } = useTranslation()
  const networks = useEntities().entities.network

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold mb-8" style={{ color: 'white' }}>
        {t('general.select_network')}
      </h1>

      <div className="max-w-7xl mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {networks.map((network) => (
          <div
            key={network.name}
            onClick={() =>
              router.push(
                `/network?id=${encodeURIComponent(network['@iot.id'])}&name=${encodeURIComponent(network.name)}`
              )
            }
            className="cursor-pointer bg-teal-700 hover:bg-teal-600 transition-colors duration-200 text-white rounded-2xl shadow-lg p-9 flex flex-col items-center justify-center"
          >
            <h3 className="text-xl font-semibold">{network.name}</h3>
          </div>
        ))}
      </div>
    </div>
  )
}
