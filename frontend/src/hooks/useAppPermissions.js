import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export function useAppPermissions() {
  const isNative = Capacitor.isNativePlatform();

  const requestAllPermissions = useCallback(async () => {
    if (!isNative) return true;

    try {
      // 1. Notifications (Required for Android 13+)
      const notif = await LocalNotifications.requestPermissions();

      // 2. Geolocation (Fine/Coarse)
      const geo = await Geolocation.requestPermissions();

      // 3. Camera
      const cam = await Camera.requestPermissions();

      // 4. Storage
      const storage = await Filesystem.requestPermissions();

      // For "Run in background", we need to ensure the user is aware of
      // Background Location requirements.

      return (
        notif.display === 'granted' &&
        geo.location === 'granted'
      );
    } catch (e) {
      console.error('Permission requesting error:', e);
      return false;
    }
  }, [isNative]);

  const requestLocation = useCallback(async () => {
    if (!isNative) return true;
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    } catch (e) {
      return false;
    }
  }, [isNative]);

  const checkConnectivity = useCallback(async () => {
    const status = await Network.getStatus();
    return status.connected;
  }, []);

  return { requestLocation, requestAllPermissions, checkConnectivity };
}
