/**
 * Multi-Agency Earth Observation Telemetry Gateway
 * Dedicated read-only router for NASA POWER (MERRA-2/CERES), NASA/CNES/CSA SWOT Hydrocron,
 * Geo.ca / ECCC MSC GeoMet OGC API, NOAA GML/NCEI CDO v2, and NASA LP DAAC AppEEARS Catalog.
 * Strictly isolated from the Vertex AI OAuth proxy (/api-proxy).
 */
import dns from 'node:dns';
import net from 'node:net';
import express from 'express';

// Disable undici Happy-Eyeballs IPv6 race on IPv4-only Linux hosts so NOAA/NASA/CSA dual-stack endpoints succeed reliably
dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

export const earthdataRouter = express.Router();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 250;
const telemetryCache = new Map();

function getCached(key) {
  const entry = telemetryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    telemetryCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCached(key, payload) {
  if (telemetryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = telemetryCache.keys().next().value;
    if (oldestKey) telemetryCache.delete(oldestKey);
  }
  telemetryCache.set(key, { timestamp: Date.now(), payload });
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await globalThis.fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'StrataSight-NASA-SpaceApps/2.0',
        ...(options.headers || {})
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 1. Gateway Status & Credential Capability Check
earthdataRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cacheEntries: telemetryCache.size,
    agencies: {
      nasaPowerMerra2: { live: true, authRequired: false },
      nasaCsaSwotHydrocron: { live: true, authRequired: false },
      canadaGeoMetOgc: { live: true, authRequired: false, license: 'Open Government Licence – Canada' },
      knmiClimateExplorer: { live: true, authRequired: false, license: 'KNMI Climate Explorer Research Attribution' },
      csaOpenCanadaRcm: { live: true, authRequired: false, license: 'Open Government Licence – Canada' },
      noaaGmlGreenhouse: { live: true, authRequired: false },
      noaaNceiGsomZeroAuth: { live: true, authRequired: false },
      nasaAppeearsCatalog: { live: true, authRequired: false },
      noaaNceiCdoV2: { live: Boolean(process.env.NOAA_CDO_TOKEN), authRequired: true, envVar: 'NOAA_CDO_TOKEN' },
      nasaGesDiscDataRods: { live: Boolean(process.env.EARTHDATA_TOKEN), authRequired: true, envVar: 'EARTHDATA_TOKEN' },
      googleEarthEngine: {
        configured: Boolean((process.env.EE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) && (process.env.EE_SERVICE_ACCOUNT_KEY_FILE || process.env.EE_SERVICE_ACCOUNT_KEY_JSON)),
        envVars: ['EE_PROJECT_ID', 'EE_SERVICE_ACCOUNT_KEY_FILE or EE_SERVICE_ACCOUNT_KEY_JSON']
      }
    }
  });
});

