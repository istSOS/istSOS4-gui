import { NextResponse } from 'next/server'

import { qcContext, qcFailure, runQcPreview } from '@/server/qcData'

export async function POST(request: Request) {
  try {
    const { source, headers, body } = await qcContext(request)
    return NextResponse.json(await runQcPreview(source, headers, body))
  } catch (error) {
    return qcFailure(error)
  }
}
