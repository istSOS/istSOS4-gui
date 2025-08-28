export function getTimeAgoDays(timeAgo: string) {
  if (!timeAgo) return null;
  if (timeAgo.includes("minute")) return 0;
  if (timeAgo.includes("hour")) return 0;
  const match = timeAgo.match(/(\d+)\s*days?/);
  if (match) return parseInt(match[1], 10);
  return null;
}

export function getColorScale(items: any[], entity: any) {
  const daysArr = items
    .map(e => getTimeAgoDays(e.timeAgo))
    .filter(d => d !== null);
  if (daysArr.length === 0) return "default";
  const min = Math.min(...daysArr);
  const max = Math.max(...daysArr);
  const val = getTimeAgoDays(entity.timeAgo);
  if (val === null) return "default";
  const norm = (val - min) / (max - min || 1);
  if (norm <= 0.33) return "success";
  if (norm <= 0.66) return "warning";
  return "danger";
}