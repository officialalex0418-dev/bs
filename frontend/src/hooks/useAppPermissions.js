import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export function useAppPermissions() {
  const isNative = Capacitor.isNativePlatform();

  const requestAllPermissions = useCallback(async () => {
    if (!isNative) return true;

    try {
      // 1. Geolocation
      let geo = await Geolocation.requestPermissions();

      // 2. Camera
      let cam = await Camera.requestPermissions();

      // 3. Storage
      let storage = await Filesystem.requestPermissions();

      // 4. Notifications
      try {
        if ('Notification' in window) {
          await Notification.requestPermission();
        }
      } catch (err) {}

      return geo.location === 'granted' && cam.camera === 'granted';
    } catch (e) {
      console.error('Permission requesting error:', e);
      return false;
    }
  }, [isNative]);

  const requestLocation = useCallback(async () => {
    if (!isNative) return true;

    try {
      let status = await Geolocation.checkPermissions();
      if (status.location === 'granted') return true;

      status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    } catch (e) {
      console.error('Location permission error:', e);
      return false;
    }
  }, [isNative]);

  const checkConnectivity = useCallback(async () => {
    const status = await Network.getStatus();
    return status.connected;
  }, []);

  return { requestLocation, requestAllPermissions, checkConnectivity };
}