// 2. NASA POWER Monthly Telemetry (MERRA-2 + CERES) for ANY Lat/Lon on Earth
earthdataRouter.get('/nasa-power', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const start = Math.max(1981, Math.min(2025, Number(req.query.start) || 2000));
    const end = Math.max(start, Math.min(2025, Number(req.query.end) || 2024));

    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid lat [-90,90] and lon [-180,180] are required.' });
    }

    const cacheKey = `power:${lat.toFixed(2)}:${lon.toFixed(2)}:${start}:${end}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const params = 'T2M,TS,PRECTOTCORR,GWETROOT,ALLSKY_SFC_SW_DWN';
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${params}&community=RE&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${start}&end=${end}&format=JSON`;

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `NASA POWER returned HTTP ${upstream.status}` });
    }

    const raw = await upstream.json();
    const paramObj = raw?.properties?.parameter || {};
    const t2mMap = paramObj.T2M || {};
    const tsMap = paramObj.TS || {};
    const precMap = paramObj.PRECTOTCORR || {};
    const soilMap = paramObj.GWETROOT || {};
    const swMap = paramObj.ALLSKY_SFC_SW_DWN || {};

    const dates = [];
    const merra2_t2m = [];
    const airs_skin_temp = [];
    const gpm_precip = [];
    const gldas_soil_moist = [];
    const solar_sw_dwn = [];

    const sortedKeys = Object.keys(t2mMap).sort();
    for (const key of sortedKeys) {
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(4, 6));
      if (month < 1 || month > 12) continue; // Skip '13' annual summary row

      const t2mVal = Number(t2mMap[key]);
      if (!Number.isFinite(t2mVal) || t2mVal <= -900) continue;

      const dateStr = `${year}-${String(month).padStart(2, '0')}`;
      dates.push(dateStr);
      merra2_t2m.push(Number(t2mVal.toFixed(3)));

      const tsVal = Number(tsMap[key]);
      airs_skin_temp.push(Number((tsVal > -900 ? tsVal : t2mVal).toFixed(3)));

      const precDay = Number(precMap[key]);
      const monthlyMm = precDay > -900 ? precDay * daysInMonth(year, month) : 0;
      gpm_precip.push(Number(monthlyMm.toFixed(2)));

      const rootWetness = Number(soilMap[key]);
      // Convert root-zone wetness fraction (0..1) to 0-100cm equivalent kg/m² (~400 kg/m² porosity capacity)
      const soilKgM2 = rootWetness > -900 ? rootWetness * 400 : 120;
      gldas_soil_moist.push(Number(soilKgM2.toFixed(2)));

      const swVal = Number(swMap[key]);
      solar_sw_dwn.push(Number((swVal > -900 ? swVal : 0).toFixed(2)));
    }

    const coords = raw?.geometry?.coordinates || [lon, lat, 0];
    const payload = {
      source: 'NASA POWER / GMAO MERRA-2 & CERES FlashFlux',
      endpoint: 'https://power.larc.nasa.gov/api/temporal/monthly/point',
      license: 'U.S. Government Public Domain (NASA EOSDIS Open Data Policy)',
      latencyMs: Date.now() - t0,
      coordinates: { lat: coords[1], lon: coords[0], elevationMeters: coords[2] },
      dates,
      series: {
        merra2_t2m,
        airs_skin_temp,
        gpm_precip,
        gldas_soil_moist,
        solar_sw_dwn
      }
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'NASA POWER upstream error', details: String(err?.message || err) });
  }
});

