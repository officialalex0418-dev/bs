import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Spinner, Table } from '@/components/ui';

const emptyForm = { name: '' };

export default function Departments() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/company-config/departments');
    setItems(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.patch(`/company-config/departments/${editing._id}`, form);
      else await api.post('/company-config/departments', form);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete department "${item.name}"?`)) return;
    await api.delete(`/company-config/departments/${item._id}`);
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> New Department
        </Button>
      </div>

      <Card>
        <Table
          columns={['Department Name', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Department'}>
        <form onSubmit={submit} className="space-y-6">
          <Input label="Department Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales, Marketing, IT" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
