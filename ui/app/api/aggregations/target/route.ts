import {
  aggregationTargetTemplate,
  createAggregationTarget,
} from '@/server/aggregationTarget'
import {
  aggregationBody,
  aggregationContext,
  aggregationFailure,
  aggregationUpstream,
} from '@/server/aggregations'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const context = await aggregationContext(request, params.get('sourceId'))
    await aggregationUpstream(context, 'AggregationJobs')
    return Response.json({
      template: await aggregationTargetTemplate(
        context,
        params.get('datastreamId')
      ),
    })
  } catch (error) {
    return aggregationFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await aggregationBody(request)
    const context = await aggregationContext(request, body.sourceId)
    // Datastream creation itself may allow editors. Authenticate via the
    // administrator-only jobs endpoint before performing this workflow.
    await aggregationUpstream(context, 'AggregationJobs')
    return Response.json(
      { datastream: await createAggregationTarget(context, body.target) },
      { status: 201 }
    )
  } catch (error) {
    return aggregationFailure(error)
  }
}