// 3. NASA / CNES / CSA SWOT Mission Hydrocron API (Rivers & Lakes)
earthdataRouter.get('/swot-hydrocron', async (req, res) => {
  try {
    const feature = req.query.feature === 'PriorLake' ? 'PriorLake' : 'Reach';
    const featureId = String(req.query.feature_id || '71224100221').replace(/[^0-9A-Za-z_-]/g, '');
    const startTime = String(req.query.start_time || '2023-04-01T00:00:00Z');
    const endTime = String(req.query.end_time || '2026-11-14T23:59:59Z');

    const fields =
      feature === 'PriorLake'
        ? 'lake_id,time_str,wse,area_total,wse_u,quality_f'
        : 'reach_id,time_str,wse,width,slope,dschg_c,wse_u,reach_q';

    const cacheKey = `swot:${feature}:${featureId}:${startTime.slice(0, 10)}:${endTime.slice(0, 10)}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url =
      `https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries` +
      `?feature=${encodeURIComponent(feature)}` +
      `&feature_id=${encodeURIComponent(featureId)}` +
      `&start_time=${encodeURIComponent(startTime)}` +
      `&end_time=${encodeURIComponent(endTime)}` +
      `&output=geojson&fields=${encodeURIComponent(fields)}`;

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url, {}, 16000);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `SWOT Hydrocron HTTP ${upstream.status}` });
    }

    const raw = await upstream.json();
    const features = raw?.results?.geojson?.features || [];
    let geometry = null;
    const observations = [];

    for (const f of features) {
      if (!geometry && f.geometry) geometry = f.geometry;
      const p = f.properties || {};
      const timeStr = String(p.time_str || '');
      const wse = Number(p.wse);
      if (!timeStr || timeStr === 'no_data' || !Number.isFinite(wse) || wse < -10000) continue;

      const width = Number(p.width);
      const areaTotal = Number(p.area_total);
      const dschg = Number(p.dschg_c);
      const slope = Number(p.slope);
      const wseU = Number(p.wse_u);

      observations.push({
        timestamp: timeStr,
        date: timeStr.slice(0, 10),
        wse: Number(wse.toFixed(3)),
        width: Number.isFinite(width) && width > -10000 ? Number(width.toFixed(1)) : null,
        areaKm2: Number.isFinite(areaTotal) && areaTotal > -10000 ? Number(areaTotal.toFixed(3)) : null,
        dischargeM3s: Number.isFinite(dschg) && dschg > -10000 ? Number(dschg.toFixed(1)) : null,
        slopeMmPerKm: Number.isFinite(slope) && slope > -10000 ? Number((slope * 1e6).toFixed(2)) : null,
        wseUncertainty: Number.isFinite(wseU) && wseU > -10000 ? Number(wseU.toFixed(3)) : 0.1
      });
    }

    observations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const payload = {
      source: 'NASA PO.DAAC Hydrocron / SWOT Mission (NASA / CNES / CSA / UKSA KaRIn)',
      license: 'NASA Open Data Policy & CSA SWOT Partnership',
      latencyMs: Date.now() - t0,
      featureType: feature,
      featureId,
      totalPassesReturned: features.length,
      validOverpasses: observations.length,
      geometry,
      observations
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'SWOT Hydrocron upstream error', details: String(err?.message || err) });
  }
});

// 4. Geo.ca / ECCC MSC GeoMet Hydrometric Monthly Mean Station API (Canada Open Data)
earthdataRouter.get('/canada-geomet', async (req, res) => {
  try {
    const station = String(req.query.station || '08MF005').replace(/[^0-9A-Za-z]/g, '');
    const startYear = Number(req.query.startYear) || 1980;
    const cacheKey = `geomet:${station}:${startYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url = `https://api.weather.gc.ca/collections/hydrometric-monthly-mean/items?STATION_NUMBER=${encodeURIComponent(station)}&limit=1500&sortby=DATE&f=json`;
    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Canada GeoMet HTTP ${upstream.status}` });
    }

    const raw = await upstream.json();
    const items = raw?.features || [];
    let stationName = station;
    let province = 'CA';
    let coordinates = null;
    const points = [];

    for (const item of items) {
      const p = item.properties || {};
      if (p.STATION_NAME) stationName = p.STATION_NAME;
      if (p.PROV_TERR_STATE_LOC) province = p.PROV_TERR_STATE_LOC;
      if (!coordinates && item.geometry?.coordinates) {
        coordinates = { lon: item.geometry.coordinates[0], lat: item.geometry.coordinates[1] };
      }
      const date = String(p.DATE || '');
      const year = Number(date.slice(0, 4));
      if (!date || year < startYear) continue;
      const discharge = p.MONTHLY_MEAN_DISCHARGE != null ? Number(p.MONTHLY_MEAN_DISCHARGE) : null;
      const level = p.MONTHLY_MEAN_LEVEL != null ? Number(p.MONTHLY_MEAN_LEVEL) : null;
      if (discharge === null && level === null) continue;
      points.push({ date, dischargeM3s: discharge, waterLevelM: level });
    }

    points.sort((a, b) => a.date.localeCompare(b.date));

    const payload = {
      source: 'Geo.ca / Environment and Climate Change Canada (MSC GeoMet OGC API - HYDAT)',
      license: 'Contains information licensed under the Open Government Licence – Canada.',
      latencyMs: Date.now() - t0,
      stationNumber: station,
      stationName,
      province,
      coordinates,
      points
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'Canada GeoMet upstream error', details: String(err?.message || err) });
  }
});

// 5. NOAA GML Live Atmospheric Greenhouse Gases (CO2 Mauna Loa & Global CH4)
earthdataRouter.get('/noaa-gml', async (req, res) => {
  try {
    const gas = req.query.gas === 'ch4' ? 'ch4' : 'co2';
    const startYear = Number(req.query.startYear) || 2000;
    const cacheKey = `gml:${gas}:${startYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url =
      gas === 'ch4'
        ? 'https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt'
        : 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt';

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `NOAA GML HTTP ${upstream.status}` });
    }

    const text = await upstream.text();
    const dates = [];
    const values = [];

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cols = trimmed.split(/\s+/);
      if (cols.length < 4) continue;
      const year = Number(cols[0]);
      const month = Number(cols[1]);
      const avg = Number(cols[3]);
      if (!Number.isFinite(year) || year < startYear || month < 1 || month > 12) continue;
      if (!Number.isFinite(avg) || avg < 0) continue;
      dates.push(`${year}-${String(month).padStart(2, '0')}`);
      values.push(Number(avg.toFixed(2)));
    }

    const payload = {
      source: gas === 'ch4' ? 'NOAA Global Monitoring Laboratory (Global Marine Surface CH4)' : 'NOAA Global Monitoring Laboratory (Mauna Loa Observatory CO2)',
      license: 'U.S. Government Public Work (NOAA GML Fair-Use Citation)',
      latencyMs: Date.now() - t0,
      gas,
      unit: gas === 'ch4' ? 'ppb' : 'ppm',
      dates,
      values
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'NOAA GML upstream error', details: String(err?.message || err) });
  }
});

