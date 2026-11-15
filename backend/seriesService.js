/**
 * StrataSight: unified REAL observation / reanalysis time-series service.
 *
 * Design rules (these are what make the scientific claims defensible):
 *   1. NEVER fabricate data. If a product cannot be retrieved, we return an explicit error.
 *   2. Every value returned is traceable to an agency product, with its DOI/endpoint,
 *      native resolution, license and fetch time.
 *   3. If a live fetch fails but this exact request was fetched before, the cached copy is
 *      returned and clearly flagged as CACHED_REAL (never as live).
 *   4. Short gaps (<= MAX_GAP_MONTHS) are linearly interpolated and REPORTED; long gaps or
 *      sparse coverage are rejected instead of papering over them.
 *
 * Providers: NASA POWER (MERRA-2 / CERES), NASA Giovanni time-series (GLDAS, GPM IMERG,
 * AIRS, OMI), NOAA GML (global greenhouse-gas reference), Google Earth Engine (MODIS NDVI, optional).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { getTimeSeries, earthEngineHealth } from './datasets.js';

// Network robustness for judges' machines: (1) prefer IPv4 where IPv6 is advertised but unroutable, and
// (2) give each connection attempt 5 s instead of Node's 250 ms default, which aborts handshakes to
// distant agency servers (e.g. NOAA in Colorado) that curl and browsers reach without trouble.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout?.(5000);

const BACKEND_DIR = path.dirname(fileURLToPath(import.meta.url));
// Lives OUTSIDE backend/ on purpose: nodemon watches backend/ and restarts on any *.json change,
// so a cache inside it would restart the dev server on every first-time fetch.
const CACHE_DIR = process.env.STRATASIGHT_CACHE_DIR || process.env.EARTHPULSE_CACHE_DIR || path.join(BACKEND_DIR, '..', 'data-cache');
// Read-only seed of real fetches shipped with the repo: used ONLY when the live agency call fails
// (always served as CACHED_REAL with its original fetch date), so a demo survives a flaky network.
const SEED_DIR = process.env.STRATASIGHT_SEED_DIR || process.env.EARTHPULSE_SEED_DIR || path.join(BACKEND_DIR, 'seed-cache');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // historical monthly data is effectively immutable
const MAX_GAP_MONTHS = 3;
const MAX_MISSING_FRACTION = 0.2;

const memoryCache = new Map();

/* ------------------------------------------------------------------ helpers */

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': 'StrataSight-NASA-SpaceApps/3.0', ...(options.headers || {}) }
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw httpError(504, `Upstream timed out after ${timeoutMs / 1000}s (${new URL(url).hostname}).`);
    throw httpError(502, `Upstream unreachable (${new URL(url).hostname}): ${e?.message || e}`);
  } finally {
    clearTimeout(timer);
  }
}

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

function monthRange(startYear, endYear) {
  const out = [];
  for (let y = startYear; y <= endYear; y++) for (let m = 1; m <= 12; m++) out.push(ym(y, m));
  return out;
}

/** Put sparse {date -> value} data on a contiguous monthly axis, trimming empty leading/trailing months. */
function toContiguousSeries(map, startYear, endYear) {
  const axis = monthRange(startYear, endYear);
  let first = axis.findIndex(d => Number.isFinite(map.get(d)));
  let last = -1;
  for (let i = axis.length - 1; i >= 0; i--) {
    if (Number.isFinite(map.get(axis[i]))) { last = i; break; }
  }
  if (first === -1 || last === -1) {
    throw httpError(
      422,
      'No valid observations at this location for this product (the pixel may be over ocean/ice, masked, or outside the product record).'
    );
  }
  const dates = axis.slice(first, last + 1);
  const values = dates.map(d => (Number.isFinite(map.get(d)) ? map.get(d) : null));
  return { dates, values };
}

