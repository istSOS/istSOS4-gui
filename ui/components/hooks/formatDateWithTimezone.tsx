import { DateTime } from "luxon";
import { format } from "path";

let globalTimeShiftHours = 0;
export function setGlobalTimeShift(h: number) {
  globalTimeShiftHours = h;
}
export function getGlobalTimeShift() {
  return globalTimeShiftHours;
}

function formatShiftLabel(h: number = 0) {
  if (h === 0) return "";
  const sign = h > 0 ? "+" : "-";""
  const abs = Math.abs(h);
  const whole = Math.trunc(abs);
  
  const minutes = Math.round((abs - whole) * 60);
  const mm = minutes.toString().padStart(2, "0");
  return `UTC ${sign}${whole}:${mm}`;
}

export function formatDateWithTimezone(
  dateInput: string | Date | null | undefined,
  timezone: string = "UTC",
  timeShiftHours?: number
): string {
  if (!dateInput) return "-";
  let dt: DateTime;
  if (typeof dateInput === "string") {
    dt = DateTime.fromISO(dateInput, { zone: "utc" });
    if (!dt.isValid) {
      dt = DateTime.fromRFC2822(dateInput, { zone: "utc" });
    }
    if (!dt.isValid) return dateInput; // fallback raw
  } else if (dateInput instanceof Date) {
    dt = DateTime.fromJSDate(dateInput, { zone: "utc" });
  } else {
    return "-";
  }
  

  const shift = timeShiftHours;
  const shifted = dt.plus({ hours: shift });

  const zoned = shifted.setZone(timezone || "UTC", { keepLocalTime: false });
  if (!zoned.isValid) return shifted.toISO() ?? "-";

  return zoned.toFormat("yyyy-MM-dd HH:mm:ss") + " " + formatShiftLabel(shift);
}