/** Client for "See it from space": NASA imagery, natural events and media, all through the StrataSight backend. */

export interface ImageryLayer {
  key: string;
  id: string;
  group: 'photo' | 'science' | 'night';
  label: string;
  sensor: string;
  resolution: string;
  maxZoom: number;
  description: string;
  ramp?: string[];
  rampLow?: string;
  rampHigh?: string;
  start: string;
  end: string;
  fixedTime: string | null;
  tileTemplate: string;
}

export interface LayersResponse {
  layers: ImageryLayer[];
  base: { template: string; maxZoom: number };
  labels: { template: string; maxZoom: number };
  attribution: string;
}

export interface BestCandidate {
  date: string;
  cloudPct: number;
  noDataPct: number;
  brightness?: number;
}

export interface BestResponse {
  layer: string;
  candidates: BestCandidate[];
  best: BestCandidate | null;
}

export interface SpaceEvent {
  id: string;
  title: string;
  category: { id: string; title: string };
  status: 'open' | 'closed';
  date: string;
  lat: number;
  lon: number;
  magnitude: { value: number; unit: string } | null;
  sources: { id: string; url: string }[];
  link: string;
  distanceKm?: number;
  direction?: string;
}

export interface EventsResponse {
  radiusKm: number;
  nearby: SpaceEvent[];
  elsewhere: SpaceEvent[];
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  title: string;
  description: string;
  date: string | null;
  credit: string;
  thumb: string;
  image: string | null;
  page: string;
  matched: string;
}

