import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button, Input, Card } from '@/components/ui';
import { ROLE_HOME } from '@/lib/utils';

export default function ChangePassword() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError('Passwords do not match');

    setError(''); setLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      // Update user state to reflect change
      if (user) {
        const updatedUser = { ...user, needsPasswordChange: false };
        setUser(updatedUser);
        navigate(ROLE_HOME[updatedUser.role] || '/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Update Your Password</h1>
          <p className="text-sm text-slate-500">For security reasons, you must change your temporary password before continuing.</p>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <Input label="Current (Temporary) Password" type="password" required value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          <Input label="New Password" type="password" required minLength={8} value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <Input label="Confirm New Password" type="password" required value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} />

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" loading={loading} className="w-full">Update & Continue</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={async () => { await logout(); navigate('/login'); }}>
              Cancel & Logout
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