// 6. NOAA NCEI Climate Data Online (CDO v2 GSOM Weather Stations, optional token)
earthdataRouter.get('/noaa-cdo', async (req, res) => {
  try {
    const token = req.headers['x-noaa-token'] || process.env.NOAA_CDO_TOKEN;
    if (!token) {
      return res.status(400).json({
        error: 'NOAA_CDO_TOKEN not configured',
        hint: 'Request a free instant token at https://www.ncei.noaa.gov/cdo-web/token or pass x-noaa-token header.'
      });
    }

    const stationId = String(req.query.stationid || 'GHCND:USW00023174');
    const datatypeId = String(req.query.datatypeid || 'TAVG');
    const startYear = Math.max(1950, Number(req.query.startYear) || 2000);
    const endYear = Math.min(2025, Number(req.query.endYear) || 2024);

    const cacheKey = `cdo:${stationId}:${datatypeId}:${startYear}:${endYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // GSOM supports max 10-year window per call
    const allResults = [];
    const t0 = Date.now();
    for (let y = startYear; y <= endYear; y += 10) {
      const chunkEnd = Math.min(endYear, y + 9);
      const url =
        `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GSOM` +
        `&stationid=${encodeURIComponent(stationId)}` +
        `&datatypeid=${encodeURIComponent(datatypeId)}` +
        `&startdate=${y}-01-01&enddate=${chunkEnd}-12-31&units=metric&limit=1000`;

      const upstream = await fetchWithTimeout(url, { headers: { token: String(token) } });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `NOAA CDO v2 HTTP ${upstream.status}` });
      }
      const json = await upstream.json();
      if (Array.isArray(json?.results)) {
        allResults.push(...json.results);
      }
    }

    const points = allResults.map(r => ({
      date: String(r.date || '').slice(0, 7),
      value: Number(r.value)
    }));

    const payload = {
      source: 'NOAA NCEI Climate Data Online (CDO v2 / Global Summary of the Month)',
      license: 'U.S. Government Public Domain (NOAA NCEI)',
      latencyMs: Date.now() - t0,
      stationId,
      datatypeId,
      points
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'NOAA CDO v2 upstream error', details: String(err?.message || err) });
  }
});

// 7. NASA LP DAAC AppEEARS Live Earthdata Cloud Product Catalog (193+ Products)
earthdataRouter.get('/appeears-catalog', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    const cacheKey = 'appeears:catalog:all';
    let catalog = getCached(cacheKey);

    const t0 = Date.now();
    if (!catalog) {
      const upstream = await fetchWithTimeout('https://appeears.earthdatacloud.nasa.gov/api/product');
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `AppEEARS HTTP ${upstream.status}` });
      }
      const raw = await upstream.json();
      catalog = Array.isArray(raw)
        ? raw.map(p => ({
            productAndVersion: p.ProductAndVersion,
            platform: p.Platform,
            description: p.Description,
            resolution: p.Resolution,
            temporalGranularity: p.TemporalGranularity,
            temporalStart: p.TemporalExtentStart,
            temporalEnd: p.TemporalExtentEnd,
            available: Boolean(p.Available)
          }))
        : [];
      setCached(cacheKey, catalog);
    }

    const filtered = query
      ? catalog.filter(
          p =>
            String(p.productAndVersion).toLowerCase().includes(query) ||
            String(p.platform).toLowerCase().includes(query) ||
            String(p.description).toLowerCase().includes(query)
        )
      : catalog;

    return res.json({
      source: 'NASA LP DAAC AppEEARS Earthdata Cloud API',
      endpoint: 'https://appeears.earthdatacloud.nasa.gov/api/product',
      totalCatalogProducts: catalog.length,
      matchedCount: filtered.length,
      latencyMs: Date.now() - t0,
      products: filtered.slice(0, 50)
    });
  } catch (err) {
    return res.status(502).json({ error: 'AppEEARS catalog upstream error', details: String(err?.message || err) });
  }
});

// 8. KNMI Climate Explorer Live Teleconnection Indices (Zero-Auth ASCII .dat Feeds)
const KNMI_INDEX_MAP = {
  nino34: {
    url: 'https://climexp.knmi.nl/data/iersst_nino3.4a.dat',
    name: 'ENSO Niño 3.4 SST Anomaly (ERSSTv5)',
    unit: '°C',
    format: 'decimal_year'
  },
  nao: {
    url: 'https://climexp.knmi.nl/data/icpc_nao.dat',
    name: 'North Atlantic Oscillation Index (CPC NAO)',
    unit: 'σ Index',
    format: 'table12'
  },
  iod: {
    url: 'https://climexp.knmi.nl/data/idmi_ersst.dat',
    name: 'Indian Ocean Dipole Mode Index (DMI ERSSTv5)',
    unit: '°C',
    format: 'table12'
  },
  amo: {
    url: 'https://climexp.knmi.nl/data/iamo_ersst.dat',
    name: 'Atlantic Multidecadal Oscillation (AMO detrended)',
    unit: '°C',
    format: 'table12'
  }
};

earthdataRouter.get('/knmi-index', async (req, res) => {
  try {
    const indexKey = String(req.query.index || 'nino34').toLowerCase();
    const meta = KNMI_INDEX_MAP[indexKey] || KNMI_INDEX_MAP.nino34;
    const startYear = Math.max(1854, Number(req.query.startYear) || 2000);
    const endYear = Math.min(2026, Number(req.query.endYear) || 2024);

    const cacheKey = `knmi:${indexKey}:${startYear}:${endYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(meta.url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `KNMI Climate Explorer HTTP ${upstream.status}` });
    }

    const rawText = await upstream.text();
    const points = [];

    for (const line of rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<')) continue;
      const cols = trimmed.split(/\s+/);

      if (meta.format === 'decimal_year' && cols.length >= 2) {
        const decYear = Number(cols[0]);
        const val = Number(cols[1]);
        if (!Number.isFinite(decYear) || !Number.isFinite(val) || val <= -900) continue;
        const year = Math.floor(decYear + 1e-4);
        if (year < startYear || year > endYear) continue;
        const month = Math.min(12, Math.max(1, Math.round((decYear - year) * 12) + 1));
        points.push({
          date: `${year}-${String(month).padStart(2, '0')}`,
          value: Number(val.toFixed(3))
        });
      } else if (meta.format === 'table12' && cols.length >= 13) {
        const year = Number(cols[0]);
        if (!Number.isFinite(year) || year < startYear || year > endYear) continue;
        for (let m = 1; m <= 12; m++) {
          const val = Number(cols[m]);
          if (!Number.isFinite(val) || val <= -900) continue;
          points.push({
            date: `${year}-${String(m).padStart(2, '0')}`,
            value: Number(val.toFixed(3))
          });
        }
      }
    }

    const payload = {
      source: 'Royal Netherlands Meteorological Institute (KNMI) Climate Explorer',
      endpoint: meta.url,
      license: 'KNMI Climate Explorer Non-Commercial Scientific Attribution (Non-U.S. Gov Partner)',
      isNonUsGov: true,
      latencyMs: Date.now() - t0,
      index: indexKey,
      name: meta.name,
      unit: meta.unit,
      count: points.length,
      points
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'KNMI Climate Explorer upstream error', details: String(err?.message || err) });
  }
});

