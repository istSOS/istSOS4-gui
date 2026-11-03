'use client'

import i18n from '@/i18n'
import { logout } from '@/services/auth'
import { Avatar } from '@heroui/avatar'
import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/dropdown'
import 'flag-icons/css/flag-icons.min.css'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import { AccountIcon } from '@/components/icons'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import { getTokenUsername } from '@/lib/auth'

const languages = [
  { code: 'en', label: 'English', flag: 'fi fi-gb fis' },
  { code: 'it', label: 'Italiano', flag: 'fi fi-it fis' },
]

export default function AccountMenu() {
  const { token, setToken } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()
  const [selectedLang, setSelectedLang] = useState('en')
  const username =
    siteConfig.authorizationEnabled && token ? getTokenUsername(token) : null
  const initials =
    username
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() ?? ''

  useEffect(() => {
    setSelectedLang(i18n.resolvedLanguage ?? i18n.language ?? 'en')
    const changed = (language: string) => setSelectedLang(language)
    i18n.on('languageChanged', changed)
    return () => {
      i18n.off('languageChanged', changed)
    }
  }, [])

  const handleLogout = async () => {
    try {
      if (token) await logout(token)
    } finally {
      setToken(null)
      router.push(siteConfig.authorizationEnabled ? '/login' : '/')
    }
  }

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          variant="light"
          className="text-white"
          aria-label={t('navbar.account')}
          title={t('navbar.account')}
        >
          {username ? (
            <Avatar
              size="sm"
              fallback={initials}
              className="bg-white text-[var(--color-primary)]"
            />
          ) : (
            <AccountIcon size={22} />
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t('navbar.accountMenu')}
        variant="light"
        className="min-w-52"
      >
        <DropdownSection showDivider>
          <DropdownItem
            key="identity"
            isReadOnly
            textValue={username ?? t('navbar.account')}
            className="opacity-100"
          >
            {username ? (
              <div className="flex flex-col">
                <span className="text-xs text-default-500">
                  {t('login.username')}
                </span>
                <span className="font-semibold">{username}</span>
              </div>
            ) : (
              <span className="text-default-500">
                {t(
                  siteConfig.authorizationEnabled
                    ? 'navbar.signedOut'
                    : 'navbar.preferences'
                )}
              </span>
            )}
          </DropdownItem>
        </DropdownSection>
        <DropdownSection
          title={t('navbar.language')}
          showDivider={siteConfig.authorizationEnabled}
        >
          {languages.map((language) => (
            <DropdownItem
              key={language.code}
              textValue={language.label}
              aria-current={selectedLang === language.code ? true : undefined}
              onPress={() => {
                void i18n.changeLanguage(language.code)
              }}
              startContent={
                <span
                  aria-hidden="true"
                  className={`${language.flag} h-4 w-6 shrink-0 rounded-sm`}
                />
              }
              endContent={
                selectedLang === language.code ? (
                  <span aria-hidden="true" className="text-primary">
                    ✓
                  </span>
                ) : undefined
              }
            >
              {language.label}
            </DropdownItem>
          ))}
        </DropdownSection>
        {siteConfig.authorizationEnabled && (
          <DropdownSection aria-label={t('navbar.account')}>
            {username ? (
              <DropdownItem
                key="logout"
                color="danger"
                className="text-danger"
                onPress={handleLogout}
              >
                {t('login.logout')}
              </DropdownItem>
            ) : (
              <DropdownItem key="login" onPress={() => router.push('/login')}>
                {t('login.login')}
              </DropdownItem>
            )}
          </DropdownSection>
        )}
      </DropdownMenu>
    </Dropdown>
  )
}
