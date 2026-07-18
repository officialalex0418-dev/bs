import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, TrendingUp, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, Button, Input, Textarea, Modal, Table, Spinner, EmptyState, Select } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyRow = { productId: '', productName: '', quantity: 1, sellingPrice: 0, amount: 0 };

export default function StaffSales() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [sales, setSales] = useState(null);
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState({ products: [], customers: [] });
  const [modal, setModal] = useState(false);
  const [custModal, setCustModal] = useState(false);

  const [items, setItems] = useState([{ ...emptyRow }]);
  const [customerName, setCustomerName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [custForm, setCustForm] = useState({ name: '', address: '', contactNumber: '', panVat: '', ownerName: '' });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
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
          setLoadError(err.response?.data?.message || 'Access denied');
        }
      } else {
        setLoadError('Failed to load sales data');
      }
    }
  }, [loadMetadata]);

  useEffect(() => { load(); }, [load]);

  const addRow = () => setItems([...items, { ...emptyRow }]);

  const removeRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;

    if (field === 'productId') {
      const prod = metadata.products.find(p => p._id === value);
      if (prod) {
        next[index].productName = prod.productName;
        next[index].sellingPrice = prod.sellingPrice;
      }
    }

    if (field === 'productId' || field === 'quantity' || field === 'sellingPrice') {
        next[index].amount = (Number(next[index].quantity) || 0) * (Number(next[index].sellingPrice) || 0);
    }

    setItems(next);
  };

  const startEdit = (sale) => {
    setEditingId(sale._id);
    setItems([{
        productId: sale.product || '',
        productName: sale.productName,
        quantity: sale.quantity,
        sellingPrice: sale.amount / sale.quantity,
        amount: sale.amount
    }]);
    setCustomerName(sale.customerName || '');
    setRemarks(sale.remarks || '');
    setModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setItems([{ ...emptyRow }]);
    setCustomerName('');
    setRemarks('');
    setSubmitError('');
  };

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  const submit = async (e) => {
    e.preventDefault();
    if (items.some(i => !i.productId && !i.productName)) {
        setSubmitError('Please select a product for all rows');
        return;
    }
    setSaving(true); setSubmitError('');
    try {
      if (editingId) {
          const item = items[0];
          await api.patch(`/sales/${editingId}`, {
              productId: item.productId,
              quantity: item.quantity,
              amount: item.amount,
              customerName,
              remarks,
          });
      } else {
          await api.post('/sales', {
            items,
            customerName,
            remarks,
          });
      }
      setModal(false);
      resetForm();
      load();
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.message?.toLowerCase().includes('package')) {
        setFeatureBlocked(true);
      }
      setSubmitError(err.response?.data?.message || 'Submission failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales record?')) return;
    try {
        await api.delete(`/sales/${id}`);
        load();
    } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete sale');
    }
  };

  const submitQuickCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customers', custForm);
      setCustModal(false);
      setCustomerName(custForm.name);
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

  if (loadError) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-red-600 font-medium">{loadError}</p>
        <Button onClick={() => { setLoadError(''); load(); }} variant="outline">Try Again</Button>
      </Card>
    );
  }

  if (!sales || !summary) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales Entry</h1>
        <Button onClick={() => { resetForm(); setModal(true); }}><Plus className="h-4 w-4" /> New Sale</Button>
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
          columns={['Date', 'Product', 'Qty', 'Amount', 'Customer', 'Actions']}
          data={sales.items}
          renderRow={(s) => (
            <tr key={s._id}>
              <td className="table-td">{formatDate(s.saleDate, dateFormat)}</td>
              <td className="table-td font-medium">{s.productName}</td>
              <td className="table-td">{s.quantity}</td>
              <td className="table-td font-semibold">{formatMoney(s.amount)}</td>
              <td className="table-td">{s.customerName || '—'}</td>
              <td className="table-td">
                <div className="flex gap-2">
                    <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors rounded-lg hover:bg-primary-50">
                        <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(s._id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(s) => (
            <div key={s._id} className="p-4 space-y-2 border-b last:border-0 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.productName}</p>
                <p className="font-bold text-primary-600">{formatMoney(s.amount)}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="space-y-1">
                    <p>{formatDate(s.saleDate, dateFormat)} · Qty: {s.quantity}</p>
                    <p className="truncate max-w-[150px]">{s.customerName ? `Cust: ${s.customerName}` : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => startEdit(s)} className="p-2 text-primary-600 bg-primary-50 rounded-lg">
                        <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(s._id)} className="p-2 text-red-600 bg-red-50 rounded-lg">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); resetForm(); }} title={editingId ? "Edit Sales Entry" : "Submit Sales Entry"} wide>
        {submitError && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 border border-red-100">{submitError}</div>}
        <form onSubmit={submit} className="space-y-6">

          <div className="overflow-x-auto border rounded-xl dark:border-slate-800">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                    <tr>
                        <th className="px-3 py-3 font-bold">Product</th>
                        <th className="px-3 py-3 font-bold w-24">Qty</th>
                        <th className="px-3 py-3 font-bold w-32">Price</th>
                        <th className="px-3 py-3 font-bold w-32 text-right">Amount</th>
                        <th className="px-3 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                    {items.map((row, idx) => (
                        <tr key={idx} className="group">
                            <td className="px-2 py-2">
                                <Select
                                    value={row.productId}
                                    onChange={(e) => updateRow(idx, 'productId', e.target.value)}
                                    options={[
                                        { value: '', label: 'Select product...' },
                                        ...metadata.products.map(p => ({ value: p._id, label: `${p.productName} (Stock: ${p.quantity})` }))
                                    ]}
                                    required
                                    className="h-9 text-xs"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <Input type="number" min="1" required value={row.quantity} onChange={(e) => updateRow(idx, 'quantity', e.target.value)} className="h-9 text-xs" />
                            </td>
                            <td className="px-2 py-2">
                                <Input type="number" min="0" step="0.01" required value={row.sellingPrice} onChange={(e) => updateRow(idx, 'sellingPrice', e.target.value)} className="h-9 text-xs" />
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-200">
                                {formatMoney(row.amount)}
                            </td>
                            <td className="px-2 py-2">
                                {!editingId && (
                                    <button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {!editingId && (
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Add Product Row
            </Button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-4 border-t dark:border-slate-800">
             <div className="space-y-4">
                <div className="space-y-1">
                    <label className="block text-sm font-medium">Customer Name</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                            list="customer-list"
                            placeholder="Select or type customer name..."
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            />
                            <datalist id="customer-list">
                                {metadata.customers.map(c => <option key={c._id} value={c.name} />)}
                            </datalist>
                        </div>
                        <Button type="button" variant="outline" size="md" className="shrink-0 px-2" title="Quick Add Customer" onClick={() => setCustModal(true)}>
                            <UserPlus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <Textarea label="Remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional internal notes..." />
             </div>

             <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-primary-100 dark:border-primary-900/20 space-y-4 shadow-inner">
                <div className="flex justify-between items-end">
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Total Entry Amount</span>
                    <span className="text-3xl font-black text-primary-600 leading-none">{formatMoney(totalAmount)}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic text-right border-t pt-2 border-slate-200 dark:border-slate-800">
                    {editingId ? 'Updating single record' : `Calculated for ${items.length} items`}
                </p>
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setModal(false); resetForm(); }} className="px-6">Cancel</Button>
                    <Button type="submit" loading={saving} className="px-8">
                        {editingId ? 'Update Entry' : 'Submit Sale'}
                    </Button>
                </div>
             </div>
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
