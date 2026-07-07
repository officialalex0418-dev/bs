import { useEffect, useState, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, Button, Table, Badge, Spinner, Pagination, DatePicker } from '@/components/ui';
import { formatTime } from '@/lib/utils';

export default function AttendancePage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const { data } = await api.get('/attendance', { params: { page, date } });
    setData(data.data);
  }, [page, date]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex items-center gap-2">
          <DatePicker className="w-40" value={date} onChange={(val) => { setDate(val); setPage(1); }} />
          <Button variant="outline" onClick={() => downloadFile(`/reports/attendance/excel?month=${date.slice(0, 7)}`, `attendance-${date.slice(0, 7)}.xlsx`)}>
            <FileDown className="h-4 w-4" /> Month Excel
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={['Staff', 'Check-In', 'Check-Out', 'Late', 'Worked', 'Status']}
          data={data.items}
          renderRow={(a) => (
            <tr key={a._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td">
                <p className="font-medium">{a.staff?.name}</p>
                <p className="text-xs text-slate-400">{a.staff?.position}</p>
              </td>
              <td className="table-td">{formatTime(a.checkIn?.time)}</td>
              <td className="table-td">{formatTime(a.checkOut?.time)}</td>
              <td className="table-td">{a.checkIn?.isLate ? <Badge color="red">Late</Badge> : <Badge color="green">On time</Badge>}</td>
              <td className="table-td">{a.workedMinutes ? `${(a.workedMinutes / 60).toFixed(1)} h` : '—'}</td>
              <td className="table-td">
                <Badge color={a.status === 'PRESENT' ? 'green' : a.status === 'HALF_DAY' ? 'yellow' : 'gray'}>{a.status}</Badge>
              </td>
            </tr>
          )}
          mobileRender={(a) => (
            <div key={a._id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{a.staff?.name}</p>
                  <p className="text-xs text-slate-500">{a.staff?.position || 'Staff'}</p>
                </div>
                <Badge color={a.status === 'PRESENT' ? 'green' : a.status === 'HALF_DAY' ? 'yellow' : 'gray'}>{a.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>In: {formatTime(a.checkIn?.time)}</p>
                <p>Out: {formatTime(a.checkOut?.time)}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                {a.checkIn?.isLate ? <Badge color="red">Late</Badge> : <Badge color="green">On time</Badge>}
                <p className="text-xs text-slate-400">{a.workedMinutes ? `${(a.workedMinutes / 60).toFixed(1)} hours worked` : ''}</p>
              </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>
    </div>
  );
}
