import { DateTime } from "luxon";


export function getLastDelayColor(
  entity: any,
  delayThreshold: number | null,
  timezone: string
): "success" | "warning" | "danger" | "default" {
  if (!entity?.lastMeasurement) return "default";
  if (delayThreshold == null) return "default";
  try {
    const last = DateTime.fromISO(entity.lastMeasurement).setZone(timezone);
    if (!last.isValid) return "default";
    const diffMinutes = DateTime.now().setZone(timezone).diff(last, "minutes").minutes;
    if (diffMinutes <= delayThreshold) return "success";
    if (diffMinutes <= delayThreshold * 2) return "warning";
    return "danger";
  } catch {
    return "default";
  }
}


export function createLastDelayColorStrategy(
  delayThreshold: number | null,
  timezone: string
) {
  return (entity: any) => getLastDelayColor(entity, delayThreshold, timezone);
}