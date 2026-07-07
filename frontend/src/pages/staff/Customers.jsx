import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, User, Phone, MapPin, Hash, Briefcase } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, Button, Input, Modal, Table, Spinner, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function StaffCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', contactNumber: '', panVat: '', ownerName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/customers', { params: { search } });
      setCustomers(data.data);
    } catch (err) {
      setError('Failed to load customers');
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', address: '', contactNumber: '', panVat: '', ownerName: '' });
    setError('');
    setModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      address: c.address || '',
      contactNumber: c.contactNumber || '',
      panVat: c.panVat || '',
      ownerName: c.ownerName || ''
    });
    setError('');
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        await api.patch(`/customers/${editing._id}`, form);
      } else {
        await api.post('/customers', form);
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally { setSaving(false); }
  };

  const deleteCust = async (id) => {
    if (!confirm('Are you sure you want to remove this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      load();
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (error && !customers) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={load} variant="outline">Try Again</Button>
      </Card>
    );
  }

  if (!customers) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">My Customers</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> New Customer</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by name, contact or owner..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <Table
          columns={['Customer Name', 'Contact Info', 'Owner', 'Actions']}
          data={customers.items}
          renderRow={(c) => (
            <tr key={c._id}>
              <td className="table-td">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {c.address || 'No address'}
                </div>
              </td>
              <td className="table-td">
                <div className="flex items-center gap-1.5 text-sm">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.contactNumber || '—'}
                </div>
                {c.panVat && (
                  <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1">
                    <Hash className="h-3 w-3" /> PAN/VAT: {c.panVat}
                  </div>
                )}
              </td>
              <td className="table-td">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-3.5 w-3.5 text-slate-400" /> {c.ownerName || '—'}
                </div>
              </td>
              <td className="table-td">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteCust(c._id)}>Delete</Button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(c) => (
            <div key={c._id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{c.name}</h3>
                  <p className="text-xs text-slate-500">{c.address || 'No address'}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.contactNumber || '—'}
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> {c.ownerName || '—'}
                </div>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Customer' : 'Add New Customer'}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Business Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
            <Input label="PAN/VAT" value={form.panVat} onChange={(e) => setForm({ ...form, panVat: e.target.value })} />
          </div>
          <Input label="Owner Name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Save'} Customer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
