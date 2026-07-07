import { useEffect, useState, useCallback } from 'react';
import { Wallet, Download, Clock, TrendingUp, MinusCircle, PlusCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, CardBody, Table, Badge, Spinner, Button, Modal } from '@/components/ui';
import { formatMoney } from '@/lib/utils';

export default function StaffPayroll() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/payroll');
      setData(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const viewDetail = async (id) => {
    try {
      const { data } = await api.get(`/payroll/${id}`);
      setSelected(data.data.payroll);
    } catch (err) {
      alert('Failed to load payroll details');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Payroll</h1>
        <Wallet className="h-6 w-6 text-primary-600" />
      </div>

      <Card>
        <CardHeader title="Salary History" subtitle="View your monthly salary slips and payment status" />
        <Table
          columns={['Month', 'Basic Salary', 'Allowance', 'Net Salary', 'Status', 'Action']}
          data={data.items}
          renderRow={(p) => (
            <tr key={p._id}>
              <td className="table-td font-bold">{p.month}</td>
              <td className="table-td">{formatMoney(p.basicSalary)}</td>
              <td className="table-td">{formatMoney(p.allowance)}</td>
              <td className="table-td font-bold text-primary-600">{formatMoney(p.netSalary)}</td>
              <td className="table-td">
                <Badge color={p.status === 'PAID' ? 'green' : 'yellow'}>{p.status}</Badge>
              </td>
              <td className="table-td">
                <Button variant="ghost" size="sm" onClick={() => viewDetail(p._id)}>View Details</Button>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Payroll Details - ${selected?.month}`} wide>
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-emerald-500" /> Earnings
                </h3>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Basic Salary</span>
                    <span className="font-medium">{formatMoney(selected.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Allowances ({selected.presentDays} days)</span>
                    <span className="font-medium">{formatMoney(selected.allowance)}</span>
                  </div>
                  {selected.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bonus</span>
                      <span className="font-medium text-emerald-600">+{formatMoney(selected.bonus)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t flex justify-between font-bold">
                    <span>Gross Salary</span>
                    <span>{formatMoney(selected.breakdown.gross)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-red-500" /> Deductions
                </h3>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Absent Deduction</span>
                    <span className="font-medium text-red-500">-{formatMoney(selected.breakdown.deductions.absent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax / SST</span>
                    <span className="font-medium text-red-500">-{formatMoney(selected.breakdown.deductions.tax)}</span>
                  </div>
                  {selected.breakdown.deductions.other > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Other Deductions</span>
                      <span className="font-medium text-red-500">-{formatMoney(selected.breakdown.deductions.other)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t flex justify-between font-bold">
                    <span>Total Deductions</span>
                    <span className="text-red-500">{formatMoney(selected.breakdown.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-primary-600 p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-primary-100 text-sm font-medium">Net Receivable Salary</p>
                <h2 className="text-3xl font-bold">{formatMoney(selected.netSalary)}</h2>
              </div>
              <div className="text-right hidden md:block">
                <p className="text-primary-100 text-sm">Payment Status</p>
                <Badge color={selected.status === 'PAID' ? 'white' : 'yellow'} className="mt-1">
                  {selected.status}
                </Badge>
              </div>
              <Button variant="white" className="w-full md:w-auto">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400 italic">
              This is a computer-generated salary slip. If you find any discrepancy, please contact the HR department.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
