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

import TemporalBadge from '@/components/TemporalBadge'

const resetMock = jest.fn()

const temporalMock = {
  mode: 'current',
  asOf: null,
  fromTo: null,
  reset: resetMock,
}

jest.mock('@/context/TemporalContext', () => ({
  useTemporal: () => temporalMock,
}))

describe('TemporalBadge', () => {
  it('renders live badge for current mode', () => {
    temporalMock.mode = 'current'
    render(<TemporalBadge />)
    expect(screen.getByText(/Live/i)).toBeInTheDocument()
  })

  it('renders as-of badge text', () => {
    temporalMock.mode = 'as_of'
    temporalMock.asOf = '2024-02-01T10:30:00Z'
    render(<TemporalBadge />)
    expect(screen.getByTestId('temporal-badge-as-of')).toBeInTheDocument()
  })

  it('renders from-to badge text', () => {
    temporalMock.mode = 'from_to'
    temporalMock.fromTo = ['2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z']
    render(<TemporalBadge />)
    expect(screen.getByTestId('temporal-badge-from-to')).toBeInTheDocument()
  })
})
