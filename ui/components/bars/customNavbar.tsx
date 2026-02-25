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
import { Link } from '@heroui/link'
import React from 'react'

import { GithubIcon } from '@/components/icons'

import { siteConfig } from '@/config/site'

const secondaryColor = siteConfig.secondary_color

export function CustomNavbar() {
  return (
    <div
      style={{
        width: '100%',
        background: secondaryColor,
        padding: '6px 75px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 35,
        boxSizing: 'border-box',
      }}
    >
      <span
        className="text-white select-none"
        style={{ fontSize: '15px', fontWeight: 500 }}
      >
        Discussions
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          isExternal
          aria-label="Source Code"
          href={siteConfig.links.github}
          className="flex items-center justify-center h-full text-white font-light text-base select-none"
          style={{
            fontSize: '15px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Source Code
          <GithubIcon className="text-white" />
        </Link>
      </span>
    </div>
  )
}
