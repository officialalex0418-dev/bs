import { useEffect, useState, useCallback } from 'react';
import { FileDown, Check, X, Eye } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, Button, Table, Badge, Spinner, Pagination, DatePicker, Modal, Textarea } from '@/components/ui';
import { formatTime, toNepaliMonth, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function AttendancePage() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState('logs'); // logs | requests

  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  const load = useCallback(async () => {
    if (tab === 'logs') {
      const { data } = await api.get('/attendance', { params: { page, date } });
      setData(data.data);
    } else {
      setReqLoading(true);
      const { data } = await api.get('/attendance/requests', { params: { status: 'PENDING' } });
      setRequests(data.data.requests);
      setReqLoading(false);
    }
  }, [page, date, tab]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id, status) => {
    try {
      await api.patch(`/attendance/requests/${id}/review`, { status, reviewNote });
      setReviewing(null);
      setReviewNote('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex items-center gap-2">
          {tab === 'logs' && <DatePicker className="w-40" value={date} onChange={(val) => { setDate(val); setPage(1); }} />}
          <Button variant="outline" onClick={() => downloadFile(`/reports/attendance/excel?month=${date.slice(0, 7)}`, `attendance-${date.slice(0, 7)}.xlsx`)}>
            <FileDown className="h-4 w-4" /> {dateFormat === 'BS' ? toNepaliMonth(date.slice(0, 7)) : 'Month'} Excel
          </Button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'logs' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setTab('logs')}
        >
          Daily Logs
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'requests' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setTab('requests')}
        >
          Overtime Requests {requests.length > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">{requests.length}</span>}
        </button>
      </div>

      {tab === 'logs' ? (
        !data ? <Spinner /> : (
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
        )
      ) : (
        reqLoading ? <Spinner /> : (
          <Card>
            <Table
              columns={['Staff', 'Date', 'Timings', 'Reason', 'Actions']}
              data={requests}
              renderRow={(r) => (
                <tr key={r._id}>
                  <td className="table-td">
                    <p className="font-medium">{r.staff?.name}</p>
                    <p className="text-xs text-slate-400">{r.staff?.position}</p>
                  </td>
                  <td className="table-td">{r.date}</td>
                  <td className="table-td">
                    <p className="text-xs font-medium">{formatTime(r.checkInTime)} - {formatTime(r.checkOutTime)}</p>
                  </td>
                  <td className="table-td max-w-xs truncate text-xs text-slate-500" title={r.reason}>{r.reason}</td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setReviewing(r)}>Review</Button>
                    </div>
                  </td>
                </tr>
              )}
              mobileRender={(r) => (
                <div key={r._id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{r.staff?.name}</p>
                      <p className="text-xs text-slate-500">{r.date}</p>
                    </div>
                    <Badge color="yellow">PENDING</Badge>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded">{r.reason}</p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" className="flex-1" onClick={() => setReviewing(r)}>Approve / Reject</Button>
                  </div>
                </div>
              )}
            />
          </Card>
        )
      )}

      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title="Review Overtime Request">
        {reviewing && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
              <p><b>Employee:</b> {reviewing.staff?.name}</p>
              <p><b>Date:</b> {reviewing.date}</p>
              <p><b>Time:</b> {formatTime(reviewing.checkInTime)} to {formatTime(reviewing.checkOutTime)}</p>
              <p className="mt-2 border-t pt-2 italic text-slate-600">"{reviewing.reason}"</p>
            </div>
            <Textarea label="Admin Note (Optional)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a reason for approval/rejection" />
            <div className="flex gap-3 pt-2">
              <Button variant="danger" className="flex-1" onClick={() => handleReview(reviewing._id, 'REJECTED')}><X className="h-4 w-4 mr-1" /> Reject</Button>
              <Button variant="primary" className="flex-1" onClick={() => handleReview(reviewing._id, 'APPROVED')}><Check className="h-4 w-4 mr-1" /> Approve</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
