'use client'

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

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

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
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload?.sub ?? 'User'
    } catch {
      return 'User'
    }
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
      router.push('/login')
    }
  }

  const selectedFlag =
    languages.find((l) => l.code === selectedLang)?.flag ?? languages[0].flag

  return (
    <header className="w-full bg-[var(--color-primary)] text-white">
      <div className="mx-auto flex h-14 w-full items-center justify-between lg:px-[25px] text-sm">
        <Link isExternal aria-label="istSOS4" href={siteConfig.links.istSOS}>
          <div className="w-[150px]">
            <LogoIstSOS className="w-full" />
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="light"
                isIconOnly
                className="text-white hover:bg-white/10"
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
            className="inline-flex items-center gap-2 rounded-md p-2 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
                    className="rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
