import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, getAccessToken } from '@/api/client';
import { Device } from '@capacitor/device';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Always fetch public settings for branding
      try {
        const { data: s } = await api.get('/auth/settings');
        setSettings(s.data);
      } catch (e) {
        console.warn('Failed to fetch public settings', e);
      }

      if (!getAccessToken()) return setLoading(false);
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.data.user);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    let deviceId = localStorage.getItem('bs_device_id');

    try {
      const info = await Device.getId();
      deviceId = info.identifier;
      localStorage.setItem('bs_device_id', deviceId);
    } catch (e) {
      if (!deviceId) {
        deviceId = `WEB-${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem('bs_device_id', deviceId);
      }
    }

    const { data } = await api.post('/auth/login', { email, password, deviceId });
    setAccessToken(data.data.accessToken);
    localStorage.setItem('bs_refresh', data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    // 1. Check if user is staff and currently checked in for auto-checkout
    if (user?.role === 'STAFF') {
      try {
        const { data: att } = await api.get('/attendance/me');
        if (att.data.today?.checkIn?.time && !att.data.today?.checkOut?.time) {
          // Perform automatic checkout
          await api.post('/attendance/check-out', {
            auto: true,
            remarks: 'Auto-checkout on logout'
          });
        }
      } catch (e) {
        console.warn('Auto-checkout failed during logout', e);
      }
    }

    // 2. Perform regular logout
    try {
      await api.post('/auth/logout', { refreshToken: localStorage.getItem('bs_refresh') });
    } catch {}

    setAccessToken(null);
    localStorage.removeItem('bs_refresh');
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
    } catch (e) {
      console.error('Failed to refresh user data', e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, settings, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
