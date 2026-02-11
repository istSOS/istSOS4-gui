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
import React from 'react'

import { siteConfig } from '@/config/site'

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: siteConfig.secondary_color,
        color: 'white',
        textAlign: 'center',
        padding: '12px 0',
        fontSize: '1rem',
        position: 'initial',
        left: 0,
        bottom: 0,
        width: '100%',
        zIndex: 100,
      }}
    >
      <a
        href="https://www.supsi.ch/ist"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'white', textDecoration: 'none' }}
      >
        © {new Date().getFullYear()} Open Source Software by Institute of Earth
        Science - SUPSI
      </a>
    </footer>
  )
}
