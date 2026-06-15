import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Package, ShieldCheck, Mail, Phone, MapPin, Pencil, Lock, Globe, FileText } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardHeader, CardBody, Button, Badge, Spinner } from '@/components/ui';

export default function CompanySettings() {
  const [company, setCompany] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/companies/me').then(({ data }) => setCompany(data.data.company));
  }, []);

  const handleResetPassword = async () => {
    try {
      await api.post('/auth/request-password-reset-otp', { email: company.email });
      navigate(`/reset-password?email=${encodeURIComponent(company.email)}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start password reset');
    }
  };

  if (!company) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <Card className="overflow-hidden">
        <div className="relative h-48 bg-gradient-to-br from-primary-600 to-primary-800">
          <div className="absolute -bottom-16 left-8">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border-8 border-white bg-slate-100 shadow-xl dark:border-slate-900 dark:bg-slate-800">
              {company.logo ? (
                <img src={company.logo} alt="Company logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-16 w-12 text-slate-300" />
              )}
            </div>
          </div>
          <div className="absolute bottom-4 right-8 flex gap-2">
            <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md" onClick={() => navigate('/company/settings/edit')}>
              <Pencil className="h-4 w-4" /> Edit Profile
            </Button>
            <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md" onClick={handleResetPassword}>
              <Lock className="h-4 w-4" /> Reset Password
            </Button>
          </div>
        </div>

        <div className="px-8 pb-10 pt-20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{company.name}</h2>
                <Badge color={company.status === 'ACTIVE' ? 'green' : 'yellow'}>{company.status}</Badge>
              </div>
              <p className="max-w-2xl text-slate-600 dark:text-slate-400">{company.description || 'No description provided.'}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-slate-100 pt-10 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="h-4 w-4" /> Company Identity
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Registration Number</p>
                  <p className="font-medium">{company.registrationNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">PAN / VAT Number</p>
                  <p className="font-medium">{company.panVat || '—'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="h-4 w-4" /> Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary-500" />
                  <p className="font-medium">{company.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary-500" />
                  <p className="font-medium">{company.phone || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary-500" />
                  <p className="font-medium">{company.website || '—'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                <Package className="h-4 w-4" /> Subscription
              </h3>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{company.package?.name || 'Basic Plan'}</p>
                <p className="mt-1 text-xs text-slate-500">Includes tracking, attendance, and basic reporting.</p>
              </div>
            </div>
          </div>

          {company.additionalInfo && (
            <div className="mt-10 space-y-3 rounded-2xl bg-primary-50/50 p-6 dark:bg-primary-900/10">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                <FileText className="h-4 w-4" /> Additional Information
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{company.additionalInfo}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
