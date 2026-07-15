import { useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, CircleMarker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { formatDateTime, formatTime, toLocalDateString } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 27.7172, lng: 85.324 }; // Kathmandu

function MapEffects({ points, focusedId, markers }) {
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
    // Priority 1: If a specific staff is focused, zoom in deep (5m equivalent)
    if (focusedId && markers?.length) {
      const target = markers.find(m => m.staffId === focusedId);
      if (target && target.lat != null) {
        map.setView([target.lat, target.lng], 19, { animate: true }); // Level 19-20 is very deep zoom
        return;
      }
    }

    // Priority 2: General point fitting
    if (!points || !points.length) return;
    if (points.length === 1) {
      if (points[0].lat != null) map.setView([points[0].lat, points[0].lng], 18);
      return;
    }
    const validPoints = points.filter(p => p.lat != null);
    if (!validPoints.length) return;

    const bounds = L.latLngBounds(validPoints.map((p) => [p.lat, p.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [map, points, focusedId, markers]);

  return null;
}

export default function LiveMap({ markers = [], route = [], attendance = [], heatPoints = [], markerInterval = 60, height, focusedId, onMarkerClick }) {
  const containerRef = useRef(null);

  const avatarIcon = useCallback((item, selected = false) => {
    if (!L || !L.divIcon) return null;
    return L.divIcon({
      className: '',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translate(-50%,-100%);">
          <div style="width:${selected ? 58 : 50}px;height:${selected ? 58 : 50}px;border-radius:9999px;border:3px solid #fff;box-shadow:0 10px 24px rgba(15,23,42,.25);overflow:hidden;background:#e2e8f0;">
            ${item.profilePhoto ? `<img src="${item.profilePhoto}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;" />` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:bold 18px Arial;color:#334155;">${(item.name || '?').slice(0, 1)}</div>`}
          </div>
          <div style="max-width:120px;padding:4px 8px;border-radius:9999px;background:rgba(255,255,255,.95);box-shadow:0 8px 20px rgba(15,23,42,.15);font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
        </div>
      `,
      iconSize: [120, 90],
      iconAnchor: [60, 90],
      popupAnchor: [0, -82],
    });
  }, []);

  const labelIcon = useCallback((label, color = '#2563eb', time = null) => {
    if (!L || !L.divIcon) return null;
    return L.divIcon({
      className: '',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="background:${color};color:white;width:28px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
            ${label}
          </div>
          ${time ? `<div style="font-size:10px;font-weight:bold;background:white;color:#334155;padding:1px 4px;border-radius:4px;border:1px solid #cbd5e1;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.1);">${formatTime(time)}</div>` : ''}
        </div>
      `,
      iconSize: [64, 48],
      iconAnchor: [32, 14],
      popupAnchor: [0, -14],
    });
  }, []);

  const routeMarkers = useMemo(() => {
    const items = [];
    const days = {};

    // Group attendance by date
    (attendance || []).forEach((a) => {
      const d = a.date;
      if (!days[d]) days[d] = { attendance: [], points: [] };
      days[d].attendance.push(a);
    });

    // Group logs by date
    (route || []).forEach((p) => {
      const d = toLocalDateString(p.recordedAt);
      if (!days[d]) days[d] = { attendance: [], points: [] };
      days[d].points.push(p);
    });

    const sortedDays = Object.keys(days).sort();
    const isMultiDay = sortedDays.length > 1;

    sortedDays.forEach((day, dayIdx) => {
      const dayData = days[day];
      let charCode = 65; // 'A'
      let lastMarkerTime = null;

      // For multi-day view, prefix labels with day number (1A, 1B, 2A...)
      // Day 1 is the earliest date
      const dayPrefix = isMultiDay ? `${dayIdx + 1}` : '';

      // Add Check-ins for the day
      dayData.attendance.forEach((a) => {
        if (a?.checkIn?.lat != null) {
          const checkInTime = new Date(a.checkIn.time);
          items.push({
            lat: a.checkIn.lat,
            lng: a.checkIn.lng,
            label: `${dayPrefix}A`,
            time: a.checkIn.time,
            address: a.checkIn.address,
            type: `Check-In (${day})`,
            color: '#16a34a'
          });
          charCode = 66; // Next is 'B'
          if (!lastMarkerTime || checkInTime > lastMarkerTime) {
            lastMarkerTime = checkInTime;
          }
        }
      });

      // Add Logs for the day
      dayData.points.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)).forEach((p) => {
        if (p?.lat != null) {
          const currentTime = new Date(p.recordedAt);
          const shouldAddMarker = !lastMarkerTime ||
            (currentTime.getTime() - lastMarkerTime.getTime()) >= (markerInterval * 60000);

          if (shouldAddMarker) {
            items.push({
              lat: p.lat,
              lng: p.lng,
              label: `${dayPrefix}${String.fromCharCode(charCode)}`,
              time: p.recordedAt,
              address: p.address,
              type: `Location Ping (${day})`,
              color: '#2563eb'
            });
            lastMarkerTime = currentTime;
            charCode++;
            if (charCode > 90) charCode = 65;
          }
        }
      });

      // Add Check-outs for the day
      dayData.attendance.forEach((a) => {
        if (a?.checkOut?.lat != null) {
          items.push({
            lat: a.checkOut.lat,
            lng: a.checkOut.lng,
            label: isMultiDay ? `${dayPrefix}OUT` : 'OUT',
            time: a.checkOut.time,
            address: a.checkOut.address,
            type: `Check-Out (${day})`,
            color: '#ef4444'
          });
        }
      });
    });

    return items;
  }, [route, attendance, markerInterval]);

  const allPoints = useMemo(() => {
    let pts = [];
    if (markers?.length > 0) {
      const active = markers.filter(m => m.lat != null);
      if (active.length > 0) pts = active.map(m => ({ lat: m.lat, lng: m.lng }));
    }

    if (pts.length === 0 && route?.length > 0) {
      const activeRoute = route.filter(p => p.lat != null);
      if (activeRoute.length > 0) pts = activeRoute;
    }

    if (pts.length === 0 && routeMarkers?.length > 0) {
      pts = routeMarkers;
    }

    if (pts.length === 0 && heatPoints?.length > 0) {
      const activeHeat = heatPoints.filter(p => p.lat != null);
      if (activeHeat.length > 0) pts = activeHeat.map(p => ({ lat: p.lat, lng: p.lng }));
    }

    return pts.length > 0 ? pts : [DEFAULT_CENTER];
  }, [markers, routeMarkers, heatPoints]);

  const hasData = markers?.length > 0 || routeMarkers?.length > 0 || heatPoints?.length > 0;

  if (!hasData) {
    return (
      <Card>
        <EmptyState icon={MapPin} title="No location data" subtitle="Live tracking will appear here once staff devices report their position." />
      </Card>
    );
  }

  const mapHeight = height || 'calc(100vh - 280px)';

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800" style={{ height: mapHeight, minHeight: '350px' }}>
      <MapContainer center={[allPoints[0].lat, allPoints[0].lng]} zoom={13} maxZoom={20} style={{ width: '100%', height: '100%' }} zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />
        <MapEffects points={allPoints} focusedId={focusedId} markers={markers} />

        {route.length > 1 && (
          <Polyline
            positions={route.filter(p => p.lat != null).map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8, lineJoin: 'round' }}
          />
        )}

        {heatPoints.map((point, index) => (
          <CircleMarker
            key={`heat-${index}`}
            center={[point.lat, point.lng]}
            radius={8}
            pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.25, opacity: 0.2 }}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.staffId}
            position={[marker.lat, marker.lng]}
            icon={avatarIcon(marker, focusedId === marker.staffId)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker)
            }}
          >
            <Popup>
              <div className="space-y-1 text-slate-900">
                <p className="font-semibold text-sm">{marker.name}</p>
                <p className="text-xs text-slate-600 font-medium">{marker.position || 'Staff'}</p>
                <div className="pt-1 mt-1 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Last Location</p>
                  <p className="text-xs font-semibold">{marker.address || 'Loading address...'}</p>
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

        {routeMarkers.map((p, idx) => (
          <Marker key={`route-${idx}`} position={[p.lat, p.lng]} icon={labelIcon(p.label, p.color, p.time)}>
             <Popup>
               <div className="text-sm max-w-[200px]">
                 <p className="font-bold text-blue-600">{p.type}</p>
                 <p className="font-medium">{formatDateTime(p.time)}</p>
                 {p.address && <p className="mt-1 text-slate-700 font-semibold border-t pt-1 border-slate-100">{p.address}</p>}
                 <p className="text-[10px] text-slate-400 mt-1">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>
               </div>
             </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
