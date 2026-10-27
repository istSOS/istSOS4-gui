import { NextResponse } from 'next/server'

import {
  loadQcData,
  qcContext,
  qcDatastreamsWithConstraints,
  qcFailure,
  readQcCollection,
} from '@/server/qcData'

export async function POST(request: Request) {
  try {
    const { source, headers, body } = await qcContext(request)
    if (!body.datastreamId) {
      const rows = await readQcCollection(
        source,
        headers,
        'Datastreams?$expand=Thing&$top=1000',
        20000
      )
      return NextResponse.json({
        datastreams: qcDatastreamsWithConstraints(rows),
      })
    }
    return NextResponse.json(await loadQcData(source, headers, body))
  } catch (error) {
    return qcFailure(error)
  }
}
