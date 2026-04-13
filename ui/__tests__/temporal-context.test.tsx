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
import { act, render, screen } from '@testing-library/react'
import React from 'react'

import { TemporalProvider, useTemporal } from '@/context/TemporalContext'

const replaceMock = jest.fn()
const paramsState = new URLSearchParams('')

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/things',
  useSearchParams: () => paramsState,
}))

function Consumer() {
  const temporal = useTemporal()
  return (
    <>
      <span data-testid="mode">{temporal.mode}</span>
      <button onClick={() => temporal.setAsOf('2024-02-01T10:30:00Z')}>setAsOf</button>
      <button onClick={() => temporal.reset()}>reset</button>
    </>
  )
}

describe('TemporalContext', () => {
  it('starts in current mode and supports as_of + reset', async () => {
    render(
      <TemporalProvider>
        <Consumer />
      </TemporalProvider>
    )

    expect(screen.getByTestId('mode')).toHaveTextContent('current')

    await act(async () => {
      screen.getByText('setAsOf').click()
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('as_of')

    await act(async () => {
      screen.getByText('reset').click()
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('current')
    expect(replaceMock).toHaveBeenCalled()
  })
})
