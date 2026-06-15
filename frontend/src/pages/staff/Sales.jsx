import { useEffect, useState, useCallback } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, Button, Input, Textarea, Modal, Table, Spinner, EmptyState } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';

export default function StaffSales() {
  const [sales, setSales] = useState(null);
  const [summary, setSummary] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ productName: '', quantity: 1, amount: '', customerName: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sum] = await Promise.all([
        api.get('/sales', { params: { period: 'monthly' } }),
        api.get('/sales/me/summary'),
      ]);
      setSales(s.data.data);
      setSummary(sum.data.data);
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/sales', {
        ...form,
        quantity: Number(form.quantity),
        amount: Number(form.amount),
      });
      setModal(false);
      setForm({ productName: '', quantity: 1, amount: '', customerName: '', remarks: '' });
      load();
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setSaving(false); }
  };

  if (featureBlocked) {
    return <Card><EmptyState icon={TrendingUp} title="Sales tracking is not enabled for your company"
      subtitle="Ask your company owner to upgrade the package." /></Card>;
  }
  if (!sales || !summary) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales Entry</h1>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New Sale</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-xl font-bold">{formatMoney(summary.monthlyTarget)}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Target</p>
        </Card>
        <Card className="p-4 text-center border-emerald-100 dark:border-emerald-900/30">
          <p className="text-xl font-bold text-emerald-600">{formatMoney(summary.achieved)}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Achieved ({summary.progressPct}%)</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-bold text-orange-500">{formatMoney(summary.remaining)}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Remaining</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="My Sales — Last 30 days" subtitle={`${summary.salesCount} entries this month`} />
        <Table
          columns={['Date', 'Product', 'Qty', 'Amount', 'Customer']}
          data={sales.items}
          renderRow={(s) => (
            <tr key={s._id}>
              <td className="table-td">{formatDate(s.saleDate)}</td>
              <td className="table-td font-medium">{s.productName}</td>
              <td className="table-td">{s.quantity}</td>
              <td className="table-td font-semibold">{formatMoney(s.amount)}</td>
              <td className="table-td">{s.customerName || '—'}</td>
            </tr>
          )}
          mobileRender={(s) => (
            <div key={s._id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.productName}</p>
                <p className="font-bold text-primary-600">{formatMoney(s.amount)}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <p>{formatDate(s.saleDate)} · Qty: {s.quantity}</p>
                <p className="truncate max-w-[150px]">{s.customerName ? `Cust: ${s.customerName}` : ''}</p>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Submit Sale">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Input label="Product *" required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity *" type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <Input label="Amount *" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <Input label="Customer Name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <Textarea label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Sale</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
