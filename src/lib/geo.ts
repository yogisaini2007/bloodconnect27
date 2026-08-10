export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; message: string };

/** Ask the browser for the user's current position. Client-only. */
export function requestBrowserLocation(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      resolve({ ok: false, message: "Location is not supported on this device." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings."
            : err.code === err.TIMEOUT
              ? "Getting your location timed out. Try again."
              : "Could not determine your location.";
        resolve({ ok: false, message });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** Haversine distance in km — mirrors the database distance_km() function. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
