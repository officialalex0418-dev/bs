import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button, Input, Card } from '@/components/ui';
import { ROLE_HOME } from '@/lib/utils';

export default function Login() {
  const { login } = useAuth();
  const { branding } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(ROLE_HOME[user.role] || '/login');
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg + (err.code ? ` (${err.code})` : ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary-600 text-white">
            {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <MapPin className="h-7 w-7" />}
          </div>
          <h1 className="text-2xl font-bold">{branding.appName}</h1>
          <p className="text-sm text-slate-500">Employee Tracking & Business Management</p>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
          <Input label="Password" type="password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          <Button type="submit" loading={loading} className="w-full">Sign In</Button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">Forgot password?</Link>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
          <p className="font-semibold">Demo accounts (after seeding):</p>
          <p>Super Admin — admin@businesssarthi.com / SuperAdmin@123</p>
          <p>Owner — owner@himalayatraders.com / Owner@1234</p>
          <p>Staff — hari@himalayatraders.com / Staff@1234</p>
        </div>
      </Card>
    </div>
  );
}
