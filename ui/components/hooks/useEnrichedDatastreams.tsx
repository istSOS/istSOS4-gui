import { useState, useEffect } from "react";
import { fetchData } from "../../server/api";
import { siteConfig } from "../../config/site";

function getTimeAgo(isoDate: string | null) {
  if (!isoDate) return "-";
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "less than a minute ago";
  if (diffMin < 60) return `${diffMin} miutes ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hours ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} days ago`;
}

function getPhenomenonTimeRange(ds: any) {
  const pt = ds.phenomenonTime;
  if (!pt) return { start: null, end: null };
  if (pt.includes("/")) {
    const [start, end] = pt.split("/");
    return { start, end };
  }
  return { start: pt, end: pt };
}

async function fetchLastObservation(datastreamId: number, token: string) {
  const url = `${siteConfig.items.find(i => i.label === "Datastreams")?.root}(${datastreamId})/Observations?$orderby=phenomenonTime desc&$top=1`;
  const data = await fetchData(url, token);
  if (data?.value && data.value.length > 0) {
    const obs = data.value[0];
    return {
      lastValue: obs.result,
      lastMeasurement: obs.phenomenonTime,
    };
  }
  return {
    lastValue: null,
    lastMeasurement: null,
  };
}

export function useEnrichedDatastreams(rawDatastreams: any[], token: string) {
  const [enriched, setEnriched] = useState<any[]>([]);
  useEffect(() => {
    if (!rawDatastreams || !token) {
      setEnriched([]);
      return;
    }
    async function enrich() {
      const arr = await Promise.all(
        rawDatastreams.map(async ds => {
          const lastObs = await fetchLastObservation(ds["@iot.id"], token);
          const { start, end } = getPhenomenonTimeRange(ds);
          return {
            ...ds,
            lastValue: lastObs.lastValue,
            lastMeasurement: lastObs.lastMeasurement,
            timeAgo: getTimeAgo(lastObs.lastMeasurement),
            startDate: start,
            endDate: end,
          };
        })
      );
      setEnriched(arr);
    }
    enrich();
  }, [rawDatastreams, token]);
  return enriched;
}