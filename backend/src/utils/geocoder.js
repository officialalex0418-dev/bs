import { env } from '../config/env.js';

/**
 * Reverse geocodes coordinates to a human-readable address.
 * Uses Google Maps if configured, otherwise falls back to Nominatim (OSM).
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;

  try {
    // 1. Try Google Maps if key is available
    if (env.googleMapsApiKey) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${env.googleMapsApiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results[0]) {
        return data.results[0].formatted_address;
      }
    }

    // 2. Fallback to Nominatim (OSM)
    // Zoom 18 is approx 50m radius / house level
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BusinessSarthi/1.0',
      },
    });
    const data = await res.json();
    if (data && data.display_name) {
      return data.display_name;
    }
  } catch (error) {
    console.error('Reverse Geocoding Error:', error.message);
  }
  return null;
}
