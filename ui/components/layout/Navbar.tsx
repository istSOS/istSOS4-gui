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
import i18n from '@/i18n'
import { logout } from '@/services/auth'
import { Avatar } from '@heroui/avatar'
import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown'
import { Link } from '@heroui/link'
import 'flag-icons/css/flag-icons.min.css'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import { GithubIcon, LogoIstSOS } from '@/components/icons'
import TemporalBadge from '@/components/TemporalBadge'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import { getTokenUsername } from '@/lib/auth'

export default function Navbar() {
  const { token, setToken } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  const languages = [
    { code: 'en', label: 'EN', flag: 'fi fi-gb fis w-12 h-8' },
    { code: 'it', label: 'IT', flag: 'fi fi-it fis w-12 h-8' },
  ]

  // ✅ render-stable default for SSR + first client render
  const [selectedLang, setSelectedLang] = useState<string>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // ✅ after mount, sync with i18n (client-only)
    const current = i18n.resolvedLanguage ?? i18n.language ?? 'en'
    setSelectedLang(current)

    // keep in sync if language changes elsewhere
    const onLangChanged = (lng: string) => setSelectedLang(lng)
    i18n.on('languageChanged', onLangChanged)
    return () => {
      i18n.off('languageChanged', onLangChanged)
    }
  }, [])

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode)
    // state will also update via languageChanged listener
    setSelectedLang(langCode)
  }

  const username = useMemo(() => {
    if (!siteConfig.authorizationEnabled) return null
    if (!token) return null
    return getTokenUsername(token)
  }, [token])

  const initials = useMemo(() => {
    if (!username) return ''
    const parts = username.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
    return (first + second).toUpperCase()
  }, [username])

  const handleLogout = async () => {
    try {
      if (token) await logout(token)
    } finally {
      setToken(null)
      router.push(siteConfig.authorizationEnabled ? '/login' : '/')
    }
  }

  const selectedFlag =
    languages.find((l) => l.code === selectedLang)?.flag ?? languages[0].flag

  const prototypePages = [
    { label: 'Things', href: '/things' },
    { label: 'Datastreams', href: '/datastreams' },
    { label: 'Commits', href: '/commits' },
    { label: 'History', href: '/history' },
  ]

  return (
    <header className="w-full border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-4 text-sm sm:px-6 lg:px-8">
        <Link isExternal aria-label="istSOS4" href={siteConfig.links.istSOS}>
          <div className="w-[150px]">
            <LogoIstSOS className="w-full" />
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <TemporalBadge />
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            {prototypePages.map((page) => (
              <Button
                key={page.href}
                size="sm"
                variant="light"
                className="text-[var(--color-text-primary)]"
                onPress={() => router.push(page.href)}
              >
                {page.label}
              </Button>
            ))}
          </div>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="light"
                isIconOnly
                className="text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]"
                aria-label="Change language"
              >
                {/* ✅ optionally hide flag until mounted to be extra-safe */}
                {mounted ? (
                  <span className={selectedFlag} />
                ) : (
                  <span className="w-12 h-8 inline-block" />
                )}
              </Button>
            </DropdownTrigger>

            <DropdownMenu aria-label="Language selection" variant="light">
              {languages.map((lang) => (
                <DropdownItem
                  key={lang.code}
                  onPress={() => handleLanguageChange(lang.code)}
                  startContent={<span className={lang.flag} />}
                >
                  {lang.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>

          <Link
            isExternal
            aria-label="Source Code"
            href={siteConfig.links.github}
            className="inline-flex items-center gap-2 rounded-md p-2 text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)]"
          >
            <GithubIcon />
          </Link>

          {username && (
            <div className="flex items-center gap-1">
              <span className="hidden sm:inline">
                {t('login.cheer')} <b>{username}</b>
              </span>

              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <button
                    type="button"
                    className="rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-strong)]"
                    aria-label="Open user menu"
                  >
                    <Avatar
                      size="sm"
                      name={username}
                      showFallback
                      fallback={initials || 'U'}
                      className="cursor-pointer"
                    />
                  </button>
                </DropdownTrigger>

                <DropdownMenu aria-label="User menu" variant="light">
                  <DropdownItem key="user" isReadOnly className="opacity-100">
                    <div className="flex flex-col">
                      <span className="text-xs opacity-70">
                        {t('login.username')}
                      </span>
                      <span className="font-semibold">{username}</span>
                    </div>
                  </DropdownItem>

                  <DropdownItem
                    key="logout"
                    color="danger"
                    className="text-danger"
                    onPress={handleLogout}
                  >
                    {t('login.logout')}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
