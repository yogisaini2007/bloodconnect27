export type Place = {
  label: string;
  lat: number;
  lng: number;
};

const ENDPOINT = "https://nominatim.openstreetmap.org";

/** Free-text address search (OpenStreetMap Nominatim). Client-only. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ENDPOINT}/search?format=jsonv2&addressdetails=0&limit=6&q=${encodeURIComponent(q)}`;
  const init: RequestInit = { headers: { Accept: "application/json" } };
  if (signal) init.signal = signal;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error("Address search failed");
  const rows = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return rows.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

/** Turn coordinates into a readable address. Returns null when unavailable. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${ENDPOINT}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
