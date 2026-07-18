import { useEffect, useState, useCallback } from 'react';
import { Plus, TrendingUp, UserPlus } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, Button, Input, Textarea, Modal, Table, Spinner, EmptyState, Select } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function StaffSales() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [sales, setSales] = useState(null);
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState({ products: [], customers: [] });
  const [modal, setModal] = useState(false);
  const [custModal, setCustModal] = useState(false);
  const [form, setForm] = useState({ productId: '', productName: '', quantity: 1, sellingPrice: 0, amount: 0, customerName: '', remarks: '' });
  const [custForm, setCustForm] = useState({ name: '', address: '', contactNumber: '', panVat: '', ownerName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const loadMetadata = useCallback(async () => {
    try {
      const { data } = await api.get('/sales/metadata');
      setMetadata(data.data);
    } catch (err) {}
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, sum] = await Promise.all([
        api.get('/sales', { params: { period: 'monthly' } }),
        api.get('/sales/me/summary')
      ]);
      setSales(s.data.data);
      setSummary(sum.data.data);
      loadMetadata();
    } catch (err) {
      if (err.response?.status === 403) {
        if (err.response?.data?.message?.toLowerCase().includes('package')) {
          setFeatureBlocked(true);
        } else {
          setError(err.response?.data?.message || 'Access denied');
        }
      } else {
        setError('Failed to load sales data');
      }
    }
  }, [loadMetadata]);
  useEffect(() => { load(); }, [load]);

  const onProductChange = (e) => {
    const pid = e.target.value;
    const prod = metadata.products.find(p => p._id === pid);
    if (prod) {
      const sp = prod.sellingPrice || 0;
      setForm({
        ...form,
        productId: pid,
        productName: prod.productName,
        sellingPrice: sp,
        amount: sp * form.quantity
      });
    } else {
      setForm({ ...form, productId: '', productName: '', sellingPrice: 0, amount: 0 });
    }
  };

  const onQuantityChange = (e) => {
    const q = Number(e.target.value) || 0;
    setForm({ ...form, quantity: q, amount: q * form.sellingPrice });
  };

  const onPriceChange = (e) => {
    const p = Number(e.target.value) || 0;
    setForm({ ...form, sellingPrice: p, amount: p * form.quantity });
  };

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
      setForm({ productId: '', productName: '', quantity: 1, sellingPrice: 0, amount: 0, customerName: '', remarks: '' });
      load();
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.message?.toLowerCase().includes('package')) {
        setFeatureBlocked(true);
      }
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setSaving(false); }
  };

  const submitQuickCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customers', custForm);
      setCustModal(false);
      setForm({ ...form, customerName: custForm.name });
      setCustForm({ name: '', address: '', contactNumber: '', panVat: '', ownerName: '' });
      loadMetadata();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add customer');
    } finally { setSaving(false); }
  };

  if (featureBlocked) {
    return <Card><EmptyState icon={TrendingUp} title="Sales tracking is not enabled for your company"
      subtitle="Ask your company owner to upgrade the package." /></Card>;
  }

  if (error) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={load} variant="outline">Try Again</Button>
      </Card>
    );
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
              <td className="table-td">{formatDate(s.saleDate, dateFormat)}</td>
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
                <p>{formatDate(s.saleDate, dateFormat)} · Qty: {s.quantity}</p>
                <p className="truncate max-w-[150px]">{s.customerName ? `Cust: ${s.customerName}` : ''}</p>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Submit Sale">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Select
              label="Select Product *"
              value={form.productId}
              onChange={onProductChange}
              options={[
                { value: '', label: 'Select product...' },
                ...metadata.products.map(p => ({ value: p._id, label: `${p.productName} (Stock: ${p.quantity})` }))
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity *" type="number" min="1" required value={form.quantity} onChange={onQuantityChange} />
            <Input label="Selling Price *" type="number" min="0" step="0.01" required value={form.sellingPrice} onChange={onPriceChange} />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Total Amount</label>
            <div className="input bg-slate-50 dark:bg-slate-900/50 flex items-center h-10 px-3 font-bold text-primary-600 border border-slate-200 dark:border-slate-800 rounded-lg">
                {formatMoney(form.amount)}
            </div>
            <p className="text-[10px] text-slate-400 italic">Auto-calculated: Qty × Price</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium mb-1.5">Customer Name</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  list="customer-list"
                  placeholder="Select or type customer name..."
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
                <datalist id="customer-list">
                  {metadata.customers.map(c => <option key={c._id} value={c.name} />)}
                </datalist>
              </div>
              <Button type="button" variant="outline" size="md" className="shrink-0 px-2" title="Quick Add Customer" onClick={() => setCustModal(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">Type a new name to register it automatically, or click icon for full details.</p>
          </div>

          <Textarea label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Sale</Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal open={custModal} onClose={() => setCustModal(false)} title="Quick Add Customer">
        <form onSubmit={submitQuickCustomer} className="space-y-4">
          <Input label="Business Name *" required value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
          <Input label="Address" value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Number" value={custForm.contactNumber} onChange={(e) => setCustForm({ ...custForm, contactNumber: e.target.value })} />
            <Input label="PAN/VAT" value={custForm.panVat} onChange={(e) => setCustForm({ ...custForm, panVat: e.target.value })} />
          </div>
          <Input label="Owner Name" value={custForm.ownerName} onChange={(e) => setCustForm({ ...custForm, ownerName: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCustModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save & Select</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
