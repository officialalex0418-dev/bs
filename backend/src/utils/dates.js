/**
 * Corrected date string utilities for Nepal (+5:45)
 */
export const todayStr = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d); // Returns YYYY-MM-DD reliably
};

export const monthStr = (d = new Date()) => {
  return todayStr(d).slice(0, 7); // Returns YYYY-MM
};

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
