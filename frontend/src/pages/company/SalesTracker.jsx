import { useEffect, useState, useCallback } from 'react';
import { FileDown, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api, downloadFile } from '@/api/client';
import { Card, CardHeader, CardBody, Button, Select, Table, Spinner, Pagination, StatCard, EmptyState } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
const PERIODS = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
];

export default function SalesTracker() {
  const [analytics, setAnalytics] = useState(null);
  const [sales, setSales] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [page, setPage] = useState(1);
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        api.get('/sales/analytics', { params: { period } }),
        api.get('/sales', { params: { period, page } }),
      ]);
      setAnalytics(a.data.data);
      setSales(s.data.data);
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
    }
  }, [period, page]);

  useEffect(() => { load(); }, [load]);

  if (featureBlocked) {
    return <Card><EmptyState icon={TrendingUp} title="Sales tracking not included in your package"
      subtitle="Upgrade your package to unlock the sales tracker." /></Card>;
  }
  if (!analytics || !sales) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sales Tracker</h1>
        <div className="flex gap-2">
          <Select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} options={PERIODS} className="w-44" />
          <Button variant="outline" onClick={() => downloadFile(`/reports/sales/excel?period=${period}`, `sales-${period}.xlsx`)}>
            <FileDown className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={TrendingUp} label="Total Sales" value={formatMoney(analytics.total)} color="green" />
        <StatCard icon={TrendingUp} label="Transactions" value={analytics.count} color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Staff-wise Sales" />
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.byStaff}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Product-wise Sales" />
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={analytics.byProduct.slice(0, 6)} dataKey="total" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {analytics.byProduct.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Monthly Growth" />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Sales Entries" />
        <Table
          columns={['Date', 'Staff', 'Product', 'Qty', 'Amount', 'Customer', 'Remarks']}
          data={sales.items}
          renderRow={(s) => (
            <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td">{formatDate(s.saleDate)}</td>
              <td className="table-td font-medium">{s.staff?.name}</td>
              <td className="table-td">{s.productName}</td>
              <td className="table-td">{s.quantity}</td>
              <td className="table-td font-semibold">{formatMoney(s.amount)}</td>
              <td className="table-td">{s.customerName || '—'}</td>
              <td className="table-td text-xs text-slate-500">{s.remarks || '—'}</td>
            </tr>
          )}
          mobileRender={(s) => (
            <div key={s._id} className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{s.productName}</p>
                  <p className="text-xs text-slate-500">{formatDate(s.saleDate)} · {s.staff?.name}</p>
                </div>
                <p className="font-bold text-primary-600">{formatMoney(s.amount)}</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <p>Qty: {s.quantity}</p>
                <p>Cust: {s.customerName || '—'}</p>
              </div>
              {s.remarks && <p className="text-[11px] text-slate-400 italic">"{s.remarks}"</p>}
            </div>
          )}
        />
        <Pagination pagination={sales.pagination} onPage={setPage} />
      </Card>
    </div>
  );
}
