import { useEffect, useState, useCallback } from 'react';
import { LogIn, LogOut, MapPin, AlertCircle, Settings } from 'lucide-react';
import { api } from '@/api/client';
import { useAppPermissions } from '@/hooks/useAppPermissions';
import { Card, CardHeader, CardBody, Button, Table, Badge, Spinner } from '@/components/ui';
import { formatTime } from '@/lib/utils';

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
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [locError, setLocError] = useState(null);
  const { requestLocation } = useAppPermissions();

  const load = useCallback(async () => {
    const { data } = await api.get('/attendance/me');
    setData(data.data);
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

  const act = async (endpoint) => {
    setBusy(true); setMessage(''); setLocError(null);
    try {
      const coords = await checkLoc();
      if (!coords) {
        setBusy(false);
        return;
      }

      await api.post(`/attendance/${endpoint}`, {
        ...coords,
        deviceInfo: { platform: 'web', model: navigator.userAgent.slice(0, 80) },
      });
      setMessage(endpoint === 'check-in' ? 'Checked in successfully ✓' : 'Checked out successfully ✓');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    } finally { setBusy(false); }
  };

  if (!data) return <Spinner />;
  const today = data.today;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Attendance</h1>
      {message && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{message}</div>}

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

      <Card>
        <CardBody className="flex flex-col items-center gap-4 py-10">
          <p className="text-center text-sm text-slate-500">
            <MapPin className="mr-1 inline h-4 w-4" />
            GPS validation is required for check-in. Your location is logged securely.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button className="h-16 flex-1 text-lg sm:px-12" loading={busy}
              disabled={!!today?.checkIn?.time} onClick={() => act('check-in')}>
              <LogIn className="h-6 w-6" />
              {today?.checkIn?.time ? `In at ${formatTime(today.checkIn.time)}` : 'Check In'}
            </Button>
            <Button variant="outline" className="h-16 flex-1 text-lg sm:px-12" loading={busy}
              disabled={!today?.checkIn?.time || !!today?.checkOut?.time} onClick={() => act('check-out')}>
              <LogOut className="h-6 w-6" />
              {today?.checkOut?.time ? `Out at ${formatTime(today.checkOut.time)}` : 'Check Out'}
            </Button>
          </div>
          {today?.checkIn?.isLate && <Badge color="red" className="px-4 py-1">Late Attendance Logged</Badge>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Month: ${data.summary.month}`}
          subtitle={`${data.summary.presentDays} Days Present · ${data.summary.lateDays} Late`} />
        <Table
          columns={['Date', 'Check-In', 'Check-Out', 'Worked', 'Status']}
          data={data.items}
          renderRow={(a) => (
            <tr key={a._id}>
              <td className="table-td">{a.date}</td>
              <td className="table-td">{formatTime(a.checkIn?.time)}</td>
              <td className="table-td">{formatTime(a.checkOut?.time)}</td>
              <td className="table-td">{a.workedMinutes ? `${(a.workedMinutes / 60).toFixed(1)} h` : '—'}</td>
              <td className="table-td">
                <div className="flex flex-col gap-1">
                  <Badge color={a.status === 'PRESENT' ? 'green' : 'yellow'}>{a.status}</Badge>
                  {a.checkIn?.isLate && <span className="text-[10px] text-red-500 font-bold uppercase">Late</span>}
                </div>
              </td>
            </tr>
          )}
          mobileRender={(a) => (
            <div key={a._id} className="p-4 space-y-2 border-b dark:border-slate-800 last:border-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{a.date}</p>
                <Badge color={a.status === 'PRESENT' ? 'green' : 'yellow'}>{a.status}</Badge>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <p>In: {formatTime(a.checkIn?.time) || '--'}</p>
                <p>Out: {formatTime(a.checkOut?.time) || '--'}</p>
              </div>
              {a.checkIn?.isLate && <p className="text-[10px] text-red-500 font-bold">LATE ARRIVAL</p>}
            </div>
          )}
        />
      </Card>
    </div>
  );
}
