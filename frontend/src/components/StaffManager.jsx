/**
 * Reusable employee CRUD table.
 */
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, UserMinus, X, RefreshCw } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import { Card, Button, Input, Select, Modal, Table, Badge, Spinner, Pagination } from '@/components/ui';
import { formatMoney, cn } from '@/lib/utils';

const emptyForm = {
  name: '', email: '', phone: '', address: '', pan: '', position: '',
  basicSalary: 0, allowances: 0, monthlyTarget: 0, role: 'STAFF', designation: '',
  workMode: 'OUTDOOR', branch: 'MAIN', shift: '',
  allowedMobileCount: 1, allowedWebCount: 1,
};

export default function StaffManager({ mode = 'company', companyId = null, allowCompanySelection = false }) {
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || '');

  useEffect(() => {
    if (companyId) setSelectedCompanyId(companyId);
  }, [companyId]);

  useEffect(() => {
    if (mode === 'company') {
      api.get('/company-config/designations').then(({ data }) => setDesignations(data.data)).catch(() => {});
      api.get('/company-config/branches').then(({ data }) => setBranches(data.data)).catch(() => {});
      api.get('/company-config/shifts').then(({ data }) => setShifts(data.data)).catch(() => {});
    }
    if (mode === 'system') {
      api.get('/designations').then(res => setDesignations(res.data.data));
    }
    if (!allowCompanySelection) return;
    (async () => {
      const { data: response } = await api.get('/companies', { params: { limit: 200 } });
      const items = response.data.items || [];
      setCompanies(items);
      if (!selectedCompanyId && items.length) setSelectedCompanyId(items[0]._id);
    })();
  }, [allowCompanySelection, selectedCompanyId, mode]);

  const load = useCallback(async () => {
    const params = { page, search: search || undefined };
    if (mode === 'system') params.scope = 'system';
    if (mode === 'company' && (companyId || selectedCompanyId)) params.companyId = companyId || selectedCompanyId;
    if (allowCompanySelection && !params.companyId) {
      setData({ items: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } });
      return;
    }
    const { data } = await api.get('/staff', { params });
    setData(data.data);
  }, [page, search, mode, companyId, selectedCompanyId, allowCompanySelection]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        basicSalary: mode === 'system' ? 0 : Number(form.basicSalary),
        allowances: mode === 'system' ? 0 : Number(form.allowances),
        monthlyTarget: Number(form.monthlyTarget),
        role: mode === 'system' ? 'ADMIN_EMPLOYEE' : form.role,
        designation: form.designation || undefined,
        shift: form.shift || undefined,
        companyId: mode === 'company' ? (companyId || selectedCompanyId || undefined) : undefined,
        workMode: form.workMode,
        branch: form.workMode === 'INDOOR' ? (form.branch === 'MAIN' ? null : (form.branch || null)) : null,
        allowedMobileCount: Number(form.allowedMobileCount),
        allowedWebCount: Number(form.allowedWebCount),
      };
      if (editing) {
        delete body.email; delete body.role;
        await api.patch(`/staff/${editing._id}`, body);
      } else {
        await api.post('/staff', body);
      }
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const deactivate = async (u) => {
    if (!confirm(`Deactivate ${u.name}?`)) return;
    await api.delete(`/staff/${u._id}`);
    load();
  };

  const authorizeReset = async (u) => {
    if (!confirm(`Authorize device reset for ${u.name}? They will be able to login from a new device once.`)) return;
    try {
      await api.patch(`/staff/${u._id}/authorize-device-reset`);
      alert(`Success: ${u.name} can now login from a new device.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Authorization failed');
    }
  };

  const hardDelete = async (u) => {
    if (!confirm(`PERMANENTLY DELETE ${u.name}? This cannot be undone.`)) return;
    await api.delete(`/staff/${u._id}/hard`);
    load();
  };

  if (!data) return <Spinner />;
  const companyOptions = companies.map((c) => ({ value: c._id, label: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{mode === 'system' ? 'System Employees' : 'Employee Management'}</h1>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }} disabled={allowCompanySelection && !selectedCompanyId}>
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {allowCompanySelection && (
        <Card>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label="Select Company"
              value={selectedCompanyId}
              onChange={(e) => { setSelectedCompanyId(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'Choose a company…' }, ...companyOptions]}
            />
            <p className="text-sm text-slate-500">Manage employees for the selected company.</p>
          </div>
        </Card>
      )}

      <Card>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Search by name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        </div>
        <Table
          columns={mode === 'system'
            ? ['Name', 'Contact', 'Designation', 'Status', 'Actions']
            : ['Name', 'Contact', 'Position', 'Designation', 'Salary', 'Status', 'Actions']
          }
          data={data.items}
          renderRow={(u) => (
            <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                    {u.name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-[9px] uppercase font-bold text-primary-600 bg-primary-50 px-1 rounded">{u.workMode}</p>
                      {u.workMode === 'INDOOR' && (
                        <p className="text-[9px] text-slate-500 italic">
                           ({u.branch?.name || 'Main Office'})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="table-td">
                <p>{u.email}</p>
                <p className="text-xs text-slate-400">{u.phone || '—'}</p>
              </td>
              {mode === 'company' && <td className="table-td">{u.position || '—'}</td>}
              <td className="table-td">
                <Badge color="blue">{u.designation?.name || (mode === 'system' ? (u.subRole || 'ADMIN') : u.role.replace('COMPANY_', ''))}</Badge>
              </td>
              {mode === 'company' && (
                <td className="table-td">
                  <p>{formatMoney(u.basicSalary)}</p>
                  <p className="text-xs text-slate-400">+{formatMoney((u.allowances || 0) + (u.dailyAllowance || 0))}</p>
                </td>
              )}
              <td className="table-td">
                <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="table-td">
                <div className="flex gap-1">
                  <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit"
                    onClick={() => { setEditing(u); setForm({ ...emptyForm, ...u, designation: u.designation?._id || '', branch: u.branch?._id || 'MAIN', shift: u.shift?._id || '' }); setModal(true); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  {mode === 'company' && (
                    <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Employee PDF"
                      onClick={() => downloadFile(`/reports/employee/${u._id}/pdf`, `employee-${u.name}.pdf`)}>
                      <FileDown className="h-4 w-4" />
                    </button>
                  )}
                  <button className="rounded p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30" title="Deactivate"
                    onClick={() => deactivate(u)}>
                    <UserMinus className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Reset Device"
                    onClick={() => authorizeReset(u)}>
                    <RefreshCw className={cn("h-4 w-4", u.deviceResetRequested && "animate-spin")} />
                  </button>
                  <button className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" title="Permanent Delete"
                    onClick={() => hardDelete(u)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(u) => (
            <div key={u._id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                    {u.name?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-[9px] uppercase font-bold text-primary-600">{u.workMode}</p>
                      {u.workMode === 'INDOOR' && (
                        <p className="text-[9px] text-slate-500 italic">
                           ({u.branch?.name || 'Main Office'})
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{u.designation?.name || u.position || 'No Designation'}</p>
                  </div>
                </div>
                <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Contact</p>
                  <p className="truncate">{u.email}</p>
                  <p className="text-slate-500">{u.phone || '—'}</p>
                </div>
                {mode === 'company' && (
                  <div className="col-span-2 flex justify-between pt-1">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Basic Salary</p>
                      <p>{formatMoney(u.basicSalary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Allowances</p>
                      <p>+{formatMoney((u.allowances || 0) + (u.dailyAllowance || 0))}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="sm" onClick={() => { setEditing(u); setForm({ ...emptyForm, ...u, designation: u.designation?._id || '', branch: u.branch?._id || 'MAIN', shift: u.shift?._id || '' }); setModal(true); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-amber-600" onClick={() => deactivate(u)}>
                  <UserMinus className="h-4 w-4 mr-1" /> Deactivate
                </Button>
                <Button variant="outline" size="sm" className="text-blue-600" onClick={() => authorizeReset(u)}>
                  <RefreshCw className={cn("h-4 w-4 mr-1", u.deviceResetRequested && "animate-spin")} /> Reset Device
                </Button>
                <Button variant="danger" size="sm" onClick={() => hardDelete(u)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? `Edit ${editing.name}` : `Add Employee`} wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email *" type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />

          <Select label="Designation *" required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
            options={[
              { value: '', label: 'Select Designation…' },
              ...designations.map(d => ({
                value: d._id,
                label: d.department?.name ? `${d.name} (${d.department.name})` : d.name
              }))
            ]} />

          <Select label="Work Mode" value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}
            options={[{ value: 'INDOOR', label: 'Indoor (Office Radius)' }, { value: 'OUTDOOR', label: 'Outdoor (Anywhere)' }]} />

          {form.workMode === 'INDOOR' && (
            <Select label="Linked Office / Branch *" required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}
              options={[{ value: 'MAIN', label: 'Main Office (Company Location)' }, ...branches.map(b => ({ value: b._id, label: b.name }))]} />
          )}

          <Select label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}
            options={[
              { value: '', label: 'No Specific Shift' },
              ...shifts.map(s => ({ value: s._id, label: `${s.name} (${s.startTime} - ${s.endTime})` }))
            ]} />

          <Input label="Basic Salary" type="number" min="0" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
          <Input label="Allowances" type="number" min="0" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} />

          <Input label="Allowed Mobile Devices" type="number" min="1" value={form.allowedMobileCount} onChange={(e) => setForm({ ...form, allowedMobileCount: e.target.value })} />
          <Input label="Allowed Web Sessions" type="number" min="1" value={form.allowedWebCount} onChange={(e) => setForm({ ...form, allowedWebCount: e.target.value })} />

          {mode === 'company' && (
            <Input label="Monthly Sales Target" type="number" min="0" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} />
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setForm(emptyForm)}>Reset</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
