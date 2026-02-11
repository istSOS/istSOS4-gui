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
import { Button } from '@heroui/button'
import React from 'react'

import { useRouter } from 'next/navigation'

export function SecNavbar({
  title = '',
  showBack = true,
  onBack,
}: {
  title?: string
  showBack?: boolean
  onBack?: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-4">
      {showBack && (
        <Button
          radius="sm"
          isIconOnly
          onPress={onBack ? onBack : () => window.history.back()}
        >
          ←
        </Button>
      )}
      <h1 className="text-4xl font-bold" style={{ color: 'white' }}>
        {title}
      </h1>
    </div>
  )
}
