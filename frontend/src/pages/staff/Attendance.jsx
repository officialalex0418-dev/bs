import { useEffect, useState, useCallback } from 'react';
import { LogIn, LogOut, MapPin, AlertCircle, Settings, Fingerprint, Calendar } from 'lucide-react';
import { api } from '@/api/client';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Device } from '@capacitor/device';
import { useAuth } from '@/context/AuthContext';
import { useAppPermissions } from '@/hooks/useAppPermissions';
import { Card, CardHeader, CardBody, Button, Table, Badge, Spinner } from '@/components/ui';
import { formatTime, formatDate, toNepaliMonth, toNepaliDate } from '@/lib/utils';

async function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('GPS_UNSUPPORTED'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject(new Error('PERMISSION_DENIED'));
        else if (err.code === 2 || err.code === 3) reject(new Error('POSITION_UNAVAILABLE'));
        else reject(new Error('UNKNOWN_ERROR'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export default function StaffAttendance() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [locError, setLocError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const { requestLocation, requestAllPermissions } = useAppPermissions();

  useEffect(() => {
    (async () => {
      const info = await Device.getInfo();
      const mobile = info.platform === 'android' || info.platform === 'ios';
      setIsMobile(mobile);
      if (mobile) {
        await requestAllPermissions();
      }
    })();
  }, [requestAllPermissions]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/me');
      setData(data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const checkLoc = async () => {
    setLocError(null);
    const hasPermission = await requestLocation();
    if (!hasPermission) {
      setLocError('Location permission is required to check in. Please enable it in your device settings.');
      return null;
    }
    try {
      const pos = await getPosition();
      return pos;
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        setLocError('Location permission denied. Please allow access in browser settings.');
      } else if (err.message === 'POSITION_UNAVAILABLE' || err.message === 'GPS_UNSUPPORTED') {
        setLocError('Please enable GPS/Location Services to check in.');
      } else {
        setLocError('Unable to retrieve location. Please check your GPS settings.');
      }
      return null;
    }
  };

  const handleBiometric = async () => {
    // 1. Check if we are on a native mobile device
    const info = await Device.getInfo();
    const isMobile = info.platform === 'android' || info.platform === 'ios';

    const isActivePref = localStorage.getItem(`biometric_${user?._id}`) === 'true';
    if (!isActivePref) return true;

    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) return true; // No biometrics set up, allow skip

      await NativeBiometric.verifyIdentity({
        reason: "Verify your identity for attendance",
        title: "Attendance Verification",
        subtitle: "Please authenticate to continue",
        description: "Fingerprint or Face ID required",
      });
      return true;
    } catch (err) {
      console.error('Biometric verification failed', err);
      // If user cancels or fails, we block
      if (err.message?.includes('cancel') || err.message?.includes('fail')) {
         setMessage('Biometric authentication is required to record attendance.');
         return false;
      }
      return true; // Other errors (like plugin not found) - allow fallback
    }
  };

  const act = async (endpoint) => {
    setBusy(true); setMessage(''); setLocError(null);

    const bioOk = await handleBiometric();
    if (!bioOk) {
      setBusy(false);
      return;
    }

    try {
      const coords = await checkLoc();
      if (!coords) {
        setBusy(false);
        return;
      }

      const deviceIdInfo = await Device.getId();
      const deviceInfoRaw = await Device.getInfo();

      await api.post(`/attendance/${endpoint}`, {
        ...coords,
        deviceId: deviceIdInfo.identifier,
        deviceInfo: {
          platform: deviceInfoRaw.platform,
          model: `${deviceInfoRaw.manufacturer} ${deviceInfoRaw.model}`,
          osVersion: deviceInfoRaw.osVersion
        },
      });
      setMessage(endpoint === 'check-in' ? 'Checked in successfully ✓' : 'Checked out successfully ✓');
      load();
    } catch (err) {
      const msg = err.response?.data?.message?.toLowerCase() || '';
      if (msg.includes('already checked in')) {
        setMessage('You are already checked in for today.');
      } else if (msg.includes('not checked in')) {
        setMessage('You need to check in first before checking out.');
      } else if (msg.includes('outside')) {
        setMessage('You are too far from the company location. Please check in from the office radius.');
      } else {
        setMessage('Unable to record attendance. Please check your internet and try again.');
      }
    } finally { setBusy(false); }
  };

  if (!data) return <Spinner />;
  const today = data.today;
  const biometricActive = localStorage.getItem(`biometric_${user?._id}`) === 'true';
  const outdoorOnWeb = user?.workMode === 'OUTDOOR' && !isMobile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Daily Attendance</h1>
        {biometricActive && (
          <Badge color="blue" className="flex items-center gap-1">
            <Fingerprint className="h-3 w-3" /> Biometric Active
          </Badge>
        )}
      </div>

      {outdoorOnWeb && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <p><b>Outdoor Staff:</b> Attendance is restricted to the mobile application. Please use the Business Sarthi APK to check in/out.</p>
        </div>
      )}

      {message && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">{message}</div>}

      {locError && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="font-medium">{locError}</p>
          </div>
          <Button variant="outline" size="sm" className="w-fit border-red-200 hover:bg-red-100" onClick={checkLoc}>
            <Settings className="h-4 w-4" /> Retry GPS
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardBody className="flex flex-col items-center gap-6 py-10">
            <div className="text-center space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Status</p>
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {today?.checkIn?.time
                  ? (today?.checkOut?.time ? 'Shift Completed' : 'Clocked In')
                  : 'Not Started Today'}
              </h2>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button className="h-20 flex-1 text-lg sm:px-12 flex-col gap-0" loading={busy}
                disabled={!!today?.checkIn?.time || outdoorOnWeb} onClick={() => act('check-in')}>
                <LogIn className="h-6 w-6" />
                <span className="mt-1">Check In</span>
                {today?.checkIn?.time && <span className="text-[10px] opacity-80">{formatTime(today.checkIn.time)}</span>}
              </Button>
              <Button variant="outline" className="h-20 flex-1 text-lg sm:px-12 flex-col gap-0 border-2" loading={busy}
                disabled={!today?.checkIn?.time || !!today?.checkOut?.time || outdoorOnWeb} onClick={() => act('check-out')}>
                <LogOut className="h-6 w-6" />
                <span className="mt-1">Check Out</span>
                {today?.checkOut?.time && <span className="text-[10px] opacity-80">{formatTime(today.checkOut.time)}</span>}
              </Button>
            </div>

            <p className="text-center text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider">
              <MapPin className="h-3 w-3" />
              Verified GPS location is required for all entries
            </p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary-600 text-white border-0 shadow-lg shadow-primary-200 dark:shadow-none">
            <CardBody className="p-6">
              <Calendar className="h-8 w-8 mb-4 opacity-50" />
              <p className="text-xs uppercase font-bold tracking-widest opacity-80">
                {dateFormat === 'BS' ? toNepaliMonth(data.summary.month) : 'This Month'}
              </p>
              <h3 className="text-3xl font-bold mt-1">{data.summary.presentDays} <span className="text-sm font-normal opacity-80">Days</span></h3>
              <p className="text-xs mt-4 font-medium opacity-90">Present Days Record</p>
            </CardBody>
          </Card>

          <Card className={today?.checkIn?.isLate ? 'bg-red-50 border-red-100' : 'bg-slate-50'}>
            <CardBody className="p-6 flex flex-col justify-center text-center">
              <p className="text-xs uppercase font-bold tracking-widest text-slate-400">
                {dateFormat === 'BS' ? `${toNepaliMonth(data.summary.month)} Lates` : 'Monthly Lates'}
              </p>
              <h3 className={`text-3xl font-bold mt-1 ${data.summary.lateDays > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {data.summary.lateDays}
              </h3>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Attendance History"
          subtitle={`Month: ${dateFormat === 'BS' ? toNepaliMonth(data.summary.month) : data.summary.month}`}
          action={<Button variant="ghost" size="sm" onClick={load}>Refresh Logs</Button>}
        />
        <Table
          columns={['Date', 'Time In', 'Time Out', 'Working Hours', 'Status']}
          data={data.items}
          renderRow={(a) => (
            <tr key={a._id}>
              <td className="table-td font-medium">{formatDate(a.date, dateFormat)}</td>
              <td className="table-td">{formatTime(a.checkIn?.time)}</td>
              <td className="table-td">{formatTime(a.checkOut?.time)}</td>
              <td className="table-td">{a.workedMinutes ? `${(a.workedMinutes / 60).toFixed(1)} h` : '—'}</td>
              <td className="table-td">
                <div className="flex flex-col gap-1">
                  <Badge color={a.status === 'PRESENT' ? 'green' : 'yellow'}>{a.status}</Badge>
                  {a.checkIn?.isLate && <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Late Entry</span>}
                </div>
              </td>
            </tr>
          )}
          mobileRender={(a) => (
            <div key={a._id} className="p-4 space-y-2 border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-700 dark:text-slate-200">{formatDate(a.date, dateFormat)}</p>
                <Badge color={a.status === 'PRESENT' ? 'green' : 'yellow'}>{a.status}</Badge>
              </div>
              <div className="grid grid-cols-2 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Check In</p>
                  <p className="font-medium text-slate-600">{formatTime(a.checkIn?.time) || '--'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-400">Check Out</p>
                  <p className="font-medium text-slate-600">{formatTime(a.checkOut?.time) || '--'}</p>
                </div>
              </div>
              {a.checkIn?.isLate && <p className="text-[10px] text-red-500 font-bold bg-red-50 w-fit px-1.5 py-0.5 rounded">LATE ARRIVAL</p>}
            </div>
          )}
        />
      </Card>
    </div>
  );
}
