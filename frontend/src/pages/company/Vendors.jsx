import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Table, Spinner, Pagination, EmptyState } from '@/components/ui';

const emptyForm = { name: '', phone: '', email: '', address: '', panVat: '' };

export default function Vendors() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/vendors', { params: { page, search: search || undefined } });
      setData(data.data);
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/vendors/${editing._id}`, form);
      else await api.post('/vendors', form);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (v) => {
    if (!confirm(`Remove vendor ${v.name}?`)) return;
    await api.delete(`/vendors/${v._id}`);
    load();
  };

  if (featureBlocked) {
    return <Card><EmptyState icon={Truck} title="Vendor management not included in your package"
      subtitle="Upgrade your package to unlock vendor management." /></Card>;
  }
  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <Card>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Search vendors…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        </div>
        <Table
          columns={['Vendor', 'Phone', 'Email', 'Address', 'PAN/VAT', 'Actions']}
          data={data.items}
          renderRow={(v) => (
            <tr key={v._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td font-medium">{v.name}</td>
              <td className="table-td">{v.phone || '—'}</td>
              <td className="table-td">{v.email || '—'}</td>
              <td className="table-td">{v.address || '—'}</td>
              <td className="table-td">{v.panVat || '—'}</td>
              <td className="table-td">
                <div className="flex gap-1">
                  <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => { setEditing(v); setForm({ ...emptyForm, ...v }); setModal(true); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => remove(v)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(v) => (
            <div key={v._id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{v.name}</p>
                <div className="flex gap-1">
                  <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => { setEditing(v); setForm({ ...emptyForm, ...v }); setModal(true); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => remove(v)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>{v.phone || 'No phone'}</p>
                <p className="text-right truncate">{v.email || 'No email'}</p>
              </div>
              <p className="text-xs text-slate-400 truncate">{v.address || 'No address'}</p>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Vendor' : 'Add Vendor'}>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Input label="Vendor Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="PAN / VAT" value={form.panVat} onChange={(e) => setForm({ ...form, panVat: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
