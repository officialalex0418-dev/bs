import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Save, ArrowLeft, Building2, Globe, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Card, CardBody, Button, Input, Textarea, Select } from '@/components/ui';
import { fileToDataUrl } from '@/lib/utils';

export default function CompanyEditProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    panVat: '',
    address: '',
    phone: '',
    website: '',
    description: '',
    additionalInfo: '',
    logo: '',
    registrationNumber: '',
    settings: {
      dateFormat: 'BS',
      language: 'English',
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/companies/me').then(({ data }) => {
      const c = data.data.company;
      setForm({
        name: c.name || '',
        panVat: c.panVat || '',
        address: c.address || '',
        phone: c.phone || '',
        website: c.website || '',
        description: c.description || '',
        additionalInfo: c.additionalInfo || '',
        logo: c.logo || '',
        registrationNumber: c.registrationNumber || '',
        settings: {
          dateFormat: c.settings?.dateFormat || 'AD',
          language: c.settings?.language || 'English',
        },
      });
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.patch('/companies/me', form);
      await refreshUser();
      setSuccess('Profile updated successfully ✓');
      setTimeout(() => navigate('/company/settings'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm({ ...form, logo: dataUrl });
    } catch (e) {
      setError('Failed to process image');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/company/settings')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Edit Company Profile</h1>
      </div>

      {success && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{success}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      <Card>
        <CardBody>
          <form onSubmit={submit} className="space-y-8">
            <div className="flex flex-col items-center gap-4 border-b border-slate-100 pb-8 dark:border-slate-800">
              <div className="group relative">
                <div className="h-32 w-32 overflow-hidden rounded-2xl border-4 border-slate-100 bg-slate-50 shadow-md dark:border-slate-800">
                  {form.logo ? (
                    <img src={form.logo} alt="Company logo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Building2 className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
              <p className="text-xs text-slate-500">Update company logo</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Input label="Company Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Registration Number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
              <Input label="PAN / VAT Number" value={form.panVat} onChange={(e) => setForm({ ...form, panVat: e.target.value })} />
              <Input label="Contact Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Website" placeholder="https://..." value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <Input label="Company Email (Non-Editable)" value={user?.email} disabled className="bg-slate-50 dark:bg-slate-800" />

              <div className="sm:col-span-2">
                <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <Textarea label="Company Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <Textarea label="Additional Information" value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })} />
              </div>

              <div className="col-span-full border-t pt-6 dark:border-slate-800">
                <h3 className="mb-4 font-bold text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2">
                  <Globe className="h-4 w-4" /> System Preferences
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-8 dark:border-slate-800">
              <Button type="submit" loading={loading} className="flex-1">
                <Save className="h-4 w-4" /> Save Profile
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/company/settings')} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