/** Interpolate short gaps; reject long gaps / sparse coverage. Reports exactly what was filled. */
function fillShortGaps({ dates, values }) {
  const n = values.length;
  const missing = values.filter(v => v === null).length;
  if (n < 36) {
    throw httpError(422, `Record too short for trend analysis (${n} months; need at least 36).`);
  }
  if (missing / n > MAX_MISSING_FRACTION) {
    throw httpError(
      422,
      `Too many missing months (${missing} of ${n}, ${(100 * missing / n).toFixed(0)}%). Refusing to interpolate; try another location.`
    );
  }
  const filled = values.slice();
  const interpolatedDates = [];
  let i = 0;
  while (i < n) {
    if (filled[i] !== null) { i++; continue; }
    let j = i;
    while (j < n && filled[j] === null) j++;
    const gap = j - i;
    if (gap > MAX_GAP_MONTHS || i === 0 || j === n) {
      throw httpError(
        422,
        `Data gap of ${gap} consecutive months starting ${dates[i]} exceeds the ${MAX_GAP_MONTHS}-month limit; refusing to interpolate.`
      );
    }
    const a = filled[i - 1];
    const b = filled[j];
    for (let k = i; k < j; k++) {
      filled[k] = a + ((b - a) * (k - i + 1)) / (gap + 1);
      interpolatedDates.push(dates[k]);
    }
    i = j;
  }
  return { dates, values: filled, interpolatedDates };
}

/* -------------------------------------------------------------------- cache */

function cacheKey(parts) {
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

function readDisk(key) {
  for (const dir of [CACHE_DIR, SEED_DIR]) {
    try {
      const file = path.join(dir, `${key}.json`);
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      /* try next location */
    }
  }
  return null;
}

function writeDisk(key, payload) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(payload));
  } catch (e) {
    console.warn('[series-cache] could not persist cache entry:', e.message);
  }
}

/* ---------------------------------------------------------------- providers */

const POWER_PARAMS = [
  'T2M', 'T2M_MAX', 'T2M_MIN', 'TS', 'RH2M', 'WS10M',
  'CLOUD_AMT', 'ALLSKY_SFC_SW_DWN', 'AOD_55', 'TO3', 'GWETROOT', 'PRECTOTCORR'
];

const powerBundles = new Map();

