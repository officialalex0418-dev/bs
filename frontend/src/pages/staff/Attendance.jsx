import { useEffect, useState, useCallback } from 'react';
import { LogIn, LogOut, MapPin, AlertCircle, Settings, Fingerprint, Calendar, Clock, ClipboardList } from 'lucide-react';
import { api } from '@/api/client';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Device } from '@capacitor/device';
import { useAuth } from '@/context/AuthContext';
import { useAppPermissions } from '@/hooks/useAppPermissions';
import { Card, CardHeader, CardBody, Button, Table, Badge, Spinner, Modal, Input, Textarea, MonthPicker } from '@/components/ui';
import { formatTime, formatDate, toNepaliMonth, toNepaliDate, todayStr } from '@/lib/utils';
import { adToBs } from '@/lib/nepaliDate';

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

  const [reqModal, setReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({ date: todayStr(), checkInTime: '', checkOutTime: '', reason: '' });
  const [reqLoading, setReqLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (dateFormat === 'BS') {
      const bs = adToBs(new Date());
      return `${bs.year}-${String(bs.month).padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 7);
  });

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
      const params = {};
      if (dateFormat === 'BS') {
        const [y, m] = selectedMonth.split('-').map(Number);
        const info = getBsMonthInfo(y, m);
        if (info) {
          const from = bsToAd(`${selectedMonth}-01`);
          const to = bsToAd(`${selectedMonth}-${String(info.daysInMonth).padStart(2, '0')}`);
          // Use UTC-friendly formatting to match backend todayStr (YYYY-MM-DD)
          const fmt = (d) => {
             const pad = (n) => String(n).padStart(2, '0');
             return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          };
          params.fromDate = fmt(from);
          params.toDate = fmt(to);
        }
      } else {
        params.month = selectedMonth;
      }

      const { data } = await api.get('/attendance/me', { params });
      setData(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedMonth, dateFormat]);

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

  const handleRequest = async (e) => {
    e.preventDefault();
    setReqLoading(true);
    try {
      // Combine date with time to create full Date objects
      const d = reqForm.date;
      const ci = new Date(`${d}T${reqForm.checkInTime}:00`);
      const co = new Date(`${d}T${reqForm.checkOutTime}:00`);

      await api.post('/attendance/requests', {
        ...reqForm,
        checkInTime: ci.toISOString(),
        checkOutTime: co.toISOString()
      });
      setMessage('Attendance request submitted successfully ✓');
      setReqModal(false);
      setReqForm({ date: todayStr(), checkInTime: '', checkOutTime: '', reason: '' });
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to submit request');
    } finally { setReqLoading(false); }
  };

  if (!data) return <Spinner />;
  const today = data.today;
  const restriction = data.restriction;
  const biometricActive = localStorage.getItem(`biometric_${user?._id}`) === 'true';
  const outdoorOnWeb = user?.workMode === 'OUTDOOR' && !isMobile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Daily Attendance</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReqModal(true)}>
            <Clock className="h-4 w-4 mr-1" /> Request Overtime
          </Button>
          {biometricActive && (
            <Badge color="blue" className="flex items-center gap-1">
              <Fingerprint className="h-3 w-3" /> Biometric Active
            </Badge>
          )}
        </div>
      </div>

      {restriction?.restricted && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">{restriction.reason}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Regular check-in is disabled. If you are working overtime, please use the button above to request attendance.</p>
            </div>
          </div>
        </div>
      )}

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
                disabled={!!today?.checkIn?.time || outdoorOnWeb || restriction?.restricted} onClick={() => act('check-in')}>
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
                {dateFormat === 'BS' ? toNepaliMonth(selectedMonth) : 'This Month'}
              </p>
              <h3 className="text-3xl font-bold mt-1">{data.summary.presentDays} <span className="text-sm font-normal opacity-80">Days</span></h3>
              <p className="text-xs mt-4 font-medium opacity-90">Present Days Record</p>
            </CardBody>
          </Card>

          <Card className={today?.checkIn?.isLate ? 'bg-red-50 border-red-100' : 'bg-slate-50'}>
            <CardBody className="p-6 flex flex-col justify-center text-center">
              <p className="text-xs uppercase font-bold tracking-widest text-slate-400">
                {dateFormat === 'BS' ? `${toNepaliMonth(selectedMonth)} Lates` : 'Monthly Lates'}
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
          subtitle={`Month: ${dateFormat === 'BS' ? toNepaliMonth(selectedMonth) : selectedMonth}`}
          action={
            <div className="flex items-center gap-2">
              <MonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                className="w-40 !py-1.5 !text-xs"
              />
              <Button variant="ghost" size="sm" onClick={load}>Refresh</Button>
            </div>
          }
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

      <Modal open={reqModal} onClose={() => setReqModal(false)} title="Attendance Request (Overtime)">
        <form onSubmit={handleRequest} className="space-y-4">
          <Input label="Date" type="date" value={reqForm.date} onChange={e => setReqForm({ ...reqForm, date: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Check In Time" type="time" value={reqForm.checkInTime} onChange={e => setReqForm({ ...reqForm, checkInTime: e.target.value })} required />
            <Input label="Check Out Time" type="time" value={reqForm.checkOutTime} onChange={e => setReqForm({ ...reqForm, checkOutTime: e.target.value })} required />
          </div>
          <Textarea label="Reason / Work Description" value={reqForm.reason} onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} placeholder="e.g. Completed urgent inventory audit on Saturday" required />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setReqModal(false)}>Cancel</Button>
            <Button type="submit" loading={reqLoading}>Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
