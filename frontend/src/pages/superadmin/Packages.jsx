import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Select, Modal, Badge, Spinner } from '@/components/ui';
import { formatMoney } from '@/lib/utils';

const FEATURES = [
  ['employeeTracking', 'Employee Tracking'],
  ['inventoryManagement', 'Inventory Management'],
  ['vendorManagement', 'Vendor Management'],
  ['payrollManagement', 'Payroll Management'],
  ['salesTracking', 'Sales Tracking'],
  ['complaintChat', 'Complaint & Chat'],
];

const emptyForm = {
  name: '', description: '', price: 0, maxStaff: 10, trackingIntervalMinutes: 60,
  status: 'ACTIVE',
  chatRetentionDays: 30,
  features: {
    employeeTracking: true, inventoryManagement: false, vendorManagement: false,
    payrollManagement: false, salesTracking: false, complaintChat: false
  },
};

export default function Packages() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/packages');
    setItems(data.data.items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...form, price: Number(form.price), maxStaff: Number(form.maxStaff), trackingIntervalMinutes: Number(form.trackingIntervalMinutes) };
      if (editing) await api.patch(`/packages/${editing._id}`, body);
      else await api.post('/packages', body);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm(`Delete package "${p.name}"?`)) return;
    try { await api.delete(`/packages/${p._id}`); load(); }
    catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Packages</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> New Package
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <Card key={p._id} className="flex flex-col p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-sm text-slate-500">{p.description}</p>
              </div>
              <Badge color={p.status === 'ACTIVE' ? 'green' : 'gray'}>{p.status}</Badge>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-primary-600">
              {formatMoney(p.price)}<span className="text-sm font-normal text-slate-400">/mo</span>
            </p>
            <div className="mt-3 space-y-1 text-sm text-slate-500">
              <p>👥 Up to <b>{p.maxStaff}</b> staff</p>
              <p>📍 Location ping every <b>{p.trackingIntervalMinutes} min</b></p>
              <p>🕒 Chat retention: <b>{p.chatRetentionDays || 30} days</b></p>
            </div>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {FEATURES.map(([key, label]) => (
                <li key={key} className="flex items-center gap-2">
                  {p.features?.[key]
                    ? <Check className="h-4 w-4 text-emerald-500" />
                    : <XIcon className="h-4 w-4 text-slate-300" />}
                  <span className={p.features?.[key] ? '' : 'text-slate-400 line-through'}>{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1"
                onClick={() => { setEditing(p); setForm({ ...p }); setModal(true); }}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="danger" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Package'} wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Package Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Price (per month)" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input label="Max Staff *" type="number" min="1" required value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: e.target.value })} />
          <Select label="Tracking Interval" value={form.trackingIntervalMinutes}
            onChange={(e) => setForm({ ...form, trackingIntervalMinutes: e.target.value })}
            options={[{ value: 30, label: 'Every 30 minutes' }, { value: 60, label: 'Every 60 minutes' }, { value: 120, label: 'Every 120 minutes' }]} />

          <Select label="Chat Retention (Message Disappearing)" value={form.chatRetentionDays}
            onChange={(e) => setForm({ ...form, chatRetentionDays: Number(e.target.value) })}
            options={[
              { value: 30, label: '30 Days' },
              { value: 90, label: '90 Days' },
              { value: 180, label: '180 Days' },
              { value: 365, label: '1 Year (365 Days)' }
            ]} />

          <div className="sm:col-span-2">
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Features</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FEATURES.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600"
                    checked={!!form.features?.[key]}
                    onChange={(e) => setForm({ ...form, features: { ...form.features, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          <div className="flex items-end justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
