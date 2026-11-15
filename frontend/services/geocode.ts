export interface PlaceResult {
  name: string;
  admin1: string | null;
  country: string | null;
  countryCode?: string | null;
  continent?: string | null;
  lat: number;
  lon: number;
}

export function placeLabel(p: Pick<PlaceResult, 'name' | 'admin1' | 'country'>): string {
  // avoid "Singapore, Singapore"
  const parts = [p.name, p.admin1, p.country].filter((x): x is string => !!x);
  return parts.filter((part, i) => parts.indexOf(part) === i).join(', ');
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = 'The location service is unavailable right now.';
    try {
      message = (await res.json()).message || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Coordinates -> city / state / country / continent. Rejects with a readable Error if the lookup fails. */
export async function reversePlace(lat: number, lon: number, signal?: AbortSignal): Promise<PlaceResult> {
  const { place } = await getJson<{ place: PlaceResult }>(`/api/geocode/reverse?lat=${lat}&lon=${lon}`, signal);
  return place;
}

/** Centre point of a country, for a country-level view. Resolves null when unknown. */
export async function fetchCountryCenter(
  code: string,
  name: string,
  signal?: AbortSignal
): Promise<{ name: string; lat: number; lon: number } | null> {
  try {
    const { country } = await getJson<{ country: { name: string; lat: number; lon: number } }>(
      `/api/geocode/country?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`,
      signal
    );
    return country;
  } catch {
    return null;
  }
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Search a city or place name; throws an Error with a user-readable message on failure. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) {
    let message = 'Place search is unavailable right now.';
    try {
      message = (await res.json()).message || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  const body = await res.json();
  return body.results as PlaceResult[];
}

export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported';

export const LOCATION_MESSAGES: Record<LocationFailure, string> = {
  denied: 'Location access is blocked for this site. Allow it in your browser’s site settings, or search for a place instead.',
  unavailable: 'Your device could not work out its position (common on desktops without GPS or Wi-Fi location). Search for a place instead.',
  timeout: 'Finding your location took too long. Try again, or search for a place instead.',
  insecure: 'Browsers only share location on secure pages (HTTPS or localhost). Search for a place instead.',
  unsupported: 'This browser does not support location. Search for a place instead.'
};

/** Resolves with coordinates or rejects with a LocationFailure code. */
export function getBrowserPosition(): Promise<{ lat: number; lon: number; accuracyMeters: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject('unsupported' as LocationFailure);
    if (typeof window !== 'undefined' && window.isSecureContext === false) return reject('insecure' as LocationFailure);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyMeters: pos.coords.accuracy }),
      err => reject((err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable') as LocationFailure),
      // Coarse location is plenty for a 0.5° grid cell; a long timeout lets the user answer the permission prompt.
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 }
    );
  });
}
