import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { Card, Table, Badge, Spinner, Pagination, Input } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'AD';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/audit-logs', { params: { page, action: action || undefined } });
    setData(data.data);
  }, [page, action]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <Card>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Filter by action e.g. LOGIN" value={action}
            onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(1); }} className="max-w-xs" />
        </div>
        <Table
          columns={['Time', 'User', 'Action', 'Entity', 'Company', 'IP', 'Status']}
          data={data.items}
          renderRow={(l) => (
            <tr key={l._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td text-xs text-slate-500">{formatDateTime(l.createdAt, dateFormat)}</td>
              <td className="table-td">
                <p className="font-medium">{l.user?.name || 'System'}</p>
                <p className="text-xs text-slate-400">{l.user?.role || ''}</p>
              </td>
              <td className="table-td"><Badge color="blue">{l.action}</Badge></td>
              <td className="table-td">{l.entity || '—'}</td>
              <td className="table-td">{l.company?.name || '—'}</td>
              <td className="table-td text-xs">{l.ip || '—'}</td>
              <td className="table-td">
                <Badge color={l.success ? 'green' : 'red'}>{l.success ? 'OK' : 'FAILED'}</Badge>
              </td>
            </tr>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>
    </div>
  );
}
