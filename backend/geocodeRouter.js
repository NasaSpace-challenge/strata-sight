/**
 * Place search for "Where?":
 *   GET /?q=Lahore                  city/place name -> coordinates (Open-Meteo geocoding, GeoNames-based, no key)
 *   GET /reverse?lat=..&lon=..      coordinates -> city, state, country, continent (BigDataCloud, OSM Nominatim fallback)
 *   GET /country?code=PK            ISO country code -> country centre point (for a country-level view)
 * Proxied here so the browser makes same-origin requests and so we can cache and rate-limit them.
 */
import express from 'express';

export const geocodeRouter = express.Router();

const UA = 'StrataSight-NASA-SpaceApps/3.0';
const TTL_MS = 60 * 60 * 1000;

function makeCache(max = 500) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      return hit && Date.now() - hit.at < TTL_MS ? hit.value : undefined;
    },
    set(key, value) {
      map.set(key, { at: Date.now(), value });
      if (map.size > max) map.delete(map.keys().next().value);
    }
  };
}

const searchCache = makeCache();
const reverseCache = makeCache(2000);
const countryCache = makeCache(300);

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await globalThis.fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const unavailable = (res, e, what) =>
  res.status(502).json({
    error: 'GEOCODER_UNAVAILABLE',
    message: e?.name === 'AbortError' ? `The ${what} service timed out.` : `The ${what} service is unreachable.`
  });

// ---- forward: name -> coordinates -------------------------------------------------------------
geocodeRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2 || q.length > 80) {
    return res.status(400).json({ error: 'BAD_QUERY', message: 'Type at least 2 characters (max 80).' });
  }
  const key = q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return res.json({ results: hit, cached: true });
  try {
    const body = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
    );
    const results = (body.results ?? [])
      .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map(p => ({
        name: p.name,
        admin1: p.admin1 ?? null,
        country: p.country ?? null,
        countryCode: p.country_code ?? null,
        lat: Number(p.latitude.toFixed(3)),
        lon: Number(p.longitude.toFixed(3))
      }));
    searchCache.set(key, results);
    res.json({ results });
  } catch (e) {
    unavailable(res, e, 'place-search');
  }
});

// ---- reverse: coordinates -> where am I? ------------------------------------------------------
async function reverseBigDataCloud(lat, lon) {
  const b = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  );
  const name = b.city || b.locality || null;
  if (!name && !b.countryName) throw new Error('empty result');
  return {
    name,
    admin1: b.principalSubdivision || null,
    country: b.countryName || null,
    countryCode: b.countryCode || null,
    continent: b.continent || null
  };
}

async function reverseNominatim(lat, lon) {
  const b = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=en`
  );
  const a = b.address ?? {};
  const name = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district || null;
  if (!name && !a.country) throw new Error('empty result');
  return {
    name,
    admin1: a.state || null,
    country: a.country || null,
    countryCode: a.country_code ? String(a.country_code).toUpperCase() : null,
    continent: null
  };
}

geocodeRouter.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'BAD_COORDS', message: 'lat must be within ±90 and lon within ±180.' });
  }
  const la = Number(lat.toFixed(2));
  const lo = Number(lon.toFixed(2));
  const key = `${la},${lo}`;
  const hit = reverseCache.get(key);
  if (hit) return res.json({ place: hit, cached: true });
  let place = null;
  let lastError;
  for (const provider of [reverseBigDataCloud, reverseNominatim]) {
    try {
      place = await provider(la, lo);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!place) return unavailable(res, lastError, 'reverse-geocoding');
  const result = { ...place, lat: la, lon: lo };
  reverseCache.set(key, result);
  res.json({ place: result });
});

// ---- country centre point ---------------------------------------------------------------------
geocodeRouter.get('/country', async (req, res) => {
  const code = String(req.query.code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return res.status(400).json({ error: 'BAD_CODE', message: 'Provide a two-letter ISO country code.' });
  }
  const name = String(req.query.name ?? '').trim().slice(0, 80);
  const hit = countryCache.get(code);
  if (hit) return res.json({ country: hit, cached: true });
  if (!name) return res.status(400).json({ error: 'BAD_NAME', message: 'Provide the country name too.' });
  try {
    const body = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`
    );
    const c = (body.results ?? []).find(p => p.feature_code === 'PCLI' && String(p.country_code).toUpperCase() === code);
    if (!c) return res.status(404).json({ error: 'COUNTRY_NOT_FOUND', message: `No centre point found for ${name}.` });
    const country = { name: c.name, countryCode: code, lat: Number(c.latitude.toFixed(2)), lon: Number(c.longitude.toFixed(2)) };
    countryCache.set(code, country);
    res.json({ country });
  } catch (e) {
    unavailable(res, e, 'country-lookup');
  }
});
