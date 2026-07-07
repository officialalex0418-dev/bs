import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, CardBody, Button, Input, Modal, Spinner, Table, Badge, Textarea, DatePicker } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyForm = { name: '', startDate: '', endDate: '', description: '' };

export default function HolidayCalendar() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/company-config/holidays');
    setItems(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.patch(`/company-config/holidays/${editing._id}`, form);
      else await api.post('/company-config/holidays', form);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete holiday "${item.name}"?`)) return;
    await api.delete(`/company-config/holidays/${item._id}`);
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holiday Calendar</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> Add Holiday
        </Button>
      </div>

      <Card>
        <CardHeader title="Annual Holidays" subtitle="Public holidays, festivals and company events" />
        <Table
          columns={['Holiday Name', 'Date Range', 'Description', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
              <td className="table-td text-primary-600 font-medium">
                {item.startDate.slice(0, 10) === item.endDate.slice(0, 10)
                  ? formatDate(item.startDate, dateFormat)
                  : `${formatDate(item.startDate, dateFormat)} to ${formatDate(item.endDate, dateFormat)}`}
              </td>
              <td className="table-td text-xs text-slate-500 max-w-xs truncate">{item.description || '—'}</td>
              <td className="table-td">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditing(item);
                    setForm({
                      ...item,
                      startDate: item.startDate.slice(0, 10),
                      endDate: item.endDate.slice(0, 10)
                    });
                    setModal(true);
                  }}>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit Holiday` : 'New Holiday'}>
        <form onSubmit={submit} className="space-y-6">
          <Input label="Holiday Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Christmas, New Year, Founder's Day" />
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Start Date *"
              required
              value={form.startDate}
              onChange={(val) => {
                setForm(prev => ({
                  ...prev,
                  startDate: val,
                  endDate: prev.endDate < val ? val : prev.endDate || val
                }));
              }}
            />
            <DatePicker
              label="End Date *"
              required
              value={form.endDate}
              onChange={(val) => setForm({ ...form, endDate: val })}
            />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save Changes' : 'Create Holiday'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
