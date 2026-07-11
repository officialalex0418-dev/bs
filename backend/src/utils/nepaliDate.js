/**
 * Bikram Sambat (BS) Logic for Backend (Synced with Frontend)
 */
export const bsMapping = {
  2070: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2082: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
};

export function adToBs(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // Use Intl.DateTimeFormat to reliably get the date in Nepal timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(d);

  const getPart = (type) => parseInt(parts.find(p => p.type === type).value);
  const adTarget = Date.UTC(getPart('year'), getPart('month') - 1, getPart('day'));

  // BASE REFERENCE: 2070-01-01 BS = 2013-04-14 AD
  const adRef = Date.UTC(2013, 3, 14);

  let totalDiff = Math.floor((adTarget - adRef) / (1000 * 60 * 60 * 24));
  if (totalDiff < 0) return null;

  let bsYear = 2070;
  let bsMonth = 0;
  let bsDay = 1;

  while (totalDiff > 0) {
    if (!bsMapping[bsYear]) break;
    const monthDays = bsMapping[bsYear][bsMonth];
    if (totalDiff >= monthDays) {
      totalDiff -= monthDays;
      bsMonth++;
      if (bsMonth > 11) { bsMonth = 0; bsYear++; }
    } else {
      bsDay += totalDiff;
      totalDiff = 0;
    }
  }
  return { year: bsYear, month: bsMonth + 1, day: bsDay };
}

export function bsToAd(bsDateStr) {
  const [year, month, day] = bsDateStr.split('-').map(Number);
  if (!bsMapping[year]) return new Date();

  let totalDays = 0;
  for (let y = 2070; y < year; y++) {
    totalDays += bsMapping[y].reduce((a, b) => a + b, 0);
  }
  for (let m = 0; m < month - 1; m++) {
    totalDays += bsMapping[year][m];
  }
  totalDays += day - 1;

  const adReference = new Date(Date.UTC(2013, 3, 14));
  adReference.setUTCDate(adReference.getUTCDate() + totalDays);
  return adReference;
}

export function getBsMonthRange(bsMonthStr) {
  const [y, m] = bsMonthStr.split('-').map(Number);
  const start = bsToAd(`${y}-${m}-01`);
  const days = bsMapping[y][m-1];
  const end = bsToAd(`${y}-${m}-${days}`);
  // Set times
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}