/** One POWER request returns every POWER-backed variable for a coordinate. */
async function fetchPowerBundle(lat, lon, startYear, endYear) {
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}|${startYear}|${endYear}`;
  if (powerBundles.has(key)) return powerBundles.get(key);

  const task = (async () => {
    const url =
      `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${POWER_PARAMS.join(',')}` +
      `&community=RE&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}` +
      `&start=${startYear}&end=${endYear}&format=JSON`;
    const t0 = Date.now();
    const res = await fetchWithTimeout(url, {}, 25000);
    if (!res.ok) throw httpError(res.status === 422 ? 422 : 502, `NASA POWER returned HTTP ${res.status}.`);
    const raw = await res.json();
    const parameter = raw?.properties?.parameter;
    if (!parameter) throw httpError(502, 'NASA POWER returned an unexpected payload.');
    return {
      parameter,
      latencyMs: Date.now() - t0,
      elevationMeters: raw?.geometry?.coordinates?.[2] ?? null,
      gridLat: raw?.geometry?.coordinates?.[1] ?? lat,
      gridLon: raw?.geometry?.coordinates?.[0] ?? lon
    };
  })();

  powerBundles.set(key, task);
  task.catch(() => powerBundles.delete(key));
  setTimeout(() => powerBundles.delete(key), 10 * 60 * 1000).unref?.();
  return task;
}

function powerSeries(bundle, param, startYear, endYear, transform = v => v) {
  const src = bundle.parameter[param] || {};
  const map = new Map();
  for (const [k, v] of Object.entries(src)) {
    const y = Number(k.slice(0, 4));
    const m = Number(k.slice(4, 6));
    if (m < 1 || m > 12 || y < startYear || y > endYear) continue; // skip "13" annual rows
    if (typeof v === 'number' && v > -900) map.set(ym(y, m), transform(v, y, m));
  }
  return map;
}

/** Parse NASA Giovanni time-series CSV: header metadata lines, then "YYYY-MM-DD HH:MM,value". */
function parseGiovanniCsv(csv) {
  const rows = [];
  let doi = null;
  let unit = null;
  for (const line of csv.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('doi,')) doi = t.slice(4).trim();
    else if (t.startsWith('unit,')) unit = t.slice(5).trim();
    else if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const comma = t.indexOf(',');
      const v = Number(t.slice(comma + 1));
      rows.push({ date: t.slice(0, 10), value: Number.isFinite(v) && Math.abs(v) < 1e20 && v > -9000 ? v : null });
    }
  }
  return { rows, doi, unit };
}

async function fetchGiovanni(dataId, lat, lon, startYear, endYear, timeoutMs = 60000) {
  const token = process.env.EARTHDATA_TOKEN;
  if (!token) {
    throw httpError(503, 'This variable needs a NASA Earthdata token (EARTHDATA_TOKEN) configured on the server.');
  }
  const url =
    `https://api.giovanni.earthdata.nasa.gov/timeseries?data=${encodeURIComponent(dataId)}` +
    `&location=${encodeURIComponent(`[${lat.toFixed(3)},${lon.toFixed(3)}]`)}` +
    `&time=${startYear}-01-01T00:00:00/${endYear}-12-31T23:59:59`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token.trim()}` } }, timeoutMs);
  if (!res.ok) {
    throw httpError(res.status === 401 || res.status === 403 ? 502 : res.status, `NASA Giovanni returned HTTP ${res.status} for ${dataId}.`);
  }
  return parseGiovanniCsv(await res.text());
}

function monthlyMapFromRows(rows, transform = v => v) {
  const map = new Map();
  for (const r of rows) {
    if (r.value === null) continue;
    map.set(r.date.slice(0, 7), transform(r.value, Number(r.date.slice(0, 4)), Number(r.date.slice(5, 7))));
  }
  return map;
}

/* --------------------------------------------------------- variable registry */

const POWER_LICENSE = 'U.S. Government Public Domain (NASA POWER / GMAO MERRA-2 & CERES)';
const GIOVANNI_LICENSE = 'U.S. Government Public Domain (NASA GES DISC)';

const powerVar = (param, unit, product, nativeResolution, startYear = 1981, transform = v => v) => ({
  provider: 'power',
  startYear,
  unit,
  async fetch(lat, lon, s, e) {
    const bundle = await fetchPowerBundle(lat, lon, Math.max(s, startYear), e);
    return {
      map: powerSeries(bundle, param, Math.max(s, startYear), e, transform),
      meta: {
        sourceAgency: 'NASA Langley POWER (GMAO MERRA-2 / CERES)',
        product,
        endpoint: 'power.larc.nasa.gov/api/temporal/monthly/point',
        license: POWER_LICENSE,
        nativeResolution,
        gridCell: { lat: bundle.gridLat, lon: bundle.gridLon },
        elevationMeters: bundle.elevationMeters,
        doi: null
      },
      latencyMs: bundle.latencyMs
    };
  }
});

const SERIES_REGISTRY = {
  // ---- NASA POWER / MERRA-2 / CERES (no authentication) -------------------
  t2m: powerVar('T2M', '°C', 'MERRA-2 2-m air temperature (T2M)', '0.5° × 0.625°'),
  t2m_max: powerVar('T2M_MAX', '°C', 'MERRA-2 daily-maximum 2-m air temperature (monthly mean)', '0.5° × 0.625°'),
  t2m_min: powerVar('T2M_MIN', '°C', 'MERRA-2 daily-minimum 2-m air temperature (monthly mean)', '0.5° × 0.625°'),
  ts_skin: powerVar('TS', '°C', 'MERRA-2 earth skin temperature (TS)', '0.5° × 0.625°'),
  rh2m: powerVar('RH2M', '%', 'MERRA-2 2-m relative humidity (RH2M)', '0.5° × 0.625°'),
  ws10m: powerVar('WS10M', 'm/s', 'MERRA-2 10-m wind speed (WS10M)', '0.5° × 0.625°'),
  cloud_amt: powerVar('CLOUD_AMT', '%', 'MERRA-2 / CERES cloud amount (CLOUD_AMT)', '0.5° × 0.625°'),
  sw_down: powerVar('ALLSKY_SFC_SW_DWN', 'kWh/m²/day', 'CERES SYN1deg all-sky surface shortwave downward irradiance', '1° × 1°'),
  aod550: powerVar('AOD_55', 'τ (550 nm)', 'MERRA-2 aerosol optical depth at 550 nm (AOD_55)', '0.5° × 0.625°'),
  ozone_col: powerVar('TO3', 'DU', 'MERRA-2 total column ozone (TO3)', '0.5° × 0.625°'),
  soil_wetness: powerVar('GWETROOT', 'fraction (0–1)', 'MERRA-2 root-zone soil wetness (GWETROOT)', '0.5° × 0.625°'),
  // POWER reports mm/day; convert to a monthly total so it is comparable with GPM IMERG.
  precip_merra2: powerVar(
    'PRECTOTCORR', 'mm/month',
    'MERRA-2 bias-corrected total precipitation (PRECTOTCORR), monthly total',
    '0.5° × 0.625°', 1981,
    (v, y, m) => v * daysInMonth(y, m)
  ),

  // ---- NASA GES DISC / Giovanni (needs free Earthdata token) --------------
  gpm_precip: {
    provider: 'giovanni',
    startYear: 2000,
    unit: 'mm/month',
    async fetch(lat, lon, s, e) {
      const t0 = Date.now();
      const { rows, doi } = await fetchGiovanni('GPM_3IMERGM_07_precipitation', lat, lon, Math.max(s, 2000), e);
      // Product is a monthly-mean rate in mm/hr -> monthly total in mm
      const map = monthlyMapFromRows(rows, (v, y, m) => v * 24 * daysInMonth(y, m));
      return {
        map,
        meta: {
          sourceAgency: 'NASA GES DISC / GPM IMERG',
          product: 'GPM IMERG Final Run V07 monthly precipitation (3IMERGM)',
          endpoint: 'api.giovanni.earthdata.nasa.gov/timeseries',
          license: GIOVANNI_LICENSE,
          nativeResolution: '0.1° × 0.1°',
          doi: doi || '10.5067/GPM/IMERG/3B-MONTH/07'
        },
        latencyMs: Date.now() - t0
      };
    }
  },
  gldas_soil_moist: {
    provider: 'giovanni',
    startYear: 2000,
    unit: 'kg/m²',
    async fetch(lat, lon, s, e) {
      const t0 = Date.now();
      const layers = ['SoilMoi0_10cm_inst', 'SoilMoi10_40cm_inst', 'SoilMoi40_100cm_inst'];
      const results = await Promise.all(
        layers.map(l => fetchGiovanni(`GLDAS_NOAH025_M_2_1_${l}`, lat, lon, Math.max(s, 2000), e))
      );
      const maps = results.map(r => monthlyMapFromRows(r.rows));
      const map = new Map();
      for (const [d, v0] of maps[0]) {
        const v1 = maps[1].get(d);
        const v2 = maps[2].get(d);
        if (Number.isFinite(v1) && Number.isFinite(v2)) map.set(d, v0 + v1 + v2);
      }
      return {
        map,
        meta: {
          sourceAgency: 'NASA GES DISC / GLDAS Noah Land Surface Model',
          product: 'GLDAS-2.1 Noah monthly soil moisture, 0–100 cm (sum of 0–10, 10–40, 40–100 cm layers)',
          endpoint: 'api.giovanni.earthdata.nasa.gov/timeseries',
          license: GIOVANNI_LICENSE,
          nativeResolution: '0.25° × 0.25° (land only)',
          doi: results[0].doi || '10.5067/SXAVCZFAQLNO'
        },
        latencyMs: Date.now() - t0
      };
    }
  },
  airs_skin_temp: {
    provider: 'giovanni',
    startYear: 2002,
    unit: '°C',
    async fetch(lat, lon, s, e) {
      const t0 = Date.now();
      const { rows, doi } = await fetchGiovanni('AIRS3STM_7_0_SurfSkinTemp_A', lat, lon, Math.max(s, 2002), e);
      return {
        map: monthlyMapFromRows(rows, v => v - 273.15),
        meta: {
          sourceAgency: 'NASA GES DISC / Aqua AIRS',
          product: 'AIRS Level-3 monthly surface skin temperature, ascending (daytime) orbit, v7',
          endpoint: 'api.giovanni.earthdata.nasa.gov/timeseries',
          license: GIOVANNI_LICENSE,
          nativeResolution: '1° × 1°',
          doi: doi || '10.5067/UBENJB9D3T2H'
        },
        latencyMs: Date.now() - t0
      };
    }
  },
  omi_no2: {
    provider: 'giovanni',
    startYear: 2004,
    unit: '×10¹⁵ molec/cm²',
    async fetch(lat, lon, s, e) {
      const t0 = Date.now();
      // Daily, cloud-screened tropospheric column; aggregated to monthly means (>= 5 valid days).
      const { rows, doi } = await fetchGiovanni('OMNO2d_003_ColumnAmountNO2TropCloudScreened', lat, lon, Math.max(s, 2004), e, 110000);
      const sums = new Map();
      for (const r of rows) {
        if (r.value === null || r.value <= 0) continue;
        const key = r.date.slice(0, 7);
        const cur = sums.get(key) || { sum: 0, n: 0 };
        cur.sum += r.value;
        cur.n += 1;
        sums.set(key, cur);
      }
      const map = new Map();
      for (const [k, { sum, n }] of sums) if (n >= 5) map.set(k, sum / n / 1e15);
      return {
        map,
        meta: {
          sourceAgency: 'NASA GES DISC / Aura OMI',
          product: 'OMI/Aura NO₂ tropospheric column, cloud-screened, daily L3 (OMNO2d v003), averaged to monthly',
          endpoint: 'api.giovanni.earthdata.nasa.gov/timeseries',
          license: GIOVANNI_LICENSE,
          nativeResolution: '0.25° × 0.25°',
          doi: doi || '10.5067/Aura/OMI/DATA3007',
          caveat: 'OMI row anomaly (from 2007–2009) degrades some swaths; monthly means need ≥ 5 valid days.'
        },
        latencyMs: Date.now() - t0
      };
    }
  },

  // ---- NOAA GML global greenhouse-gas reference (region-independent) -------
  co2_mlo: gmlVar('co2'),
  ch4_global: gmlVar('ch4'),

  // ---- Google Earth Engine (optional; requires a registered EE project) ----
  modis_ndvi: {
    provider: 'earthengine',
    startYear: 2001,
    unit: 'NDVI (−1…1)',
    async fetch(lat, lon, s, e) {
      const health = await earthEngineHealth();
      if (!health.ok) {
        throw httpError(503, `MODIS NDVI needs Google Earth Engine, which is not available on this server (${health.reason}).`);
      }
      const t0 = Date.now();
      const out = await getTimeSeries('modis_ndvi', lat, lon, Math.max(s, 2001), e);
      const map = new Map();
      out.dates.forEach((d, i) => { if (Number.isFinite(out.values[i])) map.set(d, out.values[i]); });
      return {
        map,
        meta: {
          sourceAgency: 'NASA LP DAAC / Terra MODIS via Google Earth Engine',
          product: 'MOD13Q1 v061 NDVI (QA-filtered, monthly mean of 16-day composites)',
          endpoint: 'earthengine.googleapis.com',
          license: 'U.S. Government Public Domain (NASA LP DAAC)',
          nativeResolution: '250 m',
          doi: '10.5067/MODIS/MOD13Q1.061'
        },
        latencyMs: Date.now() - t0
      };
    }
  }
};

function gmlVar(gas) {
  const isCh4 = gas === 'ch4';
  return {
    provider: 'noaa-gml',
    scope: 'global',
    startYear: isCh4 ? 1984 : 1958,
    unit: isCh4 ? 'ppb' : 'ppm',
    async fetch(_lat, _lon, s, e) {
      const t0 = Date.now();
      const url = isCh4
        ? 'https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt'
        : 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt';
      const res = await fetchWithTimeout(url, {}, 20000);
      if (!res.ok) throw httpError(502, `NOAA GML returned HTTP ${res.status}.`);
      const map = new Map();
      for (const line of (await res.text()).split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const c = t.split(/\s+/);
        const y = Number(c[0]);
        const m = Number(c[1]);
        const v = Number(c[3]);
        if (!Number.isFinite(y) || y < s || y > e || m < 1 || m > 12 || !(v > 0)) continue;
        map.set(ym(y, m), v);
      }
      return {
        map,
        meta: {
          sourceAgency: 'NOAA Global Monitoring Laboratory',
          product: isCh4
            ? 'Globally averaged marine-surface CH₄ monthly mean'
            : 'Mauna Loa Observatory CO₂ monthly mean',
          endpoint: 'gml.noaa.gov/webdata/ccgg/trends',
          license: 'U.S. Government Public Work (NOAA GML)',
          nativeResolution: isCh4 ? 'global mean' : 'single station (19.5°N, 155.6°W)',
          doi: null,
          caveat: 'Global reference series: identical for every region (not a satellite column retrieval).'
        },
        latencyMs: Date.now() - t0
      };
    }
  };
}

/* ------------------------------------------------------------------- public */

export function listSeriesCapabilities() {
  return Object.entries(SERIES_REGISTRY).map(([id, def]) => ({
    id,
    provider: def.provider,
    scope: def.scope || 'point',
    startYear: def.startYear,
    unit: def.unit
  }));
}

export async function getProviderAvailability() {
  const ee = await earthEngineHealth().catch(e => ({ ok: false, reason: String(e?.message || e) }));
  return {
    power: { available: true },
    'noaa-gml': { available: true },
    giovanni: {
      available: Boolean(process.env.EARTHDATA_TOKEN),
      reason: process.env.EARTHDATA_TOKEN ? undefined : 'EARTHDATA_TOKEN is not configured'
    },
    earthengine: { available: ee.ok, reason: ee.ok ? undefined : ee.reason }
  };
}

const inflightSeries = new Map();

/** Concurrent identical requests share one upstream fetch (global series ignore lat/lon). */
export function getSeries(variableId, lat, lon, startYear, endYear) {
  const def = SERIES_REGISTRY[variableId];
  const k = def?.scope === 'global'
    ? `${variableId}|${startYear}|${endYear}`
    : [variableId, lat, lon, startYear, endYear].join('|');
  if (inflightSeries.has(k)) return inflightSeries.get(k);
  const task = getSeriesUncached(variableId, lat, lon, startYear, endYear).finally(() => inflightSeries.delete(k));
  inflightSeries.set(k, task);
  return task;
}

async function getSeriesUncached(variableId, lat, lon, startYear, endYear) {
  const def = SERIES_REGISTRY[variableId];
  if (!def) throw httpError(400, `Unknown variable "${variableId}".`);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw httpError(400, 'Need lat (-90..90) and lon (-180..180).');
  }
  const thisYear = new Date().getUTCFullYear();
  const s = Math.max(def.startYear, Number.isInteger(startYear) ? startYear : def.startYear);
  const e = Math.min(thisYear - 1, Number.isInteger(endYear) ? endYear : thisYear - 1);
  if (e < s || e - s < 2) throw httpError(400, 'Invalid date range (need at least 3 years).');

  const effLat = def.scope === 'global' ? 0 : Number(lat.toFixed(2));
  const effLon = def.scope === 'global' ? 0 : Number(lon.toFixed(2));
  const key = cacheKey([variableId, effLat, effLon, s, e]);

  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return { ...mem.payload, cached: true };

  const disk = readDisk(key);
  if (disk && Date.now() - Date.parse(disk.provenance.fetchedAt) < CACHE_TTL_MS) {
    memoryCache.set(key, { at: Date.now(), payload: disk });
    return { ...disk, cached: true };
  }

  try {
    const { map, meta, latencyMs } = await def.fetch(effLat, effLon, s, e);
    const contiguous = toContiguousSeries(map, s, e);
    const { dates, values, interpolatedDates } = fillShortGaps(contiguous);

    const payload = {
      variable: variableId,
      dates,
      values: values.map(v => Number(v.toFixed(5))),
      unit: def.unit,
      interpolatedDates,
      requested: { lat, lon, startYear: s, endYear: e },
      provenance: {
        mode: 'LIVE_AGENCY_API',
        ...meta,
        provider: def.provider,
        latencyMs,
        fetchedAt: new Date().toISOString(),
        recordStart: dates[0],
        recordEnd: dates[dates.length - 1],
        months: dates.length,
        interpolatedMonths: interpolatedDates.length
      },
      cached: false
    };
    memoryCache.set(key, { at: Date.now(), payload });
    writeDisk(key, payload);
    return payload;
  } catch (err) {
    // Stale-while-error: serve a previous REAL fetch of this exact request, clearly flagged.
    if (disk && err.status !== 400 && err.status !== 422) {
      console.warn(`[series] live fetch failed for ${variableId} (${err.message}); serving cached real data.`);
      return {
        ...disk,
        cached: true,
        provenance: { ...disk.provenance, mode: 'CACHED_REAL', staleReason: err.message }
      };
    }
    throw err;
  }
}
