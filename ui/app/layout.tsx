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
import type { ReactNode } from 'react'

import Navbar from '@/components/layout/Navbar'

import { AuthProvider } from '@/context/AuthContext'

import '@/styles/globals.css'

import Providers from './providers'

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body
        style={{
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
        }}
        className="min-h-screen"
      >
        <Providers>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
