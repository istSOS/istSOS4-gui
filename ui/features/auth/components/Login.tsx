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
import { login } from '@/services/auth'
import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown'
import { Form } from '@heroui/form'
import { Input } from '@heroui/input'
import { Link } from '@heroui/link'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import { setCookie } from 'cookies-next'
import 'flag-icons/css/flag-icons.min.css'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import { LogoIstSOS, LogoOSGeo } from '@/components/icons'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'
import { decodeTokenPayload } from '@/lib/auth'

type LoginModalProps = {
  open: boolean
  onClose: () => void
}

export default function Login({ open, onClose }: LoginModalProps) {
  const { setToken } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [submitted, setSubmitted] = useState<boolean>(false)

  const languages = [
    { code: 'en', label: 'EN', flag: 'fi fi-gb fis w-12 h-8' },
    { code: 'it', label: 'IT', flag: 'fi fi-it fis w-12 h-8' },
  ]

  const [selectedLang, setSelectedLang] = useState<string>(
    i18n.language || 'en'
  )

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode)
    setSelectedLang(langCode)
  }

  if (!open) return null

  const usernameError =
    submitted && !username.trim() ? t('login.username_error') : ''

  const passwordError =
    submitted && !password.trim() ? t('login.password_error') : ''

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (isLoading) return

    setSubmitted(true)
    setError('')

    if (!username.trim() || !password.trim()) {
      return
    }

    setIsLoading(true)

    try {
      const result = await login(username, password)

      if (result?.access_token) {
        setToken(result.access_token)
        const payload = decodeTokenPayload(result.access_token)
        const now = Math.floor(Date.now() / 1000)
        const maxAge =
          typeof payload?.exp === 'number'
            ? Math.max(payload.exp - now, 0)
            : 60 * 60 * 24

        setCookie('token', result.access_token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge,
          path: '/',
        })

        onClose()
        router.push('/')
      } else {
        setError(t('login.login_error'))
      }
    } catch (err) {
      setError(t('login.login_error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      backdrop="blur"
      size="xl"
      hideCloseButton
    >
      <Form
        onSubmit={onSubmit}
        onReset={() => {
          setUsername('')
          setPassword('')
          setError('')
          setSubmitted(false)
        }}
        className="w-full max-w-xs flex flex-col gap-4"
      >
        <ModalContent>
          <div className="absolute top-4 right-4">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="light" isIconOnly>
                  <span
                    className={
                      languages.find((l) => l.code === selectedLang)?.flag
                    }
                  />
                </Button>
              </DropdownTrigger>

              <DropdownMenu aria-label="Language selection" variant="light">
                {languages.map((lang) => (
                  <DropdownItem
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    startContent={<span className={lang.flag} />}
                  >
                    {lang.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </div>

          <div className="flex w-full">
            <div
              className="flex flex-col items-center justify-center p-8 w-[220px]"
              style={{
                backgroundColor: 'var(--color-primary)',
                borderTopRightRadius: '100px',
                borderBottomRightRadius: '100px',
              }}
            >
              <Link isExternal href={siteConfig.links.istSOS}>
                <LogoIstSOS className="w-[150px] mb-6" />
              </Link>

              <Link isExternal href={siteConfig.links.OSGeo}>
                <LogoOSGeo className="w-[150px] mb-6" />
              </Link>
            </div>

            <div className="flex-1 p-10">
              <ModalHeader
                className="justify-center text-2xl font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('login.login')}
              </ModalHeader>

              <ModalBody>
                <Input
                  isRequired
                  name="username"
                  label={t('login.username')}
                  labelPlacement="outside"
                  placeholder={t('login.username_placeholder')}
                  variant="flat"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  isInvalid={!!usernameError}
                  errorMessage={usernameError}
                />

                <Input
                  isRequired
                  name="password"
                  label={t('login.password')}
                  labelPlacement="outside"
                  placeholder={t('login.password_placeholder')}
                  variant="flat"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isInvalid={!!passwordError}
                  errorMessage={passwordError}
                />
              </ModalBody>

              <ModalFooter className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <Button
                    type="reset"
                    isDisabled={isLoading}
                    color="primary"
                    variant="light"
                  >
                    {t('login.reset')}
                  </Button>

                  <Button type="submit" isLoading={isLoading} color="primary">
                    {t('login.login')}
                  </Button>
                </div>

                {error && (
                  <p className="text-danger text-sm text-center mt-2">
                    {error}
                  </p>
                )}
              </ModalFooter>
            </div>
          </div>
        </ModalContent>
      </Form>
    </Modal>
  )
}
