import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button, Input, Card } from '@/components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use the OTP request endpoint
      await api.post('/auth/request-password-reset-otp', { email });
      // Navigate to reset page with email in state/query
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      // Even on error, we might want to navigate to prevent email enumeration,
      // but usually for OTP we can show the next screen anyway.
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-700 to-primary-900 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">Forgot password</h1>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">Enter your account email and we'll send you a 6-digit verification code.</p>
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          <Button type="submit" loading={loading} className="w-full">Send Verification Code</Button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-primary-600 hover:underline">Back to login</Link>
        </div>
      </Card>
    </div>
  );
}
