/**
 * BACKGROUND LOCATION TRACKING LOGIC (Staff app)
 *
 * Web (PWA) strategy:
 *  - Fetch tracking config (interval from company package: 30/60/120 min).
 *  - While the app/tab is alive: setInterval + navigator.geolocation.
 *  - Offline-resilient: failed pings are queued in localStorage and
 *    flushed in batch (`pings: [...]`) when connectivity returns.
 *  - Visibility-aware: also pings on `visibilitychange` resume so long
 *    background gaps get at least a fresh point on reopen.
 *
 * NOTE on true background tracking:
 *  Browsers suspend timers in background tabs; real always-on background
 *  tracking requires the native wrapper (React Native / Capacitor) using:
 *   - Android: ForegroundService + FusedLocationProvider
 *   - iOS: CoreLocation "Always" + significant-change monitoring
 *  The native layer should POST to the same `/locations` endpoint with the
 *  same batch payload format, so this backend works unchanged.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { api } from '@/api/client';

const QUEUE_KEY = 'bs_location_queue';

async function getDeviceInfo() {
  const info = await Device.getInfo();
  return {
    platform: info.platform, // 'android' | 'ios' | 'web'
    model: info.model,
    osVersion: info.osVersion,
    appVersion: '1.0.0',
  };
}

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200)));
}

export function useLocationTracker(enabled = true) {
  const [status, setStatus] = useState('idle'); // idle | active | denied | unsupported
  const [intervalMinutes, setIntervalMinutes] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const timerRef = useRef(null);

  const capture = useCallback(async () => {
    try {
      const info = await Device.getInfo();
      const isNative = info.platform === 'android' || info.platform === 'ios';

      // Enforce mobile-only tracking for background pings if needed
      if (!isNative) return null;

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000
      });

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        recordedAt: new Date(pos.timestamp).toISOString(),
        deviceInfo: {
          platform: info.platform,
          model: info.model,
          osVersion: info.osVersion,
        },
        source: 'BACKGROUND',
      };
    } catch (e) {
      if (e.message === 'location_denied') setStatus('denied');
      throw e;
    }
  }, []);

  const flush = useCallback(async () => {
    const queue = readQueue();
    if (!queue.length) return;
    try {
      await api.post('/locations', { pings: queue });
      writeQueue([]);
    } catch { /* keep queued */ }
  }, []);

  const ping = useCallback(async () => {
    try {
      const point = await capture();
      if (!point) return; // Skip non-native tracking
      try {
        await flush(); // send any backlog first
        await api.post('/locations', point);
        setLastPing(new Date());
      } catch {
        writeQueue([...readQueue(), point]); // offline → queue
      }
    } catch (e) {
      if (e?.code === 1) setStatus('denied'); // PERMISSION_DENIED
    }
  }, [capture, flush]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      // 1. Get interval from company package
      let minutes = 60;
      try {
        const { data } = await api.get('/locations/config');
        if (!data.data.enabled) return; // tracking not in package
        minutes = data.data.intervalMinutes || 60;
      } catch { return; } // feature gated off
      if (cancelled) return;

      setIntervalMinutes(minutes);
      setStatus('active');

      // 2. Immediate ping + recurring timer
      ping();
      timerRef.current = setInterval(ping, minutes * 60 * 1000);

      // 3. Ping on tab resume (covers background suspension gaps)
      const onVisible = () => { if (document.visibilityState === 'visible') ping(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', flush);

      return () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', flush);
      };
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, ping, flush]);

  return { status, intervalMinutes, lastPing };
}
