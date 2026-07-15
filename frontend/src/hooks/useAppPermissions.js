import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export function useAppPermissions() {
  const isNative = Capacitor.isNativePlatform();

  const requestAllPermissions = useCallback(async () => {
    if (!isNative) return true;

    try {
      // 1. Notifications (High priority for WhatsApp-style)
      await LocalNotifications.requestPermissions();

      // 2. Geolocation (Fine/Coarse)
      const geo = await Geolocation.requestPermissions();

      // 3. Background Location (Android 11+ requirements)
      // This often requires a second prompt or showing settings.
      // We trigger the standard request again which might help on some platforms.
      if (geo.location === 'granted') {
        // Log to console for debugging
        console.log('Foreground location granted');
      }

      // 4. Camera
      await Camera.requestPermissions();

      // 5. Storage
      await Filesystem.requestPermissions();

      // Note: Battery optimization and background activity are best managed
      // by the background-geolocation plugin or by guiding the user to settings.

      return true;
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
