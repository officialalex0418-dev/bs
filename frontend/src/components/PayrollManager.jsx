/** Shared payroll UI for super admin (scope=system) and company panel. */
import { useEffect, useState, useCallback } from 'react';
import { Wallet, FileDown, CheckCircle2, FileText } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, Button, Input, Table, Badge, Spinner, Pagination, Modal, Select, Textarea, DatePicker, MonthPicker } from '@/components/ui';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyForm = {
  basicSalary: 0,
  allowance: 0,
  bonus: 0,
  deductions: { absent: 0, tax: 0, other: 0 },
  presentDays: 0,
  workingDays: 0,
  status: 'GENERATED',
  paidAt: '',
  remarks: '',
};

const totalDeductions = (p) => (p.deductions?.absent || 0) + (p.deductions?.tax || 0) + (p.deductions?.other || 0);

export default function PayrollManager({ scope }) {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailForm, setDetailForm] = useState(emptyForm);
  const [savingDetail, setSavingDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = { page, month: month || undefined };
      if (scope === 'system') params.scope = 'system';
      const { data } = await api.get('/payroll', { params });
      setData(data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load payroll data');
      setData({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
    }
  }, [page, month, scope]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true); setMessage('');
    try {
      const body = { month };
      if (scope === 'system') body.scope = 'system';
      const { data } = await api.post('/payroll/generate', body);
      setMessage(`Generated payroll for ${data.data.results.filter((r) => !r.skipped).length} staff (${data.data.results.filter((r) => r.skipped).length} already existed).`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const loadDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    try {
      const { data } = await api.get(`/payroll/${id}`);
      const payroll = data.data.payroll;
      setDetail(payroll);
      setDetailForm({
        basicSalary: payroll.basicSalary || 0,
        allowance: payroll.allowance || 0,
        bonus: payroll.bonus || 0,
        deductions: {
          absent: payroll.deductions?.absent || 0,
          tax: payroll.deductions?.tax || 0,
          other: payroll.deductions?.other || 0,
        },
        presentDays: payroll.presentDays || 0,
        workingDays: payroll.workingDays || 0,
        status: payroll.status || 'GENERATED',
        paidAt: payroll.paidAt ? payroll.paidAt.slice(0, 10) : '',
        remarks: payroll.remarks || '',
      });
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Unable to load payroll detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const payload = {
        basicSalary: Number(detailForm.basicSalary),
        allowance: Number(detailForm.allowance),
        bonus: Number(detailForm.bonus),
        deductions: {
          absent: Number(detailForm.deductions.absent),
          tax: Number(detailForm.deductions.tax),
          other: Number(detailForm.deductions.other),
        },
        presentDays: Number(detailForm.presentDays),
        workingDays: Number(detailForm.workingDays),
        status: detailForm.status,
        paidAt: detailForm.paidAt || null,
        remarks: detailForm.remarks,
      };
      const { data } = await api.patch(`/payroll/${detail._id}`, payload);
      setDetail(data.data.payroll);
      setMessage('Payroll updated with remarks.');
      await load();
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Update failed');
    } finally {
      setSavingDetail(false);
    }
  };

  const markPaid = async (p) => {
    await api.patch(`/payroll/${p._id}/pay`);
    load();
    if (detail?._id === p._id) loadDetail(p._id);
  };

  const downloadDetail = (p) => downloadFile(`/reports/payroll/${p._id}/pdf`, `payroll-${p.staff?.name || 'detail'}-${p.month}.pdf`);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Payroll Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker className="w-44" value={month} onChange={(val) => { setMonth(val); setPage(1); }} />
          <Button onClick={generate} loading={generating}>
            <Wallet className="h-4 w-4" /> Generate Payroll
          </Button>
          <Button variant="outline" onClick={() => downloadFile(`/reports/payroll/excel?month=${month}`, `payroll-${month}.xlsx`)}>
            <FileDown className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {message && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{message}</div>}

      <Card>
        <Table
          columns={['Staff', 'Month', 'Basic', 'Allowance', 'Deductions', 'Days', 'Net Salary', 'Status', 'Actions']}
          data={data.items}
          renderRow={(p) => (
            <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td font-medium">{p.staff?.name}</td>
              <td className="table-td">{p.month}</td>
              <td className="table-td">{formatMoney(p.basicSalary)}</td>
              <td className="table-td text-emerald-600">+{formatMoney(p.allowance)}</td>
              <td className="table-td text-red-500">−{formatMoney(totalDeductions(p))}</td>
              <td className="table-td">{p.presentDays}/{p.workingDays}</td>
              <td className="table-td font-bold">{formatMoney(p.netSalary)}</td>
              <td className="table-td">
                <Badge color={p.status === 'PAID' ? 'green' : p.status === 'GENERATED' ? 'blue' : 'gray'}>{p.status}</Badge>
              </td>
              <td className="table-td">
                <div className="flex flex-wrap gap-2">
                  <button className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline" onClick={() => loadDetail(p._id)}>
                    <FileText className="h-4 w-4" /> Report
                  </button>
                  <button className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline" onClick={() => downloadDetail(p)}>
                    <FileDown className="h-4 w-4" /> PDF
                  </button>
                  {p.status !== 'PAID' && (
                    <button className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline" onClick={() => markPaid(p)}>
                      <CheckCircle2 className="h-4 w-4" /> Mark Paid
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
          mobileRender={(p) => (
            <div key={p._id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.staff?.name}</p>
                  <p className="text-xs text-slate-500">{p.month} · {p.presentDays}/{p.workingDays} days</p>
                </div>
                <Badge color={p.status === 'PAID' ? 'green' : p.status === 'GENERATED' ? 'blue' : 'gray'}>{p.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Gross</p>
                  <p className="text-emerald-600">{formatMoney(p.basicSalary + p.allowance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Net Salary</p>
                  <p className="font-bold">{formatMoney(p.netSalary)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button className="flex items-center gap-1 text-xs font-medium text-slate-600" onClick={() => loadDetail(p._id)}>
                  <FileText className="h-4 w-4" /> Detail
                </button>
                <button className="flex items-center gap-1 text-xs font-medium text-blue-600" onClick={() => downloadDetail(p)}>
                  <FileDown className="h-4 w-4" /> PDF
                </button>
                {p.status !== 'PAID' && (
                  <button className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600" onClick={() => markPaid(p)}>
                    <CheckCircle2 className="h-4 w-4" /> Pay
                  </button>
                )}
              </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Payroll Detail Report" wide>
        {detailLoading ? (
          <Spinner />
        ) : detailError ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{detailError}</div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-sm font-semibold">Staff</p>
                <p className="mt-1 text-sm text-slate-600">{detail.staff?.name}</p>
                <p className="text-xs text-slate-400">{detail.staff?.email}</p>
                <p className="text-xs text-slate-400">{detail.staff?.position || 'Staff'}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm font-semibold">Summary</p>
                <p className="mt-1 text-sm text-slate-600">Month: {detail.month}</p>
                <p className="text-sm text-slate-600">Net Salary: {formatMoney(detail.netSalary)}</p>
                <p className="text-xs text-slate-400">Generated by {detail.generatedBy?.name || 'system'}</p>
              </Card>
            </div>

            <form onSubmit={saveDetail} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="Basic Salary" type="number" min="0" value={detailForm.basicSalary}
                  onChange={(e) => setDetailForm({ ...detailForm, basicSalary: e.target.value })} />
                <Input label="Allowance" type="number" min="0" value={detailForm.allowance}
                  onChange={(e) => setDetailForm({ ...detailForm, allowance: e.target.value })} />
                <Input label="Bonus" type="number" min="0" value={detailForm.bonus}
                  onChange={(e) => setDetailForm({ ...detailForm, bonus: e.target.value })} />
                <Input label="Absent Deduction" type="number" min="0" value={detailForm.deductions.absent}
                  onChange={(e) => setDetailForm({ ...detailForm, deductions: { ...detailForm.deductions, absent: e.target.value } })} />
                <Input label="Tax Deduction" type="number" min="0" value={detailForm.deductions.tax}
                  onChange={(e) => setDetailForm({ ...detailForm, deductions: { ...detailForm.deductions, tax: e.target.value } })} />
                <Input label="Other Deduction" type="number" min="0" value={detailForm.deductions.other}
                  onChange={(e) => setDetailForm({ ...detailForm, deductions: { ...detailForm.deductions, other: e.target.value } })} />
                <Input label="Present Days" type="number" min="0" value={detailForm.presentDays}
                  onChange={(e) => setDetailForm({ ...detailForm, presentDays: e.target.value })} />
                <Input label="Working Days" type="number" min="0" value={detailForm.workingDays}
                  onChange={(e) => setDetailForm({ ...detailForm, workingDays: e.target.value })} />
                <DatePicker label="Paid At" value={detailForm.paidAt || ''}
                  onChange={(val) => setDetailForm({ ...detailForm, paidAt: val })} />
              </div>

              <Select
                label="Status"
                value={detailForm.status}
                onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                options={[
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'GENERATED', label: 'Generated' },
                  { value: 'PAID', label: 'Paid' },
                ]}
              />

              <Textarea
                label="Remarks / reason for edit"
                value={detailForm.remarks}
                onChange={(e) => setDetailForm({ ...detailForm, remarks: e.target.value })}
                placeholder="Add the reason for this change"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
                <span>Gross: {formatMoney((Number(detailForm.basicSalary) || 0) + (Number(detailForm.allowance) || 0) + (Number(detailForm.bonus) || 0))}</span>
                <span>Deductions: {formatMoney((Number(detailForm.deductions.absent) || 0) + (Number(detailForm.deductions.tax) || 0) + (Number(detailForm.deductions.other) || 0))}</span>
              </div>

              {detail.editHistory?.length ? (
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm font-semibold">Edit History</p>
                  {detail.editHistory.map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{formatDateTime(entry.changedAt, dateFormat)}</span>
                      {' '}· {entry.reason || 'No reason provided'}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => downloadDetail(detail)}>
                  <FileDown className="h-4 w-4" /> Download PDF
                </Button>
                <Button type="submit" loading={savingDetail}>Save Changes</Button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}