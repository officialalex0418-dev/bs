import { useEffect, useState, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Select, Table, Badge, Spinner, Pagination, Modal, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function Leaves() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [reviewing, setReviewing] = useState(null); // { leave, decision }
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/leaves', { params: { page, status: status || undefined } });
    setData(data.data);
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const decide = async () => {
    setSaving(true);
    try {
      await api.patch(`/leaves/${reviewing.leave._id}/decision`, { status: reviewing.decision, note });
      setReviewing(null);
      setNote('');
      load();
    } finally { setSaving(false); }
  };

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leave Requests</h1>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'All statuses' }, { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' },
          ]} className="w-44" />
      </div>

      <Card>
        <Table
          columns={['Staff', 'Type', 'From → To', 'Days', 'Reason', 'Status', 'Actions']}
          data={data.items}
          renderRow={(l) => (
            <tr key={l._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td font-medium">{l.staff?.name}</td>
              <td className="table-td"><Badge color={l.type === 'PAID' ? 'blue' : l.type === 'SICK' ? 'yellow' : 'gray'}>{l.type}</Badge></td>
              <td className="table-td text-sm">{formatDate(l.fromDate, dateFormat)} → {formatDate(l.toDate, dateFormat)}</td>
              <td className="table-td">{l.days}</td>
              <td className="table-td max-w-[200px] truncate text-xs text-slate-500">{l.reason || '—'}</td>
              <td className="table-td">
                <Badge color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'}>{l.status}</Badge>
                {l.reviewedBy && <p className="mt-1 text-[10px] text-slate-400">by {l.reviewedBy.name}</p>}
              </td>
              <td className="table-td">
                {l.status === 'PENDING' && (
                  <div className="flex gap-1">
                    <Button variant="outline" className="!px-2 !py-1 text-emerald-600"
                      onClick={() => setReviewing({ leave: l, decision: 'APPROVED' })}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="!px-2 !py-1 text-red-500"
                      onClick={() => setReviewing({ leave: l, decision: 'REJECTED' })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          )}
          mobileRender={(l) => (
            <div key={l._id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{l.staff?.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(l.fromDate, dateFormat)} → {formatDate(l.toDate, dateFormat)} ({l.days} days)</p>
                </div>
                <Badge color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'}>{l.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={l.type === 'PAID' ? 'blue' : l.type === 'SICK' ? 'yellow' : 'gray'}>{l.type}</Badge>
                <p className="text-xs text-slate-500 truncate">{l.reason || 'No reason provided'}</p>
              </div>
              {l.status === 'PENDING' && (
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" className="flex-1 text-emerald-600" size="sm"
                    onClick={() => setReviewing({ leave: l, decision: 'APPROVED' })}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button variant="outline" className="flex-1 text-red-500" size="sm"
                    onClick={() => setReviewing({ leave: l, decision: 'REJECTED' })}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      <Modal open={!!reviewing} onClose={() => setReviewing(null)}
        title={`${reviewing?.decision === 'APPROVED' ? 'Approve' : 'Reject'} leave — ${reviewing?.leave?.staff?.name}`}>
        <div className="space-y-4">
          <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button loading={saving} variant={reviewing?.decision === 'APPROVED' ? 'primary' : 'danger'} onClick={decide}>
              Confirm {reviewing?.decision === 'APPROVED' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
