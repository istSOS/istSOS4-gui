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
import { Link } from '@heroui/link'
import React, { useState } from 'react'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import fetchLogin from '@/server/fetchLogin'

import { LogoIstSOS, LogoOSGeo } from '../icons'

export default function LoginModal({ open, onClose }) {
  const { setToken } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const login = await fetchLogin(username, password)
    if (login?.access_token) {
      setToken(login.access_token)
      onClose()
    } else {
      setError('Login failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          background: '#fff',
          borderRadius: '24px',
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          width: '600px',
        }}
      >
        <div
          style={{
            backgroundColor: siteConfig.main_color,
            width: '200px',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            borderTopRightRadius: '100px',
            borderBottomRightRadius: '100px',
          }}
        >
          <Link isExternal aria-label="istSOS4" href={siteConfig.links.istSOS}>
            <div
              style={{
                width: 150,
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <LogoIstSOS style={{ width: '100%', height: 'auto' }} />
            </div>
          </Link>

          <Link isExternal aria-label="OSGeo" href={siteConfig.links.OSGeo}>
            <div
              style={{
                width: 120,
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoOSGeo style={{ width: '100%', height: 'auto' }} />
            </div>
          </Link>
        </div>
        <div style={{ padding: '50px', width: '100%' }}>
          <h2
            style={{
              fontWeight: 'bold',
              textAlign: 'center',
              color: siteConfig.main_color,
              marginBottom: '30px',
              fontSize: '28px',
            }}
          >
            Sign In
          </h2>
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                color: '#333',
                backgroundColor: '#D6D6D6',
                display: 'block',
                marginBottom: '20px',
                width: '100%',
                padding: '14px',
                borderRadius: '6px',
                boxSizing: 'border-box',
                fontSize: '16px',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                color: '#333',
                backgroundColor: '#D6D6D6',
                display: 'block',
                marginBottom: '30px',
                width: '100%',
                padding: '14px',
                borderRadius: '6px',
                boxSizing: 'border-box',
                fontSize: '16px',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <a
                href="#"
                style={{
                  color: siteConfig.main_color,
                  textDecoration: 'none',
                  fontSize: '14px',
                }}
              >
                Need help?
              </a>
              <Button
                radius="sm"
                type="submit"
                style={{
                  padding: '14px 24px',
                  backgroundColor: siteConfig.main_color,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                Sign In
              </Button>
            </div>
            {error && (
              <div
                style={{
                  color: 'red',
                  marginTop: '16px',
                  textAlign: 'center',
                  fontSize: '14px',
                }}
              >
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
