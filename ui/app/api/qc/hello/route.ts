import { NextResponse } from 'next/server'

import { getQcAccess, getSaqcServiceUrl } from '@/server/qc'

export async function GET() {
  const access = await getQcAccess()
  if (access !== 200) {
    return NextResponse.json({ ok: false }, { status: access })
  }

  try {
    const response = await fetch(`${getSaqcServiceUrl()}/hello`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('SaQC service unavailable')

    const body = await response.json()
    if (typeof body?.message !== 'string') {
      throw new Error('Invalid SaQC response')
    }

    return NextResponse.json({ message: body.message })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
