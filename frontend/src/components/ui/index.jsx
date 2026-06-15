/**
 * ShadCN-style primitive components (Card, Button, Input, Badge, Modal, Table, etc.)
 * Self-contained — no external UI dependency beyond Tailwind + lucide icons.
 */
import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Card = ({ className, children }) => (
  <div className={cn('card', className)}>{children}</div>
);

export const CardHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardBody = ({ className, children }) => (
  <div className={cn('p-5', className)}>{children}</div>
);

export const Button = ({ variant = 'primary', size = 'md', loading, className, children, ...props }) => {
  const variants = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    danger: 'btn-danger',
    ghost: 'btn hover:bg-slate-100 dark:hover:bg-slate-800',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button className={cn(variants[variant], sizes[size], className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

export const Input = ({ label, error, className, ...props }) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
    <input className={cn('input', error && 'border-red-500', className)} {...props} />
    {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
  </label>
);

export const Select = ({ label, options = [], className, ...props }) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
    <select className={cn('input', className)} {...props}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

export const Textarea = ({ label, className, ...props }) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
    <textarea className={cn('input min-h-[80px]', className)} {...props} />
  </label>
);

export const Badge = ({ color = 'blue', children }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return <span className={cn('badge', colors[color])}>{children}</span>;
};

export const Modal = ({ open, onClose, title, children, wide }) => {
  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose();
    if (open) {
      window.addEventListener('keydown', fn);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', fn);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={cn(
          'card flex max-h-[95vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-xl',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export const Table = ({ columns, data, empty = 'No records found', renderRow, mobileRender }) => (
  <div className="overflow-x-auto">
    <table className="hidden w-full sm:table">
      <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
        <tr>{columns.map((c) => <th key={c} className="table-th">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.length === 0 ? (
          <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-400">{empty}</td></tr>
        ) : data.map(renderRow)}
      </tbody>
    </table>
    <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
      {data.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-400">{empty}</div>
      ) : (
        data.map((item, idx) => (mobileRender ? mobileRender(item, idx) : renderRow(item, idx)))
      )}
    </div>
  </div>
);

export const StatCard = ({ icon: Icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    purple: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className={cn('rounded-xl p-3', colors[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </Card>
  );
};

export const Spinner = ({ className }) => (
  <div className="flex items-center justify-center p-10">
    <Loader2 className={cn('h-8 w-8 animate-spin text-primary-600', className)} />
  </div>
);

export const Pagination = ({ pagination, onPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-5 py-3 text-sm sm:flex-row">
      <span className="text-slate-500">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
      </span>
      <div className="flex w-full gap-2 sm:w-auto">
        <Button variant="outline" className="flex-1 sm:flex-none" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Prev</Button>
        <Button variant="outline" className="flex-1 sm:flex-none" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</Button>
      </div>
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <Icon className="mb-3 h-10 w-10 text-slate-300" />}
    <p className="font-medium text-slate-600 dark:text-slate-300">{title}</p>
    {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
  </div>
);