export interface EpicLatest {
  imageUrl: string;
  thumbUrl: string;
  date: string;
  lat: number | null;
  lon: number | null;
  caption: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = 'NASA service is unavailable right now.';
    try {
      message = (await res.json()).message || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

// ---- layers (one request per page load) -----------------------------------------------------------
let layersPromise: Promise<LayersResponse> | null = null;
export function fetchLayers(): Promise<LayersResponse> {
  if (!layersPromise) {
    layersPromise = getJson<LayersResponse>('/api/imagery/layers').catch(e => {
      layersPromise = null; // allow a retry
      throw e;
    });
  }
  return layersPromise;
}

// ---- best (clearest) recent day -------------------------------------------------------------------
const bestCache = new Map<string, Promise<BestResponse>>();
export function fetchBest(
  layer: string,
  lat: number,
  lon: number,
  opts: { end?: string; days?: number; span?: number } = {}
): Promise<BestResponse> {
  const params = new URLSearchParams({ layer, lat: String(lat), lon: String(lon), days: String(opts.days ?? 7), span: String(opts.span ?? 100) });
  if (opts.end) params.set('end', opts.end);
  const key = params.toString();
  let p = bestCache.get(key);
  if (!p) {
    p = getJson<BestResponse>(`/api/imagery/best?${key}`).catch(e => {
      bestCache.delete(key);
      throw e;
    });
    bestCache.set(key, p);
  }
  return p;
}

export function snapshotUrl(layer: string, lat: number, lon: number, date: string, opts: { span?: number; size?: number } = {}): string {
  const params = new URLSearchParams({
    layer,
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    date,
    span: String(opts.span ?? 100),
    size: String(opts.size ?? 640)
  });
  return `/api/imagery/snapshot?${params}`;
}

export const worldviewUrl = (layerId: string, lat: number, lon: number, date: string, zoomDeg = 2): string => {
  const box = [lon - zoomDeg, lat - zoomDeg, lon + zoomDeg, lat + zoomDeg].map(v => v.toFixed(2)).join(',');
  const base = layerId.includes('TrueColor') ? '' : ',BlueMarble_ShadedRelief_Bathymetry';
  return `https://worldview.earthdata.nasa.gov/?v=${box}&l=${layerId}${base}&t=${date}`;
};

export const fetchEvents = (lat: number, lon: number, radiusKm = 600, signal?: AbortSignal) =>
  getJson<EventsResponse>(`/api/events?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`, signal);

export const fetchMedia = (queries: string[], signal?: AbortSignal) =>
  getJson<{ items: MediaItem[] }>(`/api/media?${queries.map(q => `q=${encodeURIComponent(q)}`).join('&')}`, signal);

export const fetchVideoAsset = (id: string) =>
  getJson<{ videoUrl: string | null; captionsUrl: string | null }>(`/api/media/asset?id=${encodeURIComponent(id)}`);

export const fetchEpicLatest = () => getJson<EpicLatest>('/api/epic/latest');

export type EpicCollection = 'natural' | 'enhanced';

export interface EpicImage {
  image: string;
  /** "YYYY-MM-DD HH:MM:SS", UTC */
  date: string;
  lat: number | null;
  lon: number | null;
  imageUrl: string;
  thumbUrl: string;
  pngUrl: string;
  /** Distance of the DSCOVR spacecraft, the Moon and the Sun from the centre of the Earth */
  spacecraftKm: number | null;
  moonKm: number | null;
  sunAu: number | null;
}

export interface EpicDay {
  collection: EpicCollection;
  date: string;
  images: EpicImage[];
}

const epicDatesCache = new Map<EpicCollection, Promise<string[]>>();
/** Every day NASA has published EPIC pictures for, newest first. */
export function fetchEpicDates(collection: EpicCollection): Promise<string[]> {
  let p = epicDatesCache.get(collection);
  if (!p) {
    p = getJson<{ dates: string[] }>(`/api/epic/dates?collection=${collection}`)
      .then(r => r.dates)
      .catch(e => {
        epicDatesCache.delete(collection);
        throw e;
      });
    epicDatesCache.set(collection, p);
  }
  return p;
}

const epicDayCache = new Map<string, Promise<EpicDay>>();
export function fetchEpicDay(date: string, collection: EpicCollection): Promise<EpicDay> {
  const key = `${collection}|${date}`;
  let p = epicDayCache.get(key);
  if (!p) {
    p = getJson<EpicDay>(`/api/epic/day?date=${date}&collection=${collection}`).catch(e => {
      epicDayCache.delete(key);
      throw e;
    });
    epicDayCache.set(key, p);
  }
  return p;
}

/** Mean solar time at a longitude for a UTC "YYYY-MM-DD HH:MM:SS" stamp, as "HH:MM" (ignores the equation of time). */
export function localSolarTime(utc: string, lon: number): string {
  const [h, m] = utc.slice(11, 16).split(':').map(Number);
  const minutes = (((h * 60 + m + lon * 4) % 1440) + 1440) % 1440;
  const hh = Math.floor(minutes / 60);
  const mm = Math.round(minutes % 60);
  return `${String(mm === 60 ? (hh + 1) % 24 : hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
}

export const formatKm = (km: number): string => `${km.toLocaleString('en-GB')} km`;

// ---- which picture best matches a scientific variable ---------------------------------------------
const VARIABLE_LAYER: Record<string, string> = {
  t2m: 'lst',
  aod550: 'aerosol',
  omi_no2: 'no2',
  gpm_precip: 'rain',
  precip_merra2: 'rain',
  soil_wetness: 'ndvi'
};
export const layerKeyForVariable = (variableId: string): string | null => VARIABLE_LAYER[variableId] ?? null;

// ---- small formatting helpers --------------------------------------------------------------------
export function formatDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function clampDate(iso: string, layer: Pick<ImageryLayer, 'start' | 'end'>): string {
  return iso < layer.start ? layer.start : iso > layer.end ? layer.end : iso;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  return formatDay(iso);
}

/** Search terms for the NASA media library from a place description: most specific first, no duplicates. */
export function mediaQueriesFor(parts: { name?: string | null; admin1?: string | null; country?: string | null }): string[] {
  const clean = (s?: string | null) => (s ?? '').split('(')[0].replace(/\s+/g, ' ').trim();
  const list = [clean(parts.name), clean(parts.country)].filter(s => s.length >= 2);
  if (list.length < 2 && parts.admin1) list.splice(1, 0, clean(parts.admin1));
  return [...new Set(list)].slice(0, 3);
}
