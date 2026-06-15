import { useNavigate } from 'react-router-dom';
import { Pencil, Lock, User, Phone, MapPin, Mail, ShieldCheck, Briefcase } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Card, Button, Badge } from '@/components/ui';

export default function StaffProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    try {
      await api.post('/auth/request-password-reset-otp', { email: user.email });
      navigate(`/reset-password?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start password reset');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card className="overflow-hidden">
        <div className="relative h-32 bg-primary-600">
          <div className="absolute -bottom-12 left-8">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-lg dark:border-slate-900 dark:bg-slate-800">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-slate-300" />
              )}
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 pt-16">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">{user?.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{user?.position || 'Staff'}</p>
                <Badge color="blue" className="ml-2 uppercase tracking-wider">{user?.role?.replace('COMPANY_', '')}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate('/staff/profile/edit')}>
                <Pencil className="h-4 w-4" /> Edit Profile
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetPassword}>
                <Lock className="h-4 w-4" /> Reset Password
              </Button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-100 pt-8 dark:border-slate-800 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> PAN Number
              </p>
              <p className="font-medium">{user?.pan || 'Not provided'}</p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Phone className="h-3.5 w-3.5" /> Mobile Number
              </p>
              <p className="font-medium">{user?.phone || 'Not provided'}</p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <MapPin className="h-3.5 w-3.5" /> Address
              </p>
              <p className="font-medium">{user?.address || 'Not provided'}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
