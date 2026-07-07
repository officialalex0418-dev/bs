/**
 * ShadCN-style primitive components (Card, Button, Input, Badge, Modal, Table, etc.)
 * Self-contained — no external UI dependency beyond Tailwind + lucide icons.
 */
import { useEffect, useState, useRef } from 'react';
import { X, Loader2, Calendar, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { bsToAd, adToBs, nepaliMonths, nepaliYears, getBsMonthInfo } from '@/lib/nepaliDate';

export const Card = ({ className, children, ...props }) => (
  <div className={cn('card', className)} {...props}>{children}</div>
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

export const Input = ({ label, error, className, ...props }) => {
  const [show, setShow] = useState(false);
  const isPassword = props.type === 'password';
  const type = isPassword ? (show ? 'text' : 'password') : props.type;

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
      <div className="relative">
        <input
          {...props}
          type={type}
          className={cn('input', isPassword && 'pr-10', error && 'border-red-500', className)}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
};

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

export const DatePicker = ({ label, value, onChange, className, ...props }) => {
  const { user } = useAuth();
  const format = user?.company?.settings?.dateFormat || 'BS';
  const [show, setShow] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const fn = (e) => containerRef.current && !containerRef.current.contains(e.target) && setShow(false);
    if (show) document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [show]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (format === 'BS') {
      try {
        const ad = bsToAd(val);
        onChange(ad.toISOString().split('T')[0]);
      } catch (e) {
        onChange(val);
      }
    } else {
      onChange(val);
    }
  };

  const displayValue = format === 'BS' ? (adToBs(value)?.formatted || '') : (value || '');

  return (
    <div className="relative" ref={containerRef}>
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
        <div className="relative">
          <input
            type={format === 'BS' ? 'text' : 'date'}
            placeholder={format === 'BS' ? 'YYYY-MM-DD (BS)' : ''}
            className={cn('input pr-10', className)}
            value={displayValue}
            onChange={handleChange}
            {...props}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500"
            onClick={() => setShow(!show)}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </label>

      {format === 'BS' && show && (
        <div className="absolute left-0 z-[100] mt-2 origin-top-left rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 w-72 animate-in fade-in zoom-in duration-150">
          <BSCalendarInternal value={value} onSelect={(val) => { onChange(val); setShow(false); }} />
        </div>
      )}
    </div>
  );
};

const BSCalendarInternal = ({ value, onSelect }) => {
  const [view, setView] = useState(() => {
    const d = adToBs(value || new Date());
    return { year: d.year, month: d.month };
  });

  const info = getBsMonthInfo(view.year, view.month);
  if (!info) return <div className="text-xs text-red-500">Calendar Error</div>;

  const days = [];
  for (let i = 0; i < info.startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= info.daysInMonth; i++) days.push(i);

  const nav = (dir) => {
    let { year, month } = view;
    month += dir;
    if (month > 12) { month = 1; year++; }
    if (month < 1) { month = 12; year--; }
    if (nepaliYears.includes(year)) setView({ year, month });
  };

  const selectedBs = adToBs(value)?.formatted;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => nav(-1)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-2 font-bold text-slate-900 dark:text-white">
          <select
            className="bg-transparent outline-none cursor-pointer"
            value={view.month}
            onChange={(e) => setView({ ...view, month: Number(e.target.value) })}
          >
            {nepaliMonths.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="bg-transparent outline-none cursor-pointer"
            value={view.year}
            onChange={(e) => setView({ ...view, year: Number(e.target.value) })}
          >
            {nepaliYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => nav(1)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{d}</div>
        ))}
        {days.map((day, i) => {
          const currentBs = day ? `${view.year}-${String(view.month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const isSelected = day && selectedBs === currentBs;
          return (
            <button
              key={i}
              type="button"
              disabled={!day}
              onClick={() => {
                const ad = bsToAd(currentBs);
                onSelect(ad.toISOString().split('T')[0]);
              }}
              className={cn(
                "h-8 w-8 rounded-lg text-sm font-medium transition-all",
                !day ? "invisible" : "hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:text-slate-300",
                isSelected ? "bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-none" : "text-slate-600 dark:text-slate-400"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const MonthPicker = ({ label, value, onChange, className }) => {
  const { user } = useAuth();
  const format = user?.company?.settings?.dateFormat || 'BS';

  if (format !== 'BS') {
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
        <input type="month" className={cn('input', className)} value={value} onChange={e => onChange(e.target.value)} />
      </label>
    );
  }

  // Handle BS Month Picker (Simplified: two selects)
  const [y, m] = (value && value.includes('-')) ? value.split('-') : [2081, '01'];

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
      <div className="flex gap-2">
        <select className="input flex-1" value={y} onChange={e => onChange(`${e.target.value}-${m}`)}>
          {nepaliYears.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
        <select className="input flex-1" value={m} onChange={e => onChange(`${y}-${e.target.value}`)}>
          {nepaliMonths.map((name, idx) => (
            <option key={idx} value={String(idx+1).padStart(2, '0')}>{name}</option>
          ))}
        </select>
      </div>
    </label>
  );
};

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 print:static print:bg-transparent" onClick={onClose} role="dialog">
      <div
        className={cn(
          'card flex max-h-[95vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-xl print:max-h-none print:overflow-visible print:shadow-none print:border-none',
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

export const Checkbox = ({ label, checked, onChange, className }) => (
  <label className={cn('flex cursor-pointer items-center gap-2', className)}>
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      checked={checked}
      onChange={onChange}
    />
    {label && <span className="text-sm font-medium">{label}</span>}
  </label>
);
