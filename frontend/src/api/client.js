import axios from 'axios';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Device } from '@capacitor/device';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export const api = axios.create({ baseURL, withCredentials: true });

// ---------- token storage ----------
let accessToken = localStorage.getItem('bs_access') || null;
export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => {
  accessToken = t;
  if (t) localStorage.setItem('bs_access', t);
  else localStorage.removeItem('bs_access');
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ---------- auto refresh on 401 ----------
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise =
          refreshPromise ||
          axios.post(`${baseURL}/auth/refresh`, { refreshToken: localStorage.getItem('bs_refresh') }, { withCredentials: true });
        const { data } = await refreshPromise;
        refreshPromise = null;
        setAccessToken(data.data.accessToken);
        if (data.data.refreshToken) localStorage.setItem('bs_refresh', data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        setAccessToken(null);
        localStorage.removeItem('bs_refresh');
        window.location.href = '/login';
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

/** Download helper for Excel / PDF report endpoints */
export async function downloadFile(url, filename) {
  const info = await Device.getInfo();
  const isNative = info.platform !== 'web';

  if (isNative) {
    try {
      // Request permission first
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== 'granted') {
        await Filesystem.requestPermissions();
      }

      const res = await api.get(url, { responseType: 'blob' });
      const reader = new FileReader();

      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(res.data);
      });

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });

      if (confirm(`File saved to Documents!\nPath: ${savedFile.uri}\n\nWould you like to open it?`)) {
        await FileOpener.open({
          filePath: savedFile.uri,
          contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }
    } catch (err) {
      console.error('Mobile download error:', err);
      alert(`Download failed: ${err.message || 'Unknown error'}. Please check if the app has Storage permission.`);
    }
  } else {
    // Web version
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }
}
