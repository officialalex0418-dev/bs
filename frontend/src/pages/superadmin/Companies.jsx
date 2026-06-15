import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, Package as PackageIcon, Ban } from 'lucide-react';
import { api, downloadFile } from '@/api/client';
import {
  Card, CardHeader, Button, Input, Select, Modal, Table, Badge, Spinner, Pagination,
} from '@/components/ui';

const emptyForm = {
  name: '', address: '', panVat: '', phone: '', email: '',
  packageId: '', ownerName: '', ownerEmail: '',
  logo: '',
};

export default function Companies() {
  const [data, setData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'package'
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/companies', { params: { page, search: search || undefined } });
    setData(data.data);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/packages?status=ACTIVE').then(({ data }) => setPackages(data.data.items));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (modal === 'create') await api.post('/companies', { ...form, packageId: form.packageId || null });
      else if (modal === 'edit') await api.patch(`/companies/${selected._id}`, form);
      else if (modal === 'package') await api.patch(`/companies/${selected._id}/package`, { packageId: form.packageId });
      setModal(null); setForm(emptyForm); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const suspend = async (c) => {
    if (!confirm(`Suspend "${c.name}" and deactivate all its users?`)) return;
    await api.delete(`/companies/${c._id}`);
    load();
  };

  const hardDelete = async (c) => {
    if (!confirm(`PERMANENTLY DELETE "${c.name}" and ALL its data? This cannot be undone.`)) return;
    await api.delete(`/companies/${c._id}/hard`);
    load();
  };

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Button onClick={() => { setForm(emptyForm); setModal('create'); }}>
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Search companies…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        </div>
        <Table
          columns={['Company', 'Contact', 'Package', 'Owner', 'Status', 'Actions']}
          data={data.items}
          renderRow={(c) => (
            <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-slate-400">{c.panVat || '—'}</p>
              </td>
              <td className="table-td">
                <p>{c.email}</p>
                <p className="text-xs text-slate-400">{c.phone || '—'}</p>
              </td>
              <td className="table-td">
                {c.package ? <Badge color="blue">{c.package.name}</Badge> : <Badge color="gray">None</Badge>}
              </td>
              <td className="table-td">{c.owner?.name || '—'}</td>
              <td className="table-td">
                <Badge color={c.status === 'ACTIVE' ? 'green' : c.status === 'TRIAL' ? 'yellow' : 'red'}>{c.status}</Badge>
              </td>
              <td className="table-td">
                <div className="flex gap-1">
                  <button title="Edit" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => { setSelected(c); setForm({ name: c.name, address: c.address || '', panVat: c.panVat || '', phone: c.phone || '', email: c.email, status: c.status, logo: c.logo || '' }); setModal('edit'); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button title="Assign package" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => { setSelected(c); setForm({ packageId: c.package?._id || '' }); setModal('package'); }}>
                    <PackageIcon className="h-4 w-4" />
                  </button>
                  <button title="Company PDF" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => downloadFile(`/reports/company/${c._id}/pdf`, `company-${c.name}.pdf`)}>
                    <FileDown className="h-4 w-4" />
                  </button>
                  <button title="Suspend" className="rounded p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    onClick={() => suspend(c)}>
                    <Ban className="h-4 w-4" />
                  </button>
                  <button title="Permanent Delete" className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                    onClick={() => hardDelete(c)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(c) => (
            <div key={c._id} className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </div>
                <Badge color={c.status === 'ACTIVE' ? 'green' : c.status === 'TRIAL' ? 'yellow' : 'red'}>{c.status}</Badge>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Package</p>
                  <p className="font-medium">{c.package?.name || 'No package'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Owner</p>
                  <p>{c.owner?.name || '—'}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="sm" onClick={() => { setSelected(c); setForm({ name: c.name, address: c.address || '', panVat: c.panVat || '', phone: c.phone || '', email: c.email, status: c.status, logo: c.logo || '' }); setModal('edit'); }}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setSelected(c); setForm({ packageId: c.package?._id || '' }); setModal('package'); }}>
                  <PackageIcon className="h-4 w-4 mr-1" /> Package
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadFile(`/reports/company/${c._id}/pdf`, `company-${c.name}.pdf`)}>
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-amber-600" onClick={() => suspend(c)}>
                  <Ban className="h-4 w-4 mr-1" /> Suspend
                </Button>
                <Button variant="danger" size="sm" onClick={() => hardDelete(c)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      {/* Create / Edit modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Company' : 'Edit Company'} wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Company Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Company Email *" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="PAN / VAT" value={form.panVat} onChange={(e) => setForm({ ...form, panVat: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {form.logo ? <img src={form.logo} alt="Company logo" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={() => document.getElementById('company-logo-input')?.click()}>Upload Logo</Button>
                <Input id="company-logo-input" label="Company logo data" type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setForm({ ...form, logo: reader.result });
                  reader.readAsDataURL(file);
                }} />
              </div>
            </div>
          </div>
          {modal === 'create' && (
            <>
              <Input label="Owner Name *" required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              <Input label="Owner Email *" type="email" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
              <Select label="Package" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                options={[{ value: '', label: '— No package —' }, ...packages.map((p) => ({ value: p._id, label: `${p.name} (${p.maxStaff} staff)` }))]} />
            </>
          )}
          {modal === 'edit' && (
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'TRIAL', label: 'Trial' }, { value: 'SUSPENDED', label: 'Suspended' }]} />
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>{modal === 'create' ? 'Create Company' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* Assign package modal */}
      <Modal open={modal === 'package'} onClose={() => setModal(null)} title={`Assign Package — ${selected?.name}`}>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Select label="Package" required value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}
            options={[{ value: '', label: 'Select package…' }, ...packages.map((p) => ({ value: p._id, label: `${p.name} — ${p.maxStaff} staff, ${p.trackingIntervalMinutes}min` }))]} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Assign</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
