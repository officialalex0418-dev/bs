import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { adToBs } from './nepaliDate';

export const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * AD to BS Conversion
 */
export const toNepaliDate = (date) => {
  if (typeof date === 'string' && date.length === 7) {
     // Handle YYYY-MM
     const [y, m] = date.split('-').map(Number);
     const bs = adToBs(new Date(y, m-1, 1));
     return bs ? `${bs.monthName} ${bs.year}` : date;
  }
  const bs = adToBs(date);
  return bs ? bs.formatted : '—';
};

export const formatMoney = (n, currency = 'NPR') =>
  `${currency} ${Number(n || 0).toLocaleString()}`;

export const formatDate = (d, format = 'AD') => {
  if (!d) return '—';
  if (format === 'BS') return toNepaliDate(d);
  return new Date(d).toLocaleDateString();
};

export const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const formatDateTime = (d, format = 'AD') => {
  if (!d) return '—';
  const time = formatTime(d);
  const date = formatDate(d, format);
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
