import { useEffect, useRef, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '@/api/client';

const QUEUE_KEY = 'bs_location_queue';
// A simple short high-pitched beep sound in base64
const ALERT_SOUND_BASE64 = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT1vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT18=';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500))); // Store more points
}

export function useLocationTracker(enabled = true) {
  const [status, setStatus] = useState('idle');
  const [intervalMinutes, setIntervalMinutes] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [isAlerting, setIsAlerting] = useState(false);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const alertTimerRef = useRef(null);

  const playAlert = useCallback(() => {
    if (isAlerting) return;
    setIsAlerting(true);

    // Play sound
    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_SOUND_BASE64);
      audioRef.current.loop = true;
    }
    audioRef.current.play().catch(() => {});

    // Stop after 30 seconds
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      stopAlert();
    }, 30000);
  }, [isAlerting]);

  const stopAlert = useCallback(() => {
    setIsAlerting(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
  }, []);

  const updateTrackingNotification = useCallback(async (isActive) => {
    if (isActive) {
      await LocalNotifications.schedule({
        notifications: [{
          id: 999,
          title: 'Business Sarthi Tracking',
          body: 'Your shift is active and location is being tracked.',
          ongoing: true, // Makes it a foreground service notification
          sticky: true,
          channelId: 'bs_alerts',
          smallIcon: 'ic_stat_name', // Needs to exist in android res
        }]
      }).catch(() => {});
    } else {
      await LocalNotifications.cancel({ notifications: [{ id: 999 }] }).catch(() => {});
    }
  }, []);

  const capture = useCallback(async () => {
    try {
      const net = await Network.getStatus();
      if (!net.connected) {
        playAlert();
        throw new Error('NO_INTERNET');
      }

      const info = await Device.getInfo();
      const isNative = info.platform === 'android' || info.platform === 'ios';
      if (!isNative) return null;

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });

      stopAlert(); // Location and Internet are fine

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
      if (e.message === 'location_denied' || e.code === 1) {
        setStatus('denied');
        playAlert();
      } else if (e.message === 'POSITION_UNAVAILABLE' || e.code === 2) {
        playAlert();
      }
      throw e;
    }
  }, [playAlert, stopAlert]);

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
      if (!point) return;
      try {
        await flush();
        await api.post('/locations', point);
        setLastPing(new Date());
      } catch {
        writeQueue([...readQueue(), point]);
      }
    } catch (e) {
       console.error('Ping failed:', e.message);
    }
  }, [capture, flush]);

  useEffect(() => {
    if (!enabled) {
      stopAlert();
      updateTrackingNotification(false);
      return;
    }

    updateTrackingNotification(true);
    let cancelled = false;

    (async () => {
      let minutes = 1; // Default to 1 min for better tracking accuracy
      try {
        const { data } = await api.get('/locations/config');
        if (!data.data.enabled) return;
        // The backend returns intervalMinutes: 1 as per location.controller.js
        minutes = data.data.intervalMinutes || 1;
      } catch { return; }
      if (cancelled) return;

      setIntervalMinutes(minutes);
      setStatus('active');

      ping();
      timerRef.current = setInterval(ping, minutes * 60 * 1000);

      const onVisible = () => { if (document.visibilityState === 'visible') ping(); };
      document.addEventListener('visibilitychange', onVisible);

      const onNetChange = (status) => {
        if (status.connected) {
          stopAlert();
          flush();
        } else {
          playAlert();
        }
      };
      const netHandler = Network.addListener('networkStatusChange', onNetChange);

      return () => {
        document.removeEventListener('visibilitychange', onVisible);
        netHandler.remove();
      };
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      stopAlert();
    };
  }, [enabled, ping, flush, playAlert, stopAlert]);

  return { status, intervalMinutes, lastPing, isAlerting };
}
