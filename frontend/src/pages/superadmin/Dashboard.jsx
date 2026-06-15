import { useEffect, useState, useCallback } from 'react';
import { Building2, Users, UserCheck, CalendarCheck, Wallet, Package, MapPin, PlusCircle } from 'lucide-react';
import { api } from '@/api/client';
import { useSocketEvent } from '@/context/SocketContext';
import { StatCard, Card, CardHeader, CardBody, Spinner, Badge } from '@/components/ui';
import { formatMoney, formatDateTime } from '@/lib/utils';

export default function SuperDashboard() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get('/dashboard/super');
    setData(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocketEvent('dashboard:update', useCallback(() => load(), [load]));

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={Building2} label="Total Companies" value={data.totalCompanies} sub={`+${data.companiesToday} today`} color="blue" />
        <StatCard icon={Users} label="Total Staff" value={data.totalStaff} color="purple" />
        <StatCard icon={UserCheck} label="Active Staff" value={data.activeStaff} color="green" />
        <StatCard icon={CalendarCheck} label="Checked-In Today" value={data.checkedInToday} color="orange" />
        <StatCard icon={Wallet} label="Monthly Revenue (est.)" value={formatMoney(data.monthlyRevenue)} color="green" />
        <StatCard icon={Package} label="Active Packages" value={data.activePackages} color="blue" />
        <StatCard icon={MapPin} label="Tracking Pings Today" value={data.trackingPingsToday} color="purple" />
        <StatCard icon={PlusCircle} label="Companies Added Today" value={data.companiesToday} color="orange" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Active Packages" subtitle="Plans currently offered" />
          <CardBody className="space-y-3">
            {data.packages.map((p) => (
              <div key={p._id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    Max {p.maxStaff} staff · ping every {p.trackingIntervalMinutes} min
                  </p>
                </div>
                <Badge color="green">{formatMoney(p.price)}/mo</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent Activities" subtitle="Live platform audit feed" />
          <CardBody className="max-h-96 space-y-3 overflow-y-auto">
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
