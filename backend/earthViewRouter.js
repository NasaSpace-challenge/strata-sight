/**
 * "See it from space": real NASA imagery, events and media for any place on Earth.
 *
 *   /api/imagery/layers    GIBS layer catalog with live date ranges and tile URL templates
 *   /api/imagery/snapshot  a still image of a place on a date (NASA Worldview Snapshots), disk-cached
 *   /api/imagery/best      which recent day has the clearest view (estimated from a tiny snapshot)
 *   /api/events            natural events near a place (NASA EONET) plus a few happening elsewhere
 *   /api/media             photos and videos from the NASA Image & Video Library for a place
 *   /api/media/asset       the playable MP4 for a library video
 *   /api/epic/latest       the newest whole-Earth photo from the DSCOVR EPIC camera
 *
 * Everything is a thin, cached, validated proxy: nothing here is generated or simulated.
 */
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { BASE_LAYER, LABELS_LAYER, getLayerCatalog, layerByKey } from './imageryLayers.js';
import {
  analyzeTrueColor,
  chooseBest,
  clamp,
  dateWindow,
  epicUrls,
  normalizeEpicImage,
  isIsoDate,
  mergeRoundRobin,
  normalizeEvent,
  normalizeMediaItem,
  pickVideoUrl,
  snapshotBbox
} from './earthViewLogic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_CACHE_DIR = process.env.STRATASIGHT_IMAGERY_DIR || process.env.EARTHPULSE_IMAGERY_DIR || path.join(here, 'imagery-cache');
fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });

const UA = 'StrataSight-NASA-SpaceApps/3.0';
const today = () => new Date().toISOString().slice(0, 10);

// ---- small utilities ---------------------------------------------------------------------------
function makeLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return fn => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

function ttlCache(max = 500) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() > hit.until) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value, ttlMs) {
      map.set(key, { value, until: Date.now() + ttlMs });
      if (map.size > max) map.delete(map.keys().next().value);
    }
  };
}

async function fetchWithTimeout(url, ms = 20000, as = 'json') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await globalThis.fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    return as === 'buffer' ? { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? '' } : await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const upstream = makeLimiter(4); // be a polite client of NASA's servers
const sendError = (res, e, what) =>
  res.status(502).json({
    error: 'UPSTREAM_UNAVAILABLE',
    message: e?.name === 'AbortError' ? `NASA's ${what} service timed out.` : `NASA's ${what} service is unreachable right now.`
  });

function parsePlace(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: 'BAD_COORDS', message: 'lat must be within ±90 and lon within ±180.' });
    return null;
  }
  return { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
}

// ================================================================================================
// IMAGERY
// ================================================================================================
export const imageryRouter = express.Router();

imageryRouter.get('/layers', async (_req, res) => {
  try {
    res.json({
      layers: await getLayerCatalog(),
      base: BASE_LAYER,
      labels: LABELS_LAYER,
      attribution: 'Imagery: NASA EOSDIS Global Imagery Browse Services (GIBS), Worldview Snapshots. NASA does not endorse this application.'
    });
  } catch (e) {
    res.status(500).json({ error: 'LAYER_CATALOG_FAILED', message: String(e?.message || e) });
  }
});

const inflightSnapshots = new Map();

