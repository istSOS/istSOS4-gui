import {
  AggregationError,
  aggregationBody,
  aggregationContext,
  aggregationDatastreams,
  aggregationFailure,
  aggregationUpstream,
} from '@/server/aggregations'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const context = await aggregationContext(request, params.get('sourceId'))
    const data = await aggregationUpstream(context, 'AggregationJobs')
    if (!Array.isArray(data.value)) throw new AggregationError('response', 502)
    return Response.json({
      jobs: data.value,
      ...(params.get('catalog') === '1'
        ? { datastreams: await aggregationDatastreams(context) }
        : {}),
    })
  } catch (error) {
    return aggregationFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await aggregationBody(request)
    const context = await aggregationContext(request, body.sourceId)
    if (!body.job || typeof body.job !== 'object' || Array.isArray(body.job))
      throw new AggregationError('request', 400)
    const job = await aggregationUpstream(
      context,
      'AggregationJobs',
      'POST',
      body.job
    )
    return Response.json({ job }, { status: 201 })
  } catch (error) {
    return aggregationFailure(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await aggregationBody(request)
    if (
      !Number.isSafeInteger(body.id) ||
      Number(body.id) < 1 ||
      typeof body.enabled !== 'boolean'
    )
      throw new AggregationError('request', 400)
    const context = await aggregationContext(request, body.sourceId)
    const job = await aggregationUpstream(
      context,
      `AggregationJobs(${body.id})`,
      'PATCH',
      { enabled: body.enabled }
    )
    return Response.json({ job })
  } catch (error) {
    return aggregationFailure(error)
  }
}