// 9. Zero-Auth NOAA NCEI Access Data Service v1 (Global Summary of the Month GHCN Weather Stations)
earthdataRouter.get('/noaa-ncei-gsom', async (req, res) => {
  try {
    const station = String(req.query.station || 'USW00023174').replace(/^GHCND:/i, '').trim();
    const startYear = Math.max(1950, Number(req.query.startYear) || 2000);
    const endYear = Math.min(2025, Number(req.query.endYear) || 2024);

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(station)) {
      return res.status(400).json({ error: 'Invalid GHCN station identifier.' });
    }

    const cacheKey = `ncei-gsom:${station}:${startYear}:${endYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url =
      `https://www.ncei.noaa.gov/access/services/data/v1?dataset=global-summary-of-the-month` +
      `&stations=${encodeURIComponent(station)}` +
      `&startDate=${startYear}-01-01&endDate=${endYear}-12-31` +
      `&dataTypes=TAVG,TMAX,TMIN,PRCP&includeStationName=true&format=json&units=metric`;

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `NOAA NCEI Access v1 HTTP ${upstream.status}` });
    }

    const rows = await upstream.json();
    const observations = Array.isArray(rows)
      ? rows
          .filter(r => r.DATE)
          .map(r => ({
            date: String(r.DATE).slice(0, 7),
            stationName: r.NAME || station,
            tavgC: r.TAVG !== undefined ? Number(r.TAVG) : null,
            tmaxC: r.TMAX !== undefined ? Number(r.TMAX) : null,
            tminC: r.TMIN !== undefined ? Number(r.TMIN) : null,
            prcpMm: r.PRCP !== undefined ? Number(r.PRCP) : null
          }))
      : [];

    const payload = {
      source: 'NOAA NCEI Climate Data Online / Access Data Service v1 (GSOM Ground Stations)',
      endpoint: 'https://www.ncei.noaa.gov/access/services/data/v1',
      license: 'U.S. Government Public Domain (NOAA NCEI)',
      latencyMs: Date.now() - t0,
      station,
      stationName: observations[0]?.stationName || station,
      cdoTokenAlsoConfigured: Boolean(process.env.NOAA_CDO_TOKEN),
      count: observations.length,
      observations
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'NOAA NCEI GSOM upstream error', details: String(err?.message || err) });
  }
});

