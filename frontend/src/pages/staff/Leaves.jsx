import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, Button, Input, Select, Textarea, Modal, Table, Badge, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function StaffLeaves() {
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: 'PAID', fromDate: '', toDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/leaves/me');
    setData(data.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/leaves', form);
      setModal(false);
      setForm({ type: 'PAID', fromDate: '', toDate: '', reason: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Application failed');
    } finally { setSaving(false); }
  };

  if (!data) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Leaves</h1>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Apply Leave</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 text-center">
          <p className="text-3xl font-bold text-primary-600">{data.balance?.paid ?? 0}</p>
          <p className="text-sm text-slate-500">Paid leave remaining</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-3xl font-bold text-amber-500">{data.balance?.sick ?? 0}</p>
          <p className="text-sm text-slate-500">Sick leave remaining</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Leave History" />
        <Table
          columns={['Type', 'From → To', 'Days', 'Reason', 'Status']}
          data={data.items}
          renderRow={(l) => (
            <tr key={l._id}>
              <td className="table-td"><Badge color={l.type === 'PAID' ? 'blue' : l.type === 'SICK' ? 'yellow' : 'gray'}>{l.type}</Badge></td>
              <td className="table-td text-sm">{formatDate(l.fromDate)} → {formatDate(l.toDate)}</td>
              <td className="table-td">{l.days}</td>
              <td className="table-td max-w-[180px] truncate text-xs text-slate-500">{l.reason || '—'}</td>
              <td className="table-td">
                <Badge color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'}>{l.status}</Badge>
                {l.reviewNote && <p className="mt-1 text-[10px] text-slate-400">{l.reviewNote}</p>}
              </td>
            </tr>
          )}
          mobileRender={(l) => (
            <div key={l._id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{formatDate(l.fromDate)} → {formatDate(l.toDate)}</p>
                <Badge color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'}>{l.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={l.type === 'PAID' ? 'blue' : l.type === 'SICK' ? 'yellow' : 'gray'}>{l.type}</Badge>
                <p className="text-xs text-slate-500">{l.days} days</p>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 italic">{l.reason || 'No reason'}</p>
              {l.reviewNote && <p className="mt-1 rounded bg-slate-50 p-2 text-[10px] text-slate-500 dark:bg-slate-800">Admin: {l.reviewNote}</p>}
            </div>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Apply for Leave">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Select label="Leave Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'PAID', label: `Paid Leave (${data.balance?.paid ?? 0} left)` },
              { value: 'SICK', label: `Sick Leave (${data.balance?.sick ?? 0} left)` },
              { value: 'UNPAID', label: 'Unpaid Leave' },
            ]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="From *" type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            <Input label="To *" type="date" required min={form.fromDate} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
          </div>
          <Textarea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Application</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
