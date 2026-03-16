'use client'

import { HeroUIProvider } from '@heroui/system'
import * as React from 'react'

import { ThemeProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export interface ProvidersProps {
  children: React.ReactNode
  themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
  return (
    <HeroUIProvider>
      <ThemeProvider {...themeProps}>{children}</ThemeProvider>
    </HeroUIProvider>
  )
}