/** Resolve a snapshot to a file on disk (downloading it once). Throws Error with .status on bad input. */
async function snapshotFile({ layerKey, lat, lon, spanKm, date, size }) {
  const layer = layerByKey(layerKey);
  if (!layer) throw Object.assign(new Error('Unknown layer.'), { status: 400 });
  const catalog = (await getLayerCatalog()).find(l => l.key === layerKey);
  const when = layer.fixedTime ?? date;
  if (!layer.fixedTime) {
    if (!isIsoDate(when)) throw Object.assign(new Error('date must be YYYY-MM-DD.'), { status: 400 });
    if (when < catalog.start || when > catalog.end) {
      throw Object.assign(new Error(`${layer.label} is available from ${catalog.start} to ${catalog.end}.`), { status: 400 });
    }
  }
  const hash = crypto.createHash('sha1').update(`${layerKey}|${lat}|${lon}|${spanKm}|${when}|${size}`).digest('hex').slice(0, 24);
  const file = path.join(IMAGE_CACHE_DIR, `${hash}.jpg`);
  if (fs.existsSync(file)) return file;
  if (inflightSnapshots.has(hash)) return inflightSnapshots.get(hash);

  const job = upstream(async () => {
    const [s, w, n, e] = snapshotBbox(lat, lon, spanKm);
    const layers = layer.group === 'photo' ? layer.id : `${BASE_LAYER.id},${layer.id}`;
    // NASA's snapshot service rejects WRAP when several layers are requested, so it is omitted on purpose.
    const url =
      `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=${layers}&CRS=EPSG:4326&TIME=${when}` +
      `&BBOX=${s},${w},${n},${e}&FORMAT=image/jpeg&WIDTH=${size}&HEIGHT=${size}`;
    const { buf, type } = await fetchWithTimeout(url, 30000, 'buffer');
    if (!type.startsWith('image/') || buf[0] !== 0xff || buf[1] !== 0xd8) {
      throw Object.assign(new Error('NASA returned no image for this place and date.'), { status: 404 });
    }
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, file);
    return file;
  }).finally(() => inflightSnapshots.delete(hash));
  inflightSnapshots.set(hash, job);
  return job;
}

imageryRouter.get('/snapshot', async (req, res) => {
  const place = parsePlace(req, res);
  if (!place) return;
  const layerKey = String(req.query.layer ?? 'terra');
  const spanKm = clamp(Math.round(Number(req.query.span ?? 100)), 20, 800);
  const size = clamp(Math.round(Number(req.query.size ?? 640)), 64, 1024);
  const date = String(req.query.date ?? '');
  try {
    const file = await snapshotFile({ layerKey, ...place, spanKm, date, size });
    res.setHeader('Content-Type', 'image/jpeg');
    // A day that is not over yet can still change; older days never do.
    res.setHeader('Cache-Control', date >= today() ? 'public, max-age=1800' : 'public, max-age=86400, immutable');
    res.setHeader('X-Image-Date', date);
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    if (e.status && e.status < 500) return res.status(e.status).json({ error: 'SNAPSHOT_UNAVAILABLE', message: e.message });
    sendError(res, e, 'imagery');
  }
});

const bestCache = ttlCache(600);

imageryRouter.get('/best', async (req, res) => {
  const place = parsePlace(req, res);
  if (!place) return;
  const layerKey = String(req.query.layer ?? 'terra');
  const layer = layerByKey(layerKey);
  if (!layer || layer.group !== 'photo') return res.status(400).json({ error: 'BAD_LAYER', message: 'Pick a natural-colour layer.' });
  const spanKm = clamp(Math.round(Number(req.query.span ?? 100)), 20, 800);
  const days = clamp(Math.round(Number(req.query.days ?? 7)), 1, 14);
  try {
    const catalog = (await getLayerCatalog()).find(l => l.key === layerKey);
    let end = String(req.query.end ?? catalog.end);
    if (!isIsoDate(end)) return res.status(400).json({ error: 'BAD_DATE', message: 'end must be YYYY-MM-DD.' });
    end = end > catalog.end ? catalog.end : end;
    if (end < catalog.start) return res.status(400).json({ error: 'BAD_DATE', message: `${layer.label} starts on ${catalog.start}.` });

    const key = `${layerKey}|${place.lat}|${place.lon}|${spanKm}|${end}|${days}`;
    const hit = bestCache.get(key);
    if (hit) return res.json({ ...hit, cached: true });

    const dates = dateWindow(end, days, catalog.start);
    const candidates = await Promise.all(
      dates.map(async date => {
        try {
          const file = await snapshotFile({ layerKey, ...place, spanKm, date, size: 64 });
          const img = jpeg.decode(fs.readFileSync(file), { useTArray: true, formatAsRGBA: true });
          return { date, ...analyzeTrueColor(img.data, img.width, img.height) };
        } catch {
          return { date, cloudPct: 100, noDataPct: 100 };
        }
      })
    );
    const best = chooseBest(candidates);
    const payload = { layer: layerKey, spanKm, candidates, best, generatedAt: new Date().toISOString() };
    const recent = end >= new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    bestCache.set(key, payload, recent ? 20 * 60 * 1000 : 24 * 3600 * 1000);
    res.json(payload);
  } catch (e) {
    sendError(res, e, 'imagery');
  }
});

