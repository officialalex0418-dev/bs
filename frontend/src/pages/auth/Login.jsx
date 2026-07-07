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
      const msg = err.response?.data?.message?.toLowerCase() || '';

      if (msg.includes('invalid') || msg.includes('password')) {
        setError('Incorrect email or password. Please try again or reset your password if you forgot it.');
      } else if (msg.includes('suspended') || msg.includes('deactivated')) {
        setError('Your account has been suspended or deactivated. Please contact your company administrator.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Unable to reach the server. Please check your internet connection and try again.');
      } else {
        setError('Something went wrong during sign-in. Please wait a moment and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-emerald-900 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-sm">
            {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <MapPin className="h-7 w-7 text-primary-600" />}
          </div>
          <h1 className="text-2xl font-bold">{branding.appName}</h1>
          <p className="text-sm text-slate-500">{branding.tagline || 'Driving Your Business Forward'}</p>
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
