import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Spinner, Table, Checkbox } from '@/components/ui';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyForm = {
  name: '',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  startTime: '09:00',
  endTime: '18:00',
  bufferTime: 15,
};

export default function Shifts() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/company-config/shifts');
    setItems(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.patch(`/company-config/shifts/${editing._id}`, form);
      else await api.post('/company-config/shifts', form);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete shift "${item.name}"?`)) return;
    await api.delete(`/company-config/shifts/${item._id}`);
    load();
  };

  const toggleDay = (day) => {
    setForm(prev => {
      const workingDays = prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays };
    });
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Work Shifts</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }}>
          <Plus className="h-4 w-4" /> New Shift
        </Button>
      </div>

      <Card>
        <Table
          columns={['Shift Name', 'Timing', 'Working Days', 'Late Buffer', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
              <td className="table-td text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {item.startTime} — {item.endTime}
                </div>
              </td>
              <td className="table-td">
                <div className="flex flex-wrap gap-1">
                   <p className="text-xs text-slate-600 max-w-[200px] truncate">
                     {item.workingDays.join(', ')}
                   </p>
                </div>
              </td>
              <td className="table-td">{item.bufferTime} min</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Shift'} wide>
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Shift Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Day Shift, Night Shift" />
            <Input label="Late Buffer (minutes) *" type="number" min="0" required value={form.bufferTime} onChange={(e) => setForm({ ...form, bufferTime: e.target.value })} />
            <Input label="Start Time *" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End Time *" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Working Days</p>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((day) => (
                <label key={day} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 hover:bg-slate-50 dark:border-slate-800">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={form.workingDays.includes(day)} onChange={() => toggleDay(day)} />
                  <span className="text-sm">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save Shift' : 'Create Shift'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
