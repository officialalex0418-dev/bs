/** Shared payroll UI for super admin (scope=system) and company panel. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Wallet, FileDown, CheckCircle2, FileText } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, Button, Input, Table, Badge, Spinner, Pagination, Modal, Select, Textarea, DatePicker, MonthPicker } from '@/components/ui';
import { formatMoney, formatDateTime, toNepaliMonth, adToBs } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyForm = {
  basicSalary: 0,
  dailyAllowance: 0,
  allowance: 0,
  bonus: 0,
  deductions: { absent: 0, tax: 0, other: 0 },
  presentDays: 0,
  workingDays: 0,
  paidLeaveDays: 0,
  status: 'GENERATED',
  paidAt: '',
  remarks: '',
};

export default function PayrollManager({ scope }) {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(() => {
    if (dateFormat === 'BS') {
      const bs = adToBs(new Date());
      return `${bs.year}-${String(bs.month).padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 7);
  });
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
    let currentMonth;
    if (dateFormat === 'BS') {
      const bs = adToBs(new Date());
      currentMonth = `${bs.year}-${String(bs.month).padStart(2, '0')}`;
    } else {
      currentMonth = new Date().toISOString().slice(0, 7);
    }

    if (month > currentMonth) {
      setMessage('Cannot generate payroll for future months');
      return;
    }
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
        dailyAllowance: payroll.dailyAllowance || 0,
        allowance: payroll.allowance || 0,
        bonus: payroll.bonus || 0,
        deductions: {
          absent: payroll.deductions?.absent || 0,
          tax: payroll.deductions?.tax || 0,
          other: payroll.deductions?.other || 0,
        },
        presentDays: payroll.presentDays || 0,
        workingDays: payroll.workingDays || 0,
        paidLeaveDays: payroll.paidLeaveDays || 0,
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

  // Real-time calculation logic for the form
  const calculatedFields = useMemo(() => {
    const basic = Number(detailForm.basicSalary) || 0;
    const dailyAllow = Number(detailForm.dailyAllowance) || 0;
    const present = Number(detailForm.presentDays) || 0;
    const working = Number(detailForm.workingDays) || 0;
    const paidLeave = Number(detailForm.paidLeaveDays) || 0;
    const bonus = Number(detailForm.bonus) || 0;
    const otherDeduction = Number(detailForm.deductions.other) || 0;

    const absentDays = Math.max(working - (present + paidLeave), 0);

    // Total Allowances = Present Days * Allowances per day
    const totalAllowance = Math.round(present * dailyAllow);

    // Absent Deduction = ((Basic Salary * 12) / 365) * No of Absent Days
    const dailyRate = (basic * 12) / 365;
    const absentDeduction = Math.round(dailyRate * absentDays);

    // Tax Deduction = (Basic Salary - Absent Deduction) * 1%
    const taxDeduction = Math.round(Math.max(basic - absentDeduction, 0) * 0.01);

    const totalDeductions = absentDeduction + taxDeduction + otherDeduction;

    // Net Payable Amount = Basic Salary - Absent deduction - Tax Deduction + Total allowances + Bonus
    const netSalary = Math.max(Math.round(basic - absentDeduction - taxDeduction + totalAllowance + bonus - otherDeduction), 0);

    return {
      absentDays,
      totalAllowance,
      absentDeduction,
      taxDeduction,
      totalDeductions,
      netSalary
    };
  }, [detailForm]);

  const saveDetail = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const payload = {
        basicSalary: Number(detailForm.basicSalary),
        dailyAllowance: Number(detailForm.dailyAllowance),
        allowance: calculatedFields.totalAllowance,
        bonus: Number(detailForm.bonus),
        deductions: {
          absent: calculatedFields.absentDeduction,
          tax: calculatedFields.taxDeduction,
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
      setMessage('Payroll updated successfully.');
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
          <MonthPicker
            className="w-44"
            value={month}
            onChange={(val) => { setMonth(val); setPage(1); }}
            max={new Date().toISOString().slice(0, 7)}
          />
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
              <td className="table-td">{dateFormat === 'BS' ? toNepaliMonth(p.month) : p.month}</td>
              <td className="table-td">{formatMoney(p.basicSalary)}</td>
              <td className="table-td text-emerald-600">+{formatMoney(p.allowance)}</td>
              <td className="table-td text-red-500">−{formatMoney((p.deductions?.absent || 0) + (p.deductions?.tax || 0) + (p.deductions?.other || 0))}</td>
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
                  <p className="text-xs text-slate-500">{dateFormat === 'BS' ? toNepaliMonth(p.month) : p.month} · {p.presentDays}/{p.workingDays} days</p>
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
              <Card className="p-4 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm font-semibold">Staff Information</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{detail.staff?.name}</p>
                <p className="text-xs text-slate-400">{detail.staff?.email}</p>
                <p className="text-xs text-slate-400">{detail.staff?.position || 'Staff'}</p>
              </Card>
              <Card className="p-4 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm font-semibold">Payroll Summary</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Month: {dateFormat === 'BS' ? toNepaliMonth(detail.month) : detail.month}</p>
                <p className="text-sm font-bold text-primary-600">Net Payable: {formatMoney(calculatedFields.netSalary)}</p>
                <p className="text-xs text-slate-400">Status: {detail.status}</p>
              </Card>
            </div>

            <form onSubmit={saveDetail} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="Basic Salary" type="number" min="0" value={detailForm.basicSalary}
                  onChange={(e) => setDetailForm({ ...detailForm, basicSalary: e.target.value })} />

                <Input label="Allowances per day" type="number" min="0" value={detailForm.dailyAllowance}
                  onChange={(e) => setDetailForm({ ...detailForm, dailyAllowance: e.target.value })} />

                <Input label="Bonus" type="number" min="0" value={detailForm.bonus}
                  onChange={(e) => setDetailForm({ ...detailForm, bonus: e.target.value })} />

                <Input label="Working Days" type="number" min="1" value={detailForm.workingDays}
                  onChange={(e) => setDetailForm({ ...detailForm, workingDays: e.target.value })} />

                <Input label="Present Days" type="number" min="0" value={detailForm.presentDays}
                  onChange={(e) => setDetailForm({ ...detailForm, presentDays: e.target.value })} />

                <Input label="Absent Days" type="number" disabled value={calculatedFields.absentDays} />

                <div className="space-y-1">
                    <label className="text-sm font-medium">Total Allowances</label>
                    <div className="input bg-slate-100 dark:bg-slate-800 flex items-center h-10 px-3 text-sm text-slate-600">
                        {formatMoney(calculatedFields.totalAllowance)}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Present Days × Allowances/day</p>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium">Absent Deduction</label>
                    <div className="input bg-red-50 dark:bg-red-900/10 flex items-center h-10 px-3 text-sm text-red-600">
                        {formatMoney(calculatedFields.absentDeduction)}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">((Salary × 12)/365) × Absent Days</p>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium">Tax Deduction (1%)</label>
                    <div className="input bg-red-50 dark:bg-red-900/10 flex items-center h-10 px-3 text-sm text-red-600">
                        {formatMoney(calculatedFields.taxDeduction)}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">(Salary - Absent Ded.) × 1%</p>
                </div>

                <Input label="Other Deduction" type="number" min="0" value={detailForm.deductions.other}
                  onChange={(e) => setDetailForm({ ...detailForm, deductions: { ...detailForm.deductions, other: e.target.value } })} />

                <DatePicker label="Paid At" value={detailForm.paidAt || ''}
                  onChange={(val) => setDetailForm({ ...detailForm, paidAt: val })} />

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
              </div>

              <Textarea
                label="Remarks / reason for edit"
                value={detailForm.remarks}
                onChange={(e) => setDetailForm({ ...detailForm, remarks: e.target.value })}
                placeholder="Add the reason for this change"
              />

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl bg-primary-50 px-6 py-6 text-sm dark:bg-primary-900/10 border-2 border-primary-100 dark:border-primary-900/30 shadow-inner">
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <span className="text-[10px] text-primary-600 dark:text-primary-400 uppercase font-extrabold tracking-[0.2em] mb-1">Final Disbursable Amount</span>
                    <span className="text-3xl font-black text-primary-800 dark:text-primary-100 leading-none">{formatMoney(calculatedFields.netSalary)}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-4 md:gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Gross Additions</span>
                        <span className="text-sm font-bold text-emerald-600">+{formatMoney(Number(detailForm.basicSalary) + calculatedFields.totalAllowance + Number(detailForm.bonus))}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Deductions</span>
                        <span className="text-sm font-bold text-red-600">−{formatMoney(calculatedFields.totalDeductions)}</span>
                    </div>
                </div>
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

              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => downloadDetail(detail)} className="px-6">
                  <FileDown className="h-4 w-4 mr-2" /> Download PDF
                </Button>
                <Button type="submit" loading={savingDetail} className="px-8">Save Changes</Button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
