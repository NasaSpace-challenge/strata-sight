/** Pure helpers for "See it from space" (no network): geometry, cloud estimation, and normalisers. Unit-tested. */

const KM_PER_DEG = 111.32;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Square-on-the-ground bounding box [south, west, north, east] around a point, half-width `spanKm / 2`. */
export function snapshotBbox(lat, lon, spanKm) {
  const half = spanKm / 2;
  const dLat = half / KM_PER_DEG;
  const cos = Math.max(0.05, Math.cos((clamp(lat, -85, 85) * Math.PI) / 180));
  const dLon = dLat / cos;
  const south = clamp(lat - dLat, -90, 90);
  const north = clamp(lat + dLat, -90, 90);
  const west = clamp(lon - dLon, -180, 180);
  const east = clamp(lon + dLon, -180, 180);
  return [south, west, north, east].map(v => Number(v.toFixed(5)));
}

export function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(aLat, aLon, bLat, bLon) {
  const rad = Math.PI / 180;
  const y = Math.sin((bLon - aLon) * rad) * Math.cos(bLat * rad);
  const x = Math.cos(aLat * rad) * Math.sin(bLat * rad) - Math.sin(aLat * rad) * Math.cos(bLat * rad) * Math.cos((bLon - aLon) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = deg => COMPASS[Math.round(deg / 45) % 8];

/**
 * Rough share of a true-colour image that is no-data (black), and of the valid part that looks like cloud (or snow).
 * `rgba` is a flat RGBA byte array, as produced by jpeg-js. This is an estimate, not a cloud mask: snow and thick haze
 * can read as cloud, so the UI calls it "estimated".
 */
export function analyzeTrueColor(rgba, width, height) {
  const total = width * height;
  let noData = 0;
  let cloud = 0;
  let lum = 0;
  for (let i = 0; i < total; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 14) noData++;
    else {
      lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (min > 175 && max - min < 45) cloud++;
    }
  }
  const valid = total - noData;
  return {
    noDataPct: Math.round((noData / total) * 100),
    cloudPct: valid > 0 ? Math.round((cloud / valid) * 100) : 100,
    // mean brightness of the valid pixels (0-255); very dim passes are poor pictures even without cloud
    brightness: valid > 0 ? Math.round(lum / valid) : 0
  };
}

/** Candidates are {date, cloudPct, noDataPct}. Prefer the newest day among the clearest usable ones. */
export function chooseBest(candidates, { maxNoData = 25, tolerance = 8 } = {}) {
  const usable = candidates.filter(c => c.noDataPct <= maxNoData);
  if (!usable.length) return null;
  const minCloud = Math.min(...usable.map(c => c.cloudPct));
  const clear = usable.filter(c => c.cloudPct <= minCloud + tolerance);
  // among equally clear days, drop the dim ones (low sun, haze, swath edges) when brightness is known
  const known = clear.filter(c => typeof c.brightness === 'number');
  const maxBrightness = known.length ? Math.max(...known.map(c => c.brightness)) : 0;
  const lit = clear.filter(c => typeof c.brightness !== 'number' || c.brightness >= maxBrightness * 0.75);
  return lit.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/** `days` consecutive dates ending at `end` (inclusive), newest first, clipped to [start, end]. */
export function dateWindow(end, days, start) {
  const out = [];
  const t = new Date(`${end}T00:00:00Z`).getTime();
  for (let i = 0; i < days; i++) {
    const d = new Date(t - i * 86400000).toISOString().slice(0, 10);
    if (start && d < start) break;
    out.push(d);
  }
  return out;
}

export const isIsoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

// ---- EONET -------------------------------------------------------------------------------------
function ringCentroid(coords) {
  const pts = Array.isArray(coords[0]) ? coords : [coords];
  const ring = Array.isArray(pts[0][0]) ? pts[0] : pts;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

/** Turns an EONET event into a flat record, or null when it has no usable location. */
export function normalizeEvent(e, origin) {
  const geoms = (e.geometry ?? []).filter(g => g?.coordinates);
  if (!geoms.length) return null;
  const latest = geoms.reduce((a, b) => (new Date(b.date) > new Date(a.date) ? b : a));
  const [lon, lat] = latest.type === 'Point' ? latest.coordinates : ringCentroid(latest.coordinates);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const cat = e.categories?.[0] ?? { id: 'unknown', title: 'Event' };
  const out = {
    id: e.id,
    title: e.title,
    category: { id: cat.id, title: cat.title },
    status: e.closed ? 'closed' : 'open',
    date: latest.date,
    lat: Number(lat.toFixed(3)),
    lon: Number(lon.toFixed(3)),
    magnitude: latest.magnitudeValue != null ? { value: latest.magnitudeValue, unit: latest.magnitudeUnit ?? '' } : null,
    sources: (e.sources ?? []).slice(0, 3).map(s => ({ id: s.id, url: s.url })),
    link: e.link
  };
  if (origin) {
    out.distanceKm = Math.round(distanceKm(origin.lat, origin.lon, out.lat, out.lon));
    out.direction = compassPoint(bearingDeg(origin.lat, origin.lon, out.lat, out.lon));
  }
  return out;
}

// ---- NASA Image & Video Library --------------------------------------------------------------------
const https = u => (typeof u === 'string' ? u.replace(/^http:\/\//, 'https://') : u);
const stripHtml = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// The library also holds Mars, Moon and deep-space imagery ("Indus Vallis" is on Mars). Only Earth views belong here.
const OFF_EARTH = /\b(mars|martian|venus|lunar|moon|jupiter|saturn|titan|mercury|pluto|europa|enceladus|asteroid|comet|nebula|galaxy|exoplanet)\b/i;

export function normalizeMediaItem(item, matched) {
  const d = item?.data?.[0];
  if (d && OFF_EARTH.test(`${d.title ?? ''} ${d.description ?? ''} ${(d.keywords ?? []).join(' ')}`)) return null;
  const thumb = https(item?.links?.find(l => l.rel === 'preview')?.href ?? item?.links?.[0]?.href);
  if (!d?.nasa_id || !thumb || (d.media_type !== 'image' && d.media_type !== 'video')) return null;
  const desc = stripHtml(d.description);
  return {
    id: d.nasa_id,
    type: d.media_type,
    title: stripHtml(d.title),
    description: desc.length > 320 ? `${desc.slice(0, 317)}…` : desc,
    date: d.date_created ?? null,
    credit: stripHtml(d.photographer || d.secondary_creator || d.center || 'NASA'),
    thumb,
    image: d.media_type === 'image' ? thumb.replace('~thumb.', '~medium.') : null,
    page: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
    matched
  };
}

/** Pick the best web-friendly MP4 from a NASA asset listing. */
export function pickVideoUrl(assets) {
  const mp4 = assets.filter(u => /\.mp4$/i.test(u));
  for (const tag of ['~medium', '~small', '~mobile', '~large', '~orig']) {
    const hit = mp4.find(u => u.includes(tag));
    if (hit) return https(hit);
  }
  return mp4[0] ? https(mp4[0]) : null;
}

/** Interleave result lists so the most specific query leads but others still appear; dedupe by id. */
export function mergeRoundRobin(lists, limit) {
  const seen = new Set();
  const out = [];
  for (let i = 0; out.length < limit && lists.some(l => i < l.length); i++) {
    for (const l of lists) {
      const item = l[i];
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

/** EPIC archive URL for an image name and its timestamp, e.g. epic_1b_20261112000830 + "2026-11-12 00:08:30". */
export function epicUrls(image, date, collection = 'natural') {
  const [y, m, d] = String(date).slice(0, 10).split('-');
  const base = `https://epic.gsfc.nasa.gov/archive/${collection}/${y}/${m}/${d}`;
  return { image: `${base}/jpg/${image}.jpg`, thumb: `${base}/thumbs/${image}.jpg`, png: `${base}/png/${image}.png` };
}

const norm = v => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

/**
 * One EPIC record -> what the viewer needs. Positions in the record are geocentric J2000 vectors in km,
 * so their length is the distance from the centre of the Earth.
 */
export function normalizeEpicImage(raw, collection = 'natural') {
  const urls = epicUrls(raw.image, raw.date, collection);
  const c = raw.centroid_coordinates ?? raw.coords?.centroid_coordinates ?? null;
  const dscovr = raw.dscovr_j2000_position ?? raw.coords?.dscovr_j2000_position ?? null;
  const moon = raw.lunar_j2000_position ?? raw.coords?.lunar_j2000_position ?? null;
  const sun = raw.sun_j2000_position ?? raw.coords?.sun_j2000_position ?? null;
  return {
    image: raw.image,
    date: raw.date, // "YYYY-MM-DD HH:MM:SS" in UTC
    lat: c ? c.lat : null,
    lon: c ? c.lon : null,
    imageUrl: urls.image,
    thumbUrl: urls.thumb,
    pngUrl: urls.png,
    spacecraftKm: dscovr ? Math.round(norm(dscovr)) : null,
    moonKm: moon ? Math.round(norm(moon)) : null,
    sunAu: sun ? Number((norm(sun) / 149597870.7).toFixed(4)) : null
  };
}
