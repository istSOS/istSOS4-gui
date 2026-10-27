import { NextResponse } from 'next/server'

import { readDataSourcesConfigFile } from '@/server/data-sources/config'
import { getQcAccess } from '@/server/qc'
import { qcFailure } from '@/server/qcData'

export async function GET() {
  const access = await getQcAccess()
  if (access !== 200)
    return NextResponse.json(
      { error: 'Editing access is required' },
      { status: access }
    )
  try {
    const sources = await readDataSourcesConfigFile()
    return NextResponse.json({
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        endpoint: source.apiRoot,
        authorizationEnabled: source.authorizationEnabled,
      })),
    })
  } catch (error) {
    return qcFailure(error)
  }
}
