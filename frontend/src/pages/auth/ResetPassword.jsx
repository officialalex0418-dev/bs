import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Button, Input, Card } from '@/components/ui';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: OTP, 2: New Password
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    otp: '',
    password: '',
    confirm: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!form.email && step === 1) {
      navigate('/forgot-password');
    }
  }, [form.email, step, navigate]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!form.otp) return setError('Please enter the OTP');
    setStep(2); // In this implementation, we'll send everything together at the end or verify here.
    // The current backend has a combined 'resetPasswordWithOtp' endpoint.
    setError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');

    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password-with-otp', {
        email: form.email,
        otp: form.otp,
        password: form.password,
      });
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-700 to-primary-900 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
          {step === 1 ? 'Verify OTP' : 'Set New Password'}
        </h1>

        {message && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-600">{message}</div>}
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-sm text-slate-500">We've sent a 6-digit code to <b>{form.email}</b>.</p>
            <Input
              label="Verification Code"
              placeholder="123456"
              required
              value={form.otp}
              onChange={(e) => setForm({ ...form, otp: e.target.value })}
            />
            <Button type="submit" className="w-full">Continue</Button>
            <button
              type="button"
              className="w-full text-xs text-slate-400 hover:text-primary-600"
              onClick={() => navigate('/forgot-password')}
            >
              Change Email
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-slate-500">Enter your new strong password.</p>
            <Input
              label="New Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Input
              label="Confirm Password"
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
            <Button type="submit" loading={loading} className="w-full">Reset Password</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
