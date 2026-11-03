import AggregationsPage from '@/features/aggregations/components/AggregationsPage'

import { getAggregationSources } from '@/server/aggregations'

export default async function Page() {
  return <AggregationsPage sources={await getAggregationSources()} />
}
