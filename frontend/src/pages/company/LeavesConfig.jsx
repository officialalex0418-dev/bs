import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, ShieldCheck } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, CardBody, Button, Input, Select, Modal, Spinner, Table, Badge } from '@/components/ui';

const emptyForm = { name: '', days: 0, isPaid: true, description: '' };

export default function LeavesConfig() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/company-config/leave-types');
    setItems(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.patch(`/company-config/leave-types/${editing._id}`, form);
      else await api.post('/company-config/leave-types', form);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete leave type "${item.name}"?`)) return;
    await api.delete(`/company-config/leave-types/${item._id}`);
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> Add Leave Type
        </Button>
      </div>

      <Card>
        <CardHeader title="Leave Policy" subtitle="Manage available leave types and their rules" />
        <Table
          columns={['Leave Name', 'Max Days', 'Type', 'Description', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
              <td className="table-td">{item.days} Days / Year</td>
              <td className="table-td">
                <Badge color={item.isPaid ? 'green' : 'red'}>{item.isPaid ? 'Paid' : 'Unpaid'}</Badge>
              </td>
              <td className="table-td text-xs text-slate-500 italic max-w-xs truncate">{item.description || '—'}</td>
              <td className="table-td">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setForm({ ...item }); setModal(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Leave Type'}>
        <form onSubmit={submit} className="space-y-6">
          <Input label="Leave Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vacation, Sick, Personal" />
          <Input label="Max Days per Year *" type="number" min="0" required value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />

          <Select label="Payment Rule *" required value={String(form.isPaid)} onChange={(e) => setForm({ ...form, isPaid: e.target.value === 'true' })}
            options={[{ value: 'true', label: 'Paid Leave' }, { value: 'false', label: 'Unpaid Leave' }]} />

          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save Changes' : 'Create Type'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
