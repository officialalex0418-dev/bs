import { useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

export function useAppPermissions() {
  const requestLocation = useCallback(async () => {
    const info = await Device.getInfo();
    if (info.platform === 'web') return true;

    try {
      let status = await Geolocation.checkPermissions();
      if (status.location === 'granted') return true;

      status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    } catch (e) {
      console.error('Location permission error:', e);
      return false;
    }
  }, []);

  const requestCamera = useCallback(async () => {
    const info = await Device.getInfo();
    if (info.platform === 'web') return true;

    try {
      let status = await Camera.checkPermissions();
      if (status.camera === 'granted') return true;

      status = await Camera.requestPermissions();
      return status.camera === 'granted';
    } catch (e) {
      console.error('Camera permission error:', e);
      return false;
    }
  }, []);

  const requestFiles = useCallback(async () => {
    const info = await Device.getInfo();
    if (info.platform === 'web') return true;

    try {
      let status = await Filesystem.checkPermissions();
      if (status.publicStorage === 'granted') return true;

      status = await Filesystem.requestPermissions();
      return status.publicStorage === 'granted';
    } catch (e) {
      console.error('Filesystem permission error:', e);
      return false;
    }
  }, []);

  return { requestLocation, requestCamera, requestFiles };
}