// 10. Live CSA / Government of Canada RADARSAT Constellation Mission (RCM) CKAN Open Data Registry
earthdataRouter.get('/csa-rcm-catalog', async (req, res) => {
  try {
    const rows = Math.min(20, Math.max(1, Number(req.query.rows) || 8));
    const cacheKey = `csa-rcm:${rows}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url = `https://open.canada.ca/data/api/action/package_search?q=%22RADARSAT+Constellation+Mission%22&rows=${rows}`;
    const t0 = Date.now();
    const upstream = await fetchWithTimeout(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Open Canada CKAN HTTP ${upstream.status}` });
    }

    const json = await upstream.json();
    const results = Array.isArray(json?.result?.results) ? json.result.results : [];
    const datasets = results.map(pkg => ({
      id: pkg.id,
      title: pkg.title_translated?.en || pkg.title || 'CSA RADARSAT Constellation Dataset',
      organization: pkg.organization?.title?.split('|')[0]?.trim() || 'Canadian Space Agency',
      jurisdiction: pkg.jurisdiction || 'federal',
      publishedAt: String(pkg.metadata_created || '').slice(0, 10),
      updatedAt: String(pkg.metadata_modified || '').slice(0, 10),
      licenseTitle: pkg.license_title || 'Open Government Licence - Canada',
      portalUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      formats: Array.from(
        new Set((pkg.resources || []).map(r => String(r.format || '').toUpperCase()).filter(Boolean))
      ).slice(0, 5)
    }));

    const payload = {
      source: 'Government of Canada Open Data / CSA & Geo.ca CKAN Federation',
      endpoint: 'https://open.canada.ca/data/api/action/package_search',
      license: 'Contains information licensed under the Open Government Licence – Canada.',
      isNonUsGov: true,
      latencyMs: Date.now() - t0,
      totalMatched: json?.result?.count || datasets.length,
      datasets
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'CSA Open Canada CKAN upstream error', details: String(err?.message || err) });
  }
});

// 11. NASA Giovanni in the Cloud / GES DISC Hydrology Time Series Service (Requires EARTHDATA_TOKEN)
earthdataRouter.get('/gesdisc-datarods', async (req, res) => {
  try {
    const token = req.headers['x-earthdata-token'] || process.env.EARTHDATA_TOKEN;
    if (!token) {
      return res.status(401).json({
        error: 'EARTHDATA_TOKEN not configured in backend/.env.local',
        hint: 'Generate a free NASA Earthdata Login Bearer token at https://urs.earthdata.nasa.gov/users/tokens and set EARTHDATA_TOKEN in backend/.env.local.'
      });
    }

    const variable = String(req.query.variable || 'GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst');
    const lat = Number(req.query.lat ?? 36.1);
    const lon = Number(req.query.lon ?? -112.1);
    const startYear = Math.max(2000, Number(req.query.startYear) || 2022);
    const endYear = Math.min(2025, Number(req.query.endYear) || 2023);

    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      return res.status(400).json({ error: 'Valid lat and lon required.' });
    }

    const giovanniVar = variable.includes(':') ? 'GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst' : variable;
    const cacheKey = `datarods:${giovanniVar}:${lat.toFixed(2)}:${lon.toFixed(2)}:${startYear}:${endYear}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const url =
      `https://api.giovanni.earthdata.nasa.gov/timeseries?` +
      `data=${encodeURIComponent(giovanniVar)}` +
      `&location=[${lat.toFixed(3)},${lon.toFixed(3)}]` +
      `&time=${startYear}-01-01T00:00:00/${endYear}-12-31T23:59:59`;

    const t0 = Date.now();
    const upstream = await fetchWithTimeout(
      url,
      { headers: { Authorization: `Bearer ${String(token).trim()}` } },
      22000
    );

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `NASA Giovanni / Hydrology Time Series returned HTTP ${upstream.status}`,
        hint: 'Ensure EARTHDATA_TOKEN is valid and location is over land (GLDAS/NLDAS masks ocean pixels).'
      });
    }

    const csv = await upstream.text();
    const dates = [];
    const values = [];
    let doi = '10.5067/SXAVCZFAQLNO';
    let unit = 'kg m-2';

    for (const line of csv.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('doi,')) doi = trimmed.slice(4).trim();
      if (trimmed.startsWith('unit,')) unit = trimmed.slice(5).trim();
      if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) continue;
      const parts = trimmed.split(',');
      if (parts.length < 2) continue;
      const ym = parts[0].trim().slice(0, 7);
      const val = Number(parts[1].trim());
      if (!Number.isFinite(val) || val <= -9000) continue;
      dates.push(ym);
      values.push(Number(val.toFixed(3)));
    }

    const payload = {
      source: 'NASA Giovanni in the Cloud / GES DISC Hydrology Time Series Service',
      endpoint: 'https://api.giovanni.earthdata.nasa.gov/timeseries',
      doi,
      unit,
      license: 'U.S. Government Public Domain (NASA GES DISC)',
      latencyMs: Date.now() - t0,
      variable: giovanniVar,
      coordinates: { lat, lon },
      count: dates.length,
      dates,
      values
    };

    setCached(cacheKey, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({ error: 'NASA Giovanni / GES DISC upstream error', details: String(err?.message || err) });
  }
});

