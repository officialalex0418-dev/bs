import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, FileDown, Package as PackageIcon, Ban, MapPin, Crosshair } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { api, downloadFile } from '@/api/client';
import {
  Card, CardHeader, Button, Input, Select, Modal, Table, Badge, Spinner, Pagination,
} from '@/components/ui';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [27.7172, 85.3240]; // Kathmandu

function MapPicker({ coords, radius, onLocationChange }) {
  const mapRef = useRef();

  function LocationMarker() {
    useMapEvents({
      click(e) {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      },
    });

    return coords ? (
      <>
        <Marker position={coords} />
        <Circle center={coords} radius={radius} pathOptions={{ color: '#2563eb', fillColor: '#2563eb' }} />
      </>
    ) : null;
  }

  return (
    <div className="h-[300px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <MapContainer center={coords || DEFAULT_CENTER} zoom={15} scrollWheelZoom={false} className="h-full w-full" ref={mapRef}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
        <LocationMarker />
      </MapContainer>
    </div>
  );
}

const emptyForm = {
  name: '', address: '', panVat: '', phone: '', email: '',
  packageId: '', ownerName: '', ownerEmail: '',
  logo: '',
  lat: 27.7172,
  lng: 85.324,
  checkInRadiusMeters: 100,
  settings: {
    dateFormat: 'BS',
    language: 'English'
  }
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
      const payload = {
        ...form,
        location: { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] },
        checkInRadiusMeters: Number(form.checkInRadiusMeters),
      };

      if (modal === 'create') await api.post('/companies', { ...payload, packageId: form.packageId || null });
      else if (modal === 'edit') await api.patch(`/companies/${selected._id}`, payload);
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
                    onClick={() => {
                      setSelected(c);
                      setForm({
                        name: c.name,
                        address: c.address || '',
                        panVat: c.panVat || '',
                        phone: c.phone || '',
                        email: c.email,
                        status: c.status,
                        logo: c.logo || '',
                        lat: c.location?.coordinates?.[1] || 27.7172,
                        lng: c.location?.coordinates?.[0] || 85.324,
                        checkInRadiusMeters: c.checkInRadiusMeters || 100,
                        settings: {
                          dateFormat: c.settings?.dateFormat || 'AD',
                          language: c.settings?.language || 'English'
                        }
                      });
                      setModal('edit');
                    }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button title="Assign package" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => { setSelected(c); setForm({ ...emptyForm, packageId: c.package?._id || '' }); setModal('package'); }}>
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
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Company' : 'Edit Company'} wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Company Information</h3>
            <Input label="Company Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Company Email *" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="PAN / VAT" value={form.panVat} onChange={(e) => setForm({ ...form, panVat: e.target.value })} />
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {form.logo ? <img src={form.logo} alt="Company logo" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('company-logo-input')?.click()}>Upload Logo</Button>
                <input id="company-logo-input" className="hidden" type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setForm({ ...form, logo: reader.result });
                  reader.readAsDataURL(file);
                }} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Location & Geofencing</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-500">Click on the map to set office location</p>
              <MapPicker
                coords={[form.lat, form.lng]}
                radius={form.checkInRadiusMeters}
                onLocationChange={(lat, lng) => setForm({ ...form, lat, lng })}
              />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <p className="text-slate-400">Latitude</p>
                  <p className="font-mono font-medium">{form.lat?.toFixed(6) || '—'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <p className="text-slate-400">Longitude</p>
                  <p className="font-mono font-medium">{form.lng?.toFixed(6) || '—'}</p>
                </div>
              </div>
            </div>
            <Input
              label="Geofence Radius (meters) *"
              type="number"
              required
              value={form.checkInRadiusMeters}
              onChange={(e) => setForm({ ...form, checkInRadiusMeters: e.target.value })}
              placeholder="e.g. 100"
            />
          </div>

          <div className="sm:col-span-2 space-y-4 pt-4 border-t">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">System Preferences</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Date Format"
                value={form.settings.dateFormat}
                onChange={(e) => setForm({ ...form, settings: { ...form.settings, dateFormat: e.target.value } })}
                options={[{ value: 'AD', label: 'AD (English Date)' }, { value: 'BS', label: 'BS (Nepali Date)' }]}
              />
              <Select
                label="System Language"
                value={form.settings.language}
                onChange={(e) => setForm({ ...form, settings: { ...form.settings, language: e.target.value } })}
                options={[{ value: 'English', label: 'English' }, { value: 'Nepali', label: 'Nepali' }]}
              />
            </div>
          </div>

          <div className="sm:col-span-2 space-y-4 pt-4 border-t">
            {modal === 'create' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Owner Name *" required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                <Input label="Owner Email *" type="email" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                <Select label="Initial Package" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                  options={[{ value: '', label: '— No package —' }, ...packages.map((p) => ({ value: p._id, label: `${p.name} (${p.maxStaff} staff)` }))]} />
              </div>
            )}
            {modal === 'edit' && (
              <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'TRIAL', label: 'Trial' }, { value: 'SUSPENDED', label: 'Suspended' }]} />
            )}
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>{modal === 'create' ? 'Create Company' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

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
