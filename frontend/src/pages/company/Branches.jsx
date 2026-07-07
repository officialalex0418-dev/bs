import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Badge, Spinner, Table, Select } from '@/components/ui';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

const emptyForm = {
  name: '',
  lat: 27.7172,
  lng: 85.3240,
  radius: 100,
  status: 'ACTIVE',
};

export default function Branches() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [markerPos, setMarkerPos] = useState([emptyForm.lat, emptyForm.lng]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/company-config/branches');
    setItems(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        location: { type: 'Point', coordinates: [markerPos[1], markerPos[0]] },
        radius: Number(form.radius),
        status: form.status,
      };
      if (editing) await api.patch(`/company-config/branches/${editing._id}`, body);
      else await api.post('/company-config/branches', body);
      setModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete branch "${item.name}"?`)) return;
    await api.delete(`/company-config/branches/${item._id}`);
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company Branches</h1>
        <Button onClick={() => {
          setEditing(null);
          setForm(emptyForm);
          setMarkerPos([emptyForm.lat, emptyForm.lng]);
          setModal(true);
        }}>
          <Plus className="h-4 w-4" /> New Branch
        </Button>
      </div>

      <Card>
        <Table
          columns={['Branch Name', 'Location', 'Radius', 'Status', 'Actions']}
          data={items}
          renderRow={(item) => (
            <tr key={item._id}>
              <td className="table-td font-bold">{item.name}</td>
              <td className="table-td text-xs text-slate-500">
                {item.location.coordinates[1].toFixed(5)}, {item.location.coordinates[0].toFixed(5)}
              </td>
              <td className="table-td">{item.radius}m</td>
              <td className="table-td">
                <Badge color={item.status === 'ACTIVE' ? 'green' : 'gray'}>{item.status}</Badge>
              </td>
              <td className="table-td">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditing(item);
                    setForm({ ...item, lat: item.location.coordinates[1], lng: item.location.coordinates[0] });
                    setMarkerPos([item.location.coordinates[1], item.location.coordinates[0]]);
                    setModal(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${editing.name}` : 'New Branch'} wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Input label="Branch Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Geofence Radius (meters) *" type="number" min="10" required value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
              <p className="font-bold mb-1"><MapPin className="h-3 w-3 inline mr-1" /> Selected Coordinates:</p>
              <p>Lat: {markerPos[0].toFixed(6)}</p>
              <p>Lng: {markerPos[1].toFixed(6)}</p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" loading={saving}>{editing ? 'Save' : 'Create'}</Button>
            </div>
          </div>
          <div className="h-[400px] overflow-hidden rounded-xl border border-slate-200 shadow-inner">
            <MapContainer center={markerPos} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationPicker position={markerPos} setPosition={setMarkerPos} />
              <Circle center={markerPos} radius={form.radius} pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }} />
            </MapContainer>
            <p className="p-2 text-center text-[10px] text-slate-400 bg-white">Click on the map to mark branch location</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
