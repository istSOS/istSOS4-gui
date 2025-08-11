import { DateTime } from "luxon";

/**
 * format a date string ISO with timezone
 * @param dateStr ISO string (es: "2023-10-01T12:00:00Z")
 * @param timezone timezone IANA string (es: "Europe/Rome")
 * @returns formatted string (es: "2023-10-01 14:00:00 Europe/Rome")
 */
export function formatDateWithTimezone(dateStr: string, timezone: string): string {
  if (!dateStr) return "-";
  try {
    return (
      DateTime.fromISO(dateStr, { zone: "utc" })
        .setZone(timezone)
        .toFormat("yyyy-MM-dd HH:mm:ss") +
      " " +
      timezone
    );
  } catch {
    return dateStr;
  }
}