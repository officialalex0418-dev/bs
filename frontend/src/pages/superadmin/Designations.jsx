import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Check, X as XIcon } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardBody, Button, Input, Modal, Badge, Spinner, Table } from '@/components/ui';

const PERMISSIONS = [
  { key: 'companies', label: 'Companies' },
  { key: 'packages', label: 'Packages' },
  { key: 'systemEmployees', label: 'System Employees' },
  { key: 'companyStaff', label: 'Company Staff' },
  { key: 'configuration', label: 'Configuration' },
];

const emptyForm = {
  name: '',
  permissions: {
    companies: false,
    packages: false,
    systemEmployees: false,
    companyStaff: false,
    configuration: false,
  },
};

export default function Designations() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/designations');
      setItems(data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/designations/${editing._id}`, form);
      } else {
        await api.post('/designations', form);
      }
      setModal(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Delete designation "${item.name}"?`)) return;
    try {
      await api.delete(`/designations/${item._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Designations</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> New Designation
        </Button>
      </div>

      <Card>
        <Table
          columns={['Designation Name', 'Permissions', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
              <td className="table-td">
                <div className="flex flex-wrap gap-1">
                  {PERMISSIONS.map(p => (
                    <Badge key={p.key} color={item.permissions[p.key] ? 'green' : 'gray'} className="text-[10px]">
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Designation'}>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-6">
          <Input
            label="Designation Name *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. System Admin, Support Head"
          />

          <div>
            <p className="mb-3 text-sm font-medium">Access Permissions</p>
            <div className="space-y-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary-600"
                    checked={form.permissions[p.key]}
                    onChange={(e) => setForm({
                      ...form,
                      permissions: { ...form.permissions, [p.key]: e.target.checked }
                    })}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-[10px] text-slate-400">Grant access to {p.label} section</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save Changes' : 'Create Designation'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
