/** Shared settings UI (branding, security) for platform + company scope. */
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useTheme } from '@/context/ThemeContext';
import { Card, CardHeader, CardBody, Button, Input, Spinner } from '@/components/ui';
import { fileToDataUrl } from '@/lib/utils';

export default function SettingsForm() {
  const { branding, setBranding } = useTheme();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const logoInputRef = useRef(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setSettings(data.data.settings));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setMessage('');
    try {
      const { data } = await api.patch('/settings', {
        branding: settings.branding, security: settings.security,
      });
      setSettings(data.data.settings);
      // Update global branding context
      if (data.data.settings.branding) {
        setBranding(data.data.settings.branding);
      }
      setMessage('Settings saved ✓');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (!settings) return <Spinner />;
  const set = (path, value) => {
    const [a, b] = path.split('.');
    setSettings({ ...settings, [a]: { ...settings[a], [b]: value } });
  };

  const updateLogo = async (file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    set('branding.logoUrl', dataUrl);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {message && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{message}</div>}

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader title="Branding" subtitle="Appearance of your workspace" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="App / Workspace Name" value={settings.branding?.appName || ''} onChange={(e) => set('branding.appName', e.target.value)} />
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {settings.branding?.logoUrl ? (
                    <img src={settings.branding.logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                      Upload Logo
                    </Button>
                    <span className="text-xs text-slate-500">Upload a logo image from your device.</span>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => updateLogo(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>
            <Input label="Primary Color" type="color" value={settings.branding?.primaryColor || '#2563eb'} onChange={(e) => set('branding.primaryColor', e.target.value)} className="h-10 w-24 p-1" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" subtitle="Authentication policies" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Session Timeout (min)" type="number" value={settings.security?.sessionTimeoutMinutes || 60} onChange={(e) => set('security.sessionTimeoutMinutes', Number(e.target.value))} />
            <Input label="Max Login Attempts" type="number" value={settings.security?.maxLoginAttempts || 5} onChange={(e) => set('security.maxLoginAttempts', Number(e.target.value))} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary-600"
                checked={!!settings.security?.enforceStrongPasswords}
                onChange={(e) => set('security.enforceStrongPasswords', e.target.checked)} />
              Enforce strong passwords
            </label>
          </CardBody>
        </Card>

        <Button type="submit" loading={saving}>Save Settings</Button>
      </form>
    </div>
  );
}
