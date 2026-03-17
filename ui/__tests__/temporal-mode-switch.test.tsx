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
import { render, screen } from '@testing-library/react'
import React from 'react'

import TemporalModeSwitch from '@/components/TemporalModeSwitch'

const contextMock = {
  mode: 'current',
  asOf: null,
  fromTo: null,
  setMode: jest.fn(),
  setAsOf: jest.fn(),
  setFromTo: jest.fn(),
}

jest.mock('@/context/TemporalContext', () => ({
  useTemporal: () => contextMock,
}))

describe('TemporalModeSwitch', () => {
  it('renders all three mode tabs', () => {
    contextMock.mode = 'current'
    render(<TemporalModeSwitch />)

    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('As-of')).toBeInTheDocument()
    expect(screen.getByText('From-to')).toBeInTheDocument()
  })

  it('shows as-of input in as_of mode', () => {
    contextMock.mode = 'as_of'
    contextMock.asOf = '2024-02-01T10:30:00Z'
    render(<TemporalModeSwitch />)

    expect(screen.getByLabelText('As-of timestamp')).toBeInTheDocument()
  })

  it('shows two datetime inputs in from_to mode', () => {
    contextMock.mode = 'from_to'
    contextMock.fromTo = ['2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z']
    render(<TemporalModeSwitch />)

    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
  })
})
