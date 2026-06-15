export const todayStr = (d = new Date()) => d.toISOString().slice(0, 10); // YYYY-MM-DD
export const monthStr = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM

export function rangeFromPeriod(period) {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case 'daily': start.setHours(0, 0, 0, 0); break;
    case 'weekly': start.setDate(now.getDate() - 7); break;
    case 'monthly': start.setMonth(now.getMonth() - 1); break;
    case '3months': start.setMonth(now.getMonth() - 3); break;
    case '6months': start.setMonth(now.getMonth() - 6); break;
    default: start.setHours(0, 0, 0, 0);
  }
  return { start, end: now };
}
