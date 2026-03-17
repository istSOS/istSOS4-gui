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
        style={{ backgroundColor: 'var(--color-primary)' }}
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