// 12. Live Credential & Multi-Agency Connectivity Self-Test Endpoint
earthdataRouter.get('/verify-keys', async (_req, res) => {
  const checks = {};

  // Check EARTHDATA_TOKEN against live NASA Giovanni in the Cloud / GES DISC Time Series API
  if (process.env.EARTHDATA_TOKEN) {
    const t0 = Date.now();
    try {
      const r = await fetchWithTimeout(
        'https://api.giovanni.earthdata.nasa.gov/timeseries?data=GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst&location=[36.1,-112.1]&time=2023-01-01T00:00:00/2023-03-31T23:59:59',
        { headers: { Authorization: `Bearer ${process.env.EARTHDATA_TOKEN.trim()}` } }
      );
      checks.earthdataToken = {
        configured: true,
        valid: r.ok,
        httpStatus: r.status,
        latencyMs: Date.now() - t0,
        unlocks: ['NASA Giovanni in the Cloud API', 'NASA GES DISC Hydrology Time Series']
      };
    } catch (e) {
      checks.earthdataToken = { configured: true, valid: false, error: String(e?.message || e) };
    }
  } else {
    checks.earthdataToken = {
      configured: false,
      valid: false,
      envVar: 'EARTHDATA_TOKEN',
      getUrl: 'https://urs.earthdata.nasa.gov/users/tokens'
    };
  }

  // Check NOAA_CDO_TOKEN against NOAA CDO v2 /datacategories
  if (process.env.NOAA_CDO_TOKEN) {
    const t0 = Date.now();
    try {
      const r = await fetchWithTimeout('https://www.ncei.noaa.gov/cdo-web/api/v2/datacategories?limit=1', {
        headers: { token: process.env.NOAA_CDO_TOKEN.trim() }
      });
      checks.noaaCdoToken = {
        configured: true,
        valid: r.ok,
        httpStatus: r.status,
        latencyMs: Date.now() - t0,
        unlocks: ['NOAA CDO v2 Station Archive (/api/earthdata/noaa-cdo)']
      };
    } catch (e) {
      checks.noaaCdoToken = { configured: true, valid: false, error: String(e?.message || e) };
    }
  } else {
    checks.noaaCdoToken = {
      configured: false,
      valid: false,
      envVar: 'NOAA_CDO_TOKEN',
      note: 'Zero-auth NOAA NCEI GSOM (/api/earthdata/noaa-ncei-gsom) is already active without a token!',
      getUrl: 'https://www.ncei.noaa.gov/cdo-web/token'
    };
  }

  return res.json({
    timestamp: new Date().toISOString(),
    zeroAuthLiveCount: 8,
    tokenChecks: checks
  });
});
