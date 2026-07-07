import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export function useAppPermissions() {
  const isNative = Capacitor.isNativePlatform();

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

  const requestCamera = useCallback(async () => {
    if (!isNative) return true;

    try {
      let status = await Camera.checkPermissions();
      if (status.camera === 'granted') return true;

      status = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return status.camera === 'granted';
    } catch (e) {
      console.error('Camera/Photos permission error:', e);
      return false;
    }
  }, [isNative]);

  const requestFiles = useCallback(async () => {
    if (!isNative) return true;

    try {
      let status = await Filesystem.checkPermissions();
      if (status.publicStorage === 'granted') return true;

      status = await Filesystem.requestPermissions();
      return status.publicStorage === 'granted';
    } catch (e) {
      console.error('Filesystem permission error:', e);
      return false;
    }
  }, [isNative]);

  const requestNotifications = useCallback(async () => {
    // Standard web notifications or Capacitor Push
    try {
      if (!isNative) {
        if ('Notification' in window && Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
        return true;
      }
      // For native, usually handled by push plugins, but can check generic local notify perm
      return true;
    } catch (e) {
      console.error('Notification permission error:', e);
      return false;
    }
  }, [isNative]);

  return { requestLocation, requestCamera, requestFiles, requestNotifications };
}
