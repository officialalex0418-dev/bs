import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const formatMoney = (n, currency = 'NPR') =>
  `${currency} ${Number(n || 0).toLocaleString()}`;

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
export const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
export const formatDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

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
  COMPANY_MANAGER: '/company',
  STAFF: '/staff',
};
