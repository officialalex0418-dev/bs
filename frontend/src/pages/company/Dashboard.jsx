import { useEffect, useState, useCallback } from 'react';
import { Users, UserCheck, CalendarCheck, TrendingUp, Wallet, CalendarOff, Building2, MapPin, Mail, Package, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '@/api/client';
import { useSocketEvent } from '@/context/SocketContext';
import { StatCard, Card, CardHeader, CardBody, Spinner, Badge } from '@/components/ui';
import { formatMoney, formatDateTime } from '@/lib/utils';

export default function CompanyDashboard() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get('/dashboard/company');
    setData(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:update', useCallback(() => load(), [load]));

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Company Overview Header */}
      <Card className="overflow-hidden border-none bg-slate-900 text-white shadow-xl dark:bg-slate-900/50">
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm">
            {data.company?.logo ? (
              <img src={data.company.logo} alt={data.company.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-12 w-12 text-primary-400" />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <h1 className="text-3xl font-bold tracking-tight">{data.company?.name}</h1>
              <Badge color={data.company?.status === 'ACTIVE' ? 'green' : 'yellow'}>{data.company?.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <MapPin className="h-4 w-4 shrink-0" /> {data.company?.address || 'No address set'}
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Mail className="h-4 w-4 shrink-0" /> {data.company?.email}
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Package className="h-4 w-4 shrink-0" /> Plan: <span className="font-semibold text-primary-400">{data.company?.package?.name || 'Standard'}</span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:justify-start text-xs opacity-80">
                <ShieldCheck className="h-3.5 w-3.5" /> Reg: {data.company?.panVat || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total Staff" value={data.totalStaff} color="blue" />
        <StatCard icon={UserCheck} label="Active Staff" value={data.activeStaff} color="green" />
        <StatCard icon={CalendarCheck} label="Checked-In Today" value={data.checkedInToday} color="purple" />
        <StatCard icon={CalendarCheck} label="Monthly Attendance" value={data.monthlyAttendance} sub="present entries this month" color="orange" />
        <StatCard icon={TrendingUp} label="Daily Sales" value={formatMoney(data.dailySales)} color="green" />
        <StatCard icon={Wallet} label="Monthly Sales" value={formatMoney(data.monthlySales)} color="blue" />
      </div>

      {data.pendingLeaves > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <CalendarOff className="h-4 w-4" /> {data.pendingLeaves} pending leave request{data.pendingLeaves > 1 ? 's' : ''} awaiting your review.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sales — Last 6 Months" />
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.salesGraph}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent Activities" />
          <CardBody className="max-h-96 space-y-3 overflow-y-auto">
            {data.recentActivities.length === 0 && <p className="text-sm text-slate-400">No recent activity</p>}
            {data.recentActivities.map((a) => (
              <div key={a._id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                <div>
                  <p>
                    <span className="font-medium">{a.user?.name || 'System'}</span>{' '}
                    <span className="text-slate-500">{a.action.replaceAll('_', ' ').toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
