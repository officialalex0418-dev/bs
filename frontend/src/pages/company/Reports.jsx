import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, MapPin, CalendarCheck, TrendingUp, Wallet } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, CardHeader, CardBody, Button, Select, MonthPicker } from '@/components/ui';

export default function Reports() {
  const [trackingPeriod, setTrackingPeriod] = useState('daily');
  const [salesPeriod, setSalesPeriod] = useState('monthly');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState('');
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState('');

  useEffect(() => {
    api.get('/staff?limit=200').then(({ data }) => {
      setStaff((data.data.items || []).filter((item) => ['STAFF', 'COMPANY_MANAGER'].includes(item.role)));
    });
  }, []);

  const dl = async (key, url, filename) => {
    setBusy(key);
    try { await downloadFile(url, filename); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Exports</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Tracking Report" subtitle="Location pings per staff" action={<MapPin className="h-5 w-5 text-primary-500" />} />
          <CardBody className="space-y-3">
            <Select label="Period" value={trackingPeriod} onChange={(e) => setTrackingPeriod(e.target.value)}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
            <Button className="w-full" loading={busy === 'tracking'}
              onClick={() => dl('tracking', `/reports/tracking/excel?period=${trackingPeriod}`, `tracking-${trackingPeriod}.xlsx`)}>
              <FileSpreadsheet className="h-4 w-4" /> Download Excel
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Attendance Report" subtitle="Check-ins, late days" action={<CalendarCheck className="h-5 w-5 text-primary-500" />} />
          <CardBody className="space-y-3">
            <MonthPicker label="Month" value={month} onChange={(val) => setMonth(val)} />
            <Button className="w-full" loading={busy === 'attendance'}
              onClick={() => dl('attendance', `/reports/attendance/excel?month=${month}`, `attendance-${month}.xlsx`)}>
              <FileSpreadsheet className="h-4 w-4" /> Download Excel
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Individual Staff PDF" subtitle="Branded summary" action={<FileText className="h-5 w-5 text-primary-500" />} />
          <CardBody className="space-y-3">
            <Select
              label="Staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              options={[{ value: '', label: 'Choose staff…' }, ...staff.map((s) => ({ value: s._id, label: `${s.name} · ${s.position || 'Staff'}` }))]}
            />
            <Button
              className="w-full"
              disabled={!staffId}
              loading={busy === 'staff-pdf'}
              onClick={() => dl('staff-pdf', `/reports/employee/${staffId}/pdf`, `staff-${staffId}.pdf`)}
            >
              <FileText className="h-4 w-4" /> Download Staff PDF
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sales Report" subtitle="All sales entries" action={<TrendingUp className="h-5 w-5 text-primary-500" />} />
          <CardBody className="space-y-3">
            <Select label="Period" value={salesPeriod} onChange={(e) => setSalesPeriod(e.target.value)}
              options={[
                { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Last 30 Days' }, { value: '3months', label: '3 Months' }, { value: '6months', label: '6 Months' },
              ]} />
            <Button className="w-full" loading={busy === 'sales'}
              onClick={() => dl('sales', `/reports/sales/excel?period=${salesPeriod}`, `sales-${salesPeriod}.xlsx`)}>
              <FileSpreadsheet className="h-4 w-4" /> Download Excel
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payroll Report" subtitle="Salary slips per month" action={<Wallet className="h-5 w-5 text-primary-500" />} />
          <CardBody className="space-y-3">
            <MonthPicker label="Month" value={month} onChange={(val) => setMonth(val)} />
            <Button className="w-full" loading={busy === 'payroll'}
              onClick={() => dl('payroll', `/reports/payroll/excel?month=${month}`, `payroll-${month}.xlsx`)}>
              <FileSpreadsheet className="h-4 w-4" /> Download Excel
            </Button>
          </CardBody>
        </Card>

        <Card className="flex flex-col justify-center bg-primary-50 dark:bg-primary-900/10">
          <CardBody className="text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-primary-500" />
            <p className="text-sm font-medium text-primary-900 dark:text-primary-100">Need custom reports?</p>
            <p className="mt-1 text-xs text-primary-700 dark:text-primary-300">
              Individual employee PDFs are also available directly on the Staff Management page.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
