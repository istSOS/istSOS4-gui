import { DateTime } from "luxon";
import { getGlobalTimeShift } from "./formatDateWithTimezone";


export function getLastDelayColor(
  entity: any,
  delayThreshold: number | null,
  timezone: string
): "success" | "warning" | "danger" | "default" {
  if (!entity?.lastMeasurement) return "default";
  if (delayThreshold == null) return "default";
  try {
    const shift = getGlobalTimeShift();
    const last = DateTime.fromISO(entity.lastMeasurement).setZone(timezone).plus({ hours: shift });
    if (!last.isValid) return "default";
    const nowShifted = DateTime.now().setZone(timezone).plus({ hours: shift });
    const diffMinutes = nowShifted.diff(last, "minutes").minutes;
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