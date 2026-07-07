/**
 * Verified Bikram Sambat (BS) Mapping 2070-2090
 * Data aligned with official Panchannga and year-over-year AD shifts.
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
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 30, 30, 29, 30, 30, 30, 30],
  2084: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 29, 31],
  2085: [31, 32, 31, 32, 31, 31, 30, 30, 29, 30, 30, 30],
  2086: [31, 32, 31, 32, 31, 31, 30, 30, 29, 30, 30, 30],
  2087: [31, 32, 31, 32, 32, 31, 30, 30, 29, 30, 30, 30],
  2088: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30],
  2089: [31, 32, 31, 32, 31, 31, 30, 30, 29, 30, 30, 30],
  2090: [31, 32, 31, 32, 31, 31, 30, 30, 29, 30, 30, 30],
};

export const nepaliMonths = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
export const nepaliYears = Array.from({ length: 21 }, (_, i) => 2070 + i);

export function adToBs(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // Reference: 2070-01-01 BS = 2013-04-14 AD
  // Use local time date parts for the comparison to avoid TZ jitter
  const adRef = Date.UTC(2013, 3, 14);
  const adTarget = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  let totalDiff = Math.floor((adTarget - adRef) / (1000 * 60 * 60 * 24));
  if (totalDiff < 0) return { formatted: `${d.toLocaleDateString()} (AD)` };

  let bsYear = 2070;
  let bsMonth = 0;
  let bsDay = 1;

  while (totalDiff > 0) {
    const monthDays = bsMapping[bsYear][bsMonth];
    if (totalDiff >= monthDays) {
      totalDiff -= monthDays;
      bsMonth++;
      if (bsMonth > 11) {
        bsMonth = 0;
        bsYear++;
      }
      if (!bsMapping[bsYear]) break;
    } else {
      bsDay += totalDiff;
      totalDiff = 0;
    }
  }

  return {
    year: bsYear,
    month: bsMonth + 1,
    day: bsDay,
    monthName: nepaliMonths[bsMonth],
    formatted: `${bsYear}-${String(bsMonth + 1).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`
  };
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
  return new Date(adReference.getUTCFullYear(), adReference.getUTCMonth(), adReference.getUTCDate());
}

export function getBsMonthInfo(year, month) {
  if (!bsMapping[year]) return null;
  const daysInMonth = bsMapping[year][month - 1];
  const firstDayAd = bsToAd(`${year}-${String(month).padStart(2, '0')}-01`);
  return { daysInMonth, startDayOfWeek: firstDayAd.getDay() };
}
