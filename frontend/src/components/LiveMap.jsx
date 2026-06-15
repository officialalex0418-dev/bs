import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, CircleMarker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 27.7172, lng: 85.324 }; // Kathmandu

const avatarIcon = (item, selected = false) => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
      <div style="width:${selected ? 58 : 50}px;height:${selected ? 58 : 50}px;border-radius:9999px;border:3px solid #fff;box-shadow:0 10px 24px rgba(15,23,42,.25);overflow:hidden;background:#e2e8f0;">
        ${item.profilePhoto ? `<img src="${item.profilePhoto}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;" />` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:bold 18px Arial;color:#334155;">${(item.name || '?').slice(0,1)}</div>`}
      </div>
      <div style="max-width:120px;padding:4px 8px;border-radius:9999px;background:rgba(255,255,255,.95);box-shadow:0 8px 20px rgba(15,23,42,.15);font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
    </div>
  `,
  iconSize: [120, 90],
  iconAnchor: [60, 90],
  popupAnchor: [0, -82],
});

function MapEffects({ points }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size on mount and after a short delay to account for sidebar animations
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 300);

    // Watch for window resize
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, points]);

  return null;
}

export default function LiveMap({ markers = [], route = [], heatPoints = [], height }) {
  const containerRef = useRef(null);

  const allPoints = useMemo(() => {
    if (markers.length) return markers.map((m) => ({ lat: m.lat, lng: m.lng }));
    if (route.length) return route.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (heatPoints.length) return heatPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
    return [DEFAULT_CENTER];
  }, [markers, route, heatPoints]);

  if (!markers.length && !route.length && !heatPoints.length) {
    return (
      <Card>
        <EmptyState icon={MapPin} title="No location data" subtitle="Live tracking will appear here once staff devices report their position." />
      </Card>
    );
  }

  // Use a responsive height if not provided
  const mapHeight = height || 'calc(100vh - 280px)';

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800" style={{ height: mapHeight, minHeight: '350px' }}>
      <MapContainer center={allPoints[0]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEffects points={allPoints} />

        {route.length > 1 && (
          <Polyline positions={route.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
        )}

        {heatPoints.map((point, index) => (
          <CircleMarker
            key={`${point.lat}-${point.lng}-${index}`}
            center={[point.lat, point.lng]}
            radius={8}
            pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.25, opacity: 0.2 }}
          />
        ))}

        {markers.map((marker) => (
          <Marker key={marker.staffId} position={[marker.lat, marker.lng]} icon={avatarIcon(marker)}>
            <Popup>
              <div className="space-y-1 text-slate-900">
                <p className="font-semibold text-sm">{marker.name}</p>
                <p className="text-xs text-slate-600 font-medium">{marker.position || 'Staff'}</p>
                <div className="pt-1 mt-1 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Checked In</p>
                  <p className="text-xs">{marker.checkInTime ? formatDateTime(marker.checkInTime) : 'Today'}</p>
                </div>
                <div className="pt-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Last Ping</p>
                  <p className="text-xs">{formatDateTime(marker.recordedAt)}</p>
                </div>
                {marker.batteryLevel != null && <p className="text-[10px] text-slate-500 font-bold">🔋 {marker.batteryLevel}%</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {route.length > 0 && (
          <>
            <Marker position={[route[0].lat, route[0].lng]} icon={L.divIcon({ className: '', html: '<div style="width:12px;height:12px;border-radius:9999px;background:#16a34a;border:3px solid #fff;box-shadow:0 4px 12px rgba(22,163,74,.35);"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })} />
            <Marker position={[route[route.length - 1].lat, route[route.length - 1].lng]} icon={L.divIcon({ className: '', html: '<div style="width:12px;height:12px;border-radius:9999px;background:#ef4444;border:3px solid #fff;box-shadow:0 4px 12px rgba(239,68,68,.35);"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
