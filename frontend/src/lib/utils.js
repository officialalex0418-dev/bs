import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { adToBs } from './nepaliDate';

export const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * AD to BS Conversion
 */
export const toNepaliDate = (date) => {
  if (!date) return '—';
  if (typeof date === 'string' && date.length === 7) {
     // Handle YYYY-MM
     const [y, m] = date.split('-').map(Number);
     const bs = adToBs(new Date(y, m-1, 1));
     return bs ? `${bs.monthName} ${bs.year}` : date;
  }
  const bs = adToBs(date);
  return bs ? bs.formatted : '—';
};

export const toNepaliMonth = (dateStr) => {
  if (!dateStr || dateStr.length !== 7) return dateStr;
  const [y, m] = dateStr.split('-').map(Number);
  // We assume the input string is already a BS YYYY-MM if it's coming from BS format logic
  // But usually summary.month is AD YYYY-MM from backend.
  const bs = adToBs(new Date(y, m - 1, 1));
  return bs ? `${bs.monthName} ${bs.year}` : dateStr;
};

/**
 * Returns YYYY-MM-DD reliably for Asia/Kathmandu
 */
export const todayStr = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

export const formatMoney = (n, currency = 'NPR') =>
  `${currency} ${Number(n || 0).toLocaleString()}`;

export const formatDate = (d, format = 'AD') => {
  if (!d) return '—';
  if (format === 'BS') return toNepaliDate(d);
  const date = new Date(d);
  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kathmandu'
  });
};

/**
 * Returns a local date string (YYYY-MM-DD) for a given date,
 * respecting the Asia/Kathmandu timezone to prevent day-shifts.
 */
export const toLocalDateString = (d) => {
  if (!d) return '';
  const date = new Date(d);
  // Using Intl.DateTimeFormat to reliably get components in Nepal timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const getPart = (type) => parts.find(p => p.type === type).value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

export const formatTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kathmandu'
  });
};

export const formatDateTime = (d, format = 'AD') => {
  if (!d) return '—';
  const date = formatDate(d, format);
  const time = formatTime(d);
  return `${date} ${time}`;
};

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_EMPLOYEE: 'Admin Employee',
  COMPANY_OWNER: 'Company Owner',
  COMPANY_MANAGER: 'Company Manager',
  STAFF: 'Staff',
};

export const ROLE_HOME = {
  SUPER_ADMIN: '/admin',
  ADMIN_EMPLOYEE: '/admin',
  COMPANY_OWNER: '/company',
  COMPANY_MANAGER: '/staff',
  STAFF: '/staff',
};
