import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarOff, Target, Clock as ClockIcon, MapPin, AlertTriangle, MessageSquare, Mail, Phone, Building2 } from 'lucide-react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { Card, CardHeader, CardBody, Spinner, Badge, Button } from '@/components/ui';
import { formatMoney, formatTime } from '@/lib/utils';
import { t } from '@/lib/i18n';
import LiveClock from '@/components/Clock';

function ProgressRing({ value, color, label, sub }) {
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={140} height={140}>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" fill={color} cornerRadius={8} background={{ fill: '#e2e8f0' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <p className="-mt-[88px] text-2xl font-bold">{value}%</p>
      <p className="mt-[52px] text-sm font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { status: trackingStatus, intervalMinutes, lastPing } = useLocationTracker(true);
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const language = user?.company?.settings?.language || 'English';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/staff');
      setData(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
      <p className="text-slate-500 mb-6">{error}</p>
      <Button onClick={load}>Try Again</Button>
    </div>
  );

  if (!data) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-8 text-white">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/20 bg-white/10 shadow-xl">
              {data.profile.profilePhoto
                ? <img src={data.profile.profilePhoto} alt="" className="h-full w-full object-cover" />
                : <span className="text-4xl font-bold">{data.profile.name?.[0]}</span>}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{data.profile.name}</h1>
              <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-primary-50">
                {data.profile.position} · {data.profile.department}
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-sm text-primary-100">
                <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {data.profile.company}</span>
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {data.profile.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {data.profile.phone || '—'}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-1 justify-center sm:mt-0 sm:justify-end">
              <LiveClock />
            </div>
          </div>
        </div>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-b border-slate-100 dark:border-slate-800">
          <div className="text-center">
            <Badge color={data.checkInStatus ? 'green' : 'gray'}>
              {data.checkInStatus ? `In ${formatTime(data.checkInTime)}` : 'Not checked in'}
            </Badge>
            <p className="mt-1 text-xs text-slate-400">Check-In</p>
          </div>
          <div className="text-center">
            <Badge color={data.checkOutStatus ? 'blue' : 'gray'}>
              {data.checkOutStatus ? `Out ${formatTime(data.checkOutTime)}` : 'Not yet'}
            </Badge>
            <p className="mt-1 text-xs text-slate-400">Check-Out</p>
          </div>
          <div className="text-center">
            <p className="font-bold">{data.leaveBalance?.paid ?? 0} / {data.leaveBalance?.sick ?? 0}</p>
            <p className="text-xs text-slate-400">Paid / Sick leave</p>
          </div>
          <div className="text-center">
            <p className={`font-bold ${data.lateDays > 3 ? 'text-red-500' : ''}`}>{data.lateDays}</p>
            <p className="text-xs text-slate-400">Late days</p>
          </div>
        </CardBody>
      </Card>

      {/* Tracking status */}
      <Card className="p-4">
        <div className="flex items-center gap-3 text-sm">
          {trackingStatus === 'active' ? (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium">{t('Location tracking active', language)}</p>
                <p className="text-xs text-slate-400">
                  Pinging every {intervalMinutes} min{lastPing ? ` · last ping ${formatTime(lastPing)}` : ''}
                </p>
              </div>
            </>
          ) : trackingStatus === 'denied' ? (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <p className="font-medium">Location permission denied — enable it in browser settings.</p>
            </>
          ) : (
            <p className="text-slate-400">Location tracking inactive (not in your company package or initializing…)</p>
          )}
        </div>
      </Card>

      {/* Targets */}
      <Card>
        <CardHeader title={t('Monthly Performance', language)} />
        <CardBody>
          <div className="flex flex-wrap items-center justify-around gap-6">
            <ProgressRing value={data.salesProgressPct} color="#2563eb" label={t('Sales Progress', language)}
              sub={`${formatMoney(data.achievedTarget)} / ${formatMoney(data.monthlyTarget)}`} />
            <ProgressRing value={data.attendanceProgressPct} color="#059669" label={t('Attendance', language)}
              sub={`${data.presentDays} days present`} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-bold">{formatMoney(data.monthlyTarget)}</p>
              <p className="text-xs text-slate-400">Target</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-bold text-emerald-600">{formatMoney(data.achievedTarget)}</p>
              <p className="text-xs text-slate-400">Achieved</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-bold text-orange-500">{formatMoney(data.remainingTarget)}</p>
              <p className="text-xs text-slate-400">Remaining</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button className="h-14" onClick={() => navigate('/staff/attendance')}>
          <ClockIcon className="h-5 w-5" /> {data.checkInStatus ? (data.checkOutStatus ? t('Attendance', language) : t('Check Out', language)) : t('Check In', language)}
        </Button>
        <Button variant="outline" className="h-14" onClick={() => navigate('/staff/leaves')}>
          <CalendarOff className="h-5 w-5" /> {t('Apply Leave', language)}
        </Button>
      </div>
    </div>
  );
}