// ================================================================================================
// EVENTS (NASA EONET)
// ================================================================================================
export const eventsRouter = express.Router();
const eventsCache = ttlCache(300);
const ELSEWHERE_CATEGORIES = 'severeStorms,volcanoes,floods,dustHaze,landslides,seaLakeIce,earthquakes,drought,tempExtremes,snow';

eventsRouter.get('/', async (req, res) => {
  const place = parsePlace(req, res);
  if (!place) return;
  const radiusKm = clamp(Math.round(Number(req.query.radiusKm ?? 600)), 50, 2000);
  const key = `${place.lat},${place.lon},${radiusKm}`;
  const hit = eventsCache.get(key);
  if (hit) return res.json({ ...hit, cached: true });
  try {
    const dLat = radiusKm / 111.32;
    const dLon = dLat / Math.max(0.05, Math.cos((clamp(place.lat, -85, 85) * Math.PI) / 180));
    const bbox = [place.lon - dLon, place.lat + dLat, place.lon + dLon, place.lat - dLat].map(v => v.toFixed(3)).join(',');
    const [near, far] = await Promise.all([
      fetchWithTimeout(`https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30&bbox=${bbox}&limit=200`, 20000),
      fetchWithTimeout(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=${ELSEWHERE_CATEGORIES}&limit=30`, 20000).catch(() => ({ events: [] }))
    ]);
    const nearby = (near.events ?? [])
      .map(e => normalizeEvent(e, place))
      .filter(e => e && e.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 60);
    const elsewhere = (far.events ?? [])
      .map(e => normalizeEvent(e, place))
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8);
    const payload = { radiusKm, nearby, elsewhere, fetchedAt: new Date().toISOString() };
    eventsCache.set(key, payload, 10 * 60 * 1000);
    res.json(payload);
  } catch (e) {
    sendError(res, e, 'event-tracking');
  }
});

// ================================================================================================
// MEDIA (NASA Image & Video Library)
// ================================================================================================
export const mediaRouter = express.Router();
const mediaCache = ttlCache(800);
const assetCache = ttlCache(800);

async function searchLibrary(q) {
  const key = q.toLowerCase();
  const hit = mediaCache.get(key);
  if (hit) return hit;
  const body = await fetchWithTimeout(
    `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image,video&page_size=25`,
    20000
  );
  const items = (body.collection?.items ?? []).map(i => normalizeMediaItem(i, q)).filter(Boolean);
  mediaCache.set(key, items, 24 * 3600 * 1000);
  return items;
}

mediaRouter.get('/', async (req, res) => {
  const raw = [].concat(req.query.q ?? []).map(String);
  const queries = [...new Set(raw.map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 80))].slice(0, 3);
  if (!queries.length) return res.status(400).json({ error: 'BAD_QUERY', message: 'Provide up to three search terms (2–80 characters).' });
  try {
    const settled = await Promise.allSettled(queries.map(searchLibrary));
    const lists = settled.map(s => (s.status === 'fulfilled' ? s.value : []));
    if (settled.every(s => s.status === 'rejected')) throw settled[0].reason;
    res.json({ queries, items: mergeRoundRobin(lists, 36) });
  } catch (e) {
    sendError(res, e, 'media-library');
  }
});

mediaRouter.get('/asset', async (req, res) => {
  const id = String(req.query.id ?? '');
  if (!/^[\w.~() \-]{3,120}$/.test(id)) return res.status(400).json({ error: 'BAD_ID', message: 'Invalid media id.' });
  const hit = assetCache.get(id);
  if (hit) return res.json(hit);
  try {
    const body = await fetchWithTimeout(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, 20000);
    const hrefs = (body.collection?.items ?? []).map(i => i.href).filter(Boolean);
    const payload = {
      videoUrl: pickVideoUrl(hrefs),
      captionsUrl: hrefs.find(u => /\.(vtt|srt)$/i.test(u))?.replace(/^http:/, 'https:') ?? null
    };
    assetCache.set(id, payload, 24 * 3600 * 1000);
    res.json(payload);
  } catch (e) {
    sendError(res, e, 'media-library');
  }
});

// ================================================================================================
// EPIC: the whole Earth right now
// ================================================================================================
export const epicRouter = express.Router();
let epicCache = null;

epicRouter.get('/latest', async (_req, res) => {
  if (epicCache && Date.now() - epicCache.at < 30 * 60 * 1000) return res.json(epicCache.value);
  try {
    const list = await fetchWithTimeout('https://epic.gsfc.nasa.gov/api/natural', 15000);
    const latest = Array.isArray(list) ? list[list.length - 1] : null;
    if (!latest) throw new Error('empty');
    const urls = epicUrls(latest.image, latest.date);
    const value = {
      imageUrl: urls.image,
      thumbUrl: urls.thumb,
      date: latest.date,
      lat: latest.centroid_coordinates?.lat ?? null,
      lon: latest.centroid_coordinates?.lon ?? null,
      caption: latest.caption
    };
    epicCache = { at: Date.now(), value };
    res.json(value);
  } catch (e) {
    if (epicCache) return res.json({ ...epicCache.value, stale: true });
    sendError(res, e, 'EPIC');
  }
});

const EPIC_COLLECTIONS = new Set(['natural', 'enhanced']);
const epicDatesCache = new Map(); // collection -> {at, dates}
const epicDayCache = ttlCache(300);

const epicCollection = (req, res) => {
  const c = String(req.query.collection ?? 'natural');
  if (!EPIC_COLLECTIONS.has(c)) {
    res.status(400).json({ error: 'BAD_COLLECTION', message: 'collection must be natural or enhanced.' });
    return null;
  }
  return c;
};

// Every date NASA has published pictures for, newest first.
epicRouter.get('/dates', async (req, res) => {
  const collection = epicCollection(req, res);
  if (!collection) return;
  const hit = epicDatesCache.get(collection);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return res.json({ collection, dates: hit.dates });
  try {
    const list = await fetchWithTimeout(`https://epic.gsfc.nasa.gov/api/${collection}/all`, 20000);
    const dates = (Array.isArray(list) ? list : []).map(i => i.date).filter(isIsoDate);
    if (!dates.length) throw new Error('empty');
    epicDatesCache.set(collection, { at: Date.now(), dates });
    res.json({ collection, dates });
  } catch (e) {
    if (hit) return res.json({ collection, dates: hit.dates, stale: true });
    sendError(res, e, 'EPIC');
  }
});

// All pictures of one day (about 12 to 22), with the spacecraft, Moon and Sun geometry.
epicRouter.get('/day', async (req, res) => {
  const collection = epicCollection(req, res);
  if (!collection) return;
  const date = String(req.query.date ?? '');
  if (!isIsoDate(date)) return res.status(400).json({ error: 'BAD_DATE', message: 'date must be YYYY-MM-DD.' });
  const key = `${collection}|${date}`;
  const hit = epicDayCache.get(key);
  if (hit) return res.json(hit);
  try {
    const list = await fetchWithTimeout(`https://epic.gsfc.nasa.gov/api/${collection}/date/${date}`, 20000);
    if (!Array.isArray(list) || !list.length) {
      return res.status(404).json({ error: 'NO_IMAGES', message: `NASA published no EPIC pictures for ${date}.` });
    }
    const images = list.map(i => normalizeEpicImage(i, collection)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const payload = { collection, date, images };
    epicDayCache.set(key, payload, 6 * 3600 * 1000);
    res.json(payload);
  } catch (e) {
    sendError(res, e, 'EPIC');
  }
});
