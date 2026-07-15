import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Lock, User, Phone, MapPin, Mail, ShieldCheck, Briefcase, Fingerprint, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Device } from '@capacitor/device';
import { Card, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function StaffProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem(`biometric_${user?._id}`) === 'true');
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const info = await Device.getInfo();
        if (info.platform === 'android' || info.platform === 'ios') {
          const res = await NativeBiometric.isAvailable();
          setBiometricSupported(res.isAvailable);
        } else if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricSupported(available);
        }
      } catch (e) {
        console.warn('Biometric check failed', e);
      }
    })();
  }, [user?._id]);

  const toggleBiometric = async () => {
    if (!biometricEnabled) {
      try {
        const info = await Device.getInfo();
        if (info.platform === 'android' || info.platform === 'ios') {
          await NativeBiometric.verifyIdentity({
            reason: "Enable biometric for attendance",
            title: "Verify Identity",
          });
        } else if (window.PublicKeyCredential) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "Business Sarthi" },
              user: { id: Uint8Array.from(user._id || 'user', c => c.charCodeAt(0)), name: user.email, displayName: user.name },
              pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
              authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
              timeout: 60000
            }
          });
        }
        localStorage.setItem(`biometric_${user?._id}`, 'true');
        setBiometricEnabled(true);
      } catch (err) {
        console.error('Biometric registration failed', err);
      }
    } else {
      localStorage.removeItem(`biometric_${user?._id}`);
      setBiometricEnabled(false);
    }
  };

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

      {biometricSupported && (
        <Card className="border-primary-100 bg-primary-50/30 dark:border-primary-900/20">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2 text-primary-900 dark:text-primary-100">
              <Fingerprint className="h-5 w-5 text-primary-600" />
              Biometric Authentication
            </h3>
            <p className="text-sm text-slate-500 mb-4">Secure your attendance logs with Face ID or Fingerprint.</p>

            <div className="flex items-center justify-between p-4 rounded-xl border border-white bg-white/50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                {biometricEnabled ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-slate-200" />
                )}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {biometricEnabled ? 'Biometric verification is active' : 'Biometric verification is disabled'}
                </span>
              </div>
              <button
                onClick={toggleBiometric}
                className={cn(
                  "flex items-center transition-all duration-300",
                  biometricEnabled ? 'text-primary-600' : 'text-slate-300 hover:text-slate-400'
                )}
              >
                {biometricEnabled ? <ToggleRight className="h-10 w-10" /> : <ToggleLeft className="h-10 w-10" />}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
