/**
 * NASA GIBS (Global Imagery Browse Services) layers offered by "See it from space".
 * Only layers that are verified to exist are listed; date ranges are read live from the GIBS capabilities
 * document (with a safe fallback), because mission end dates change (e.g. Suomi NPP true-colour stopped in Nov 2026).
 */

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** group: 'photo' = a picture of the surface; 'science' = a coloured data layer drawn over a base map; 'night' = static composite */
export const IMAGERY_LAYERS = [
  {
    key: 'terra',
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    group: 'photo',
    label: 'Natural colour',
    sensor: 'Terra / MODIS',
    resolution: '250 m',
    ext: 'jpg',
    tms: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    fallbackStart: '2000-02-24',
    description: 'What a camera in orbit would see: land, cloud, smoke and haze. Daily since 2000.'
  },
  {
    key: 'aqua',
    id: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    group: 'photo',
    label: 'Natural colour (afternoon pass)',
    sensor: 'Aqua / MODIS',
    resolution: '250 m',
    ext: 'jpg',
    tms: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    fallbackStart: '2002-07-04',
    description: 'The same view a few hours later in the day. Useful when Terra is cloudy.'
  },
  {
    key: 'noaa20',
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    group: 'photo',
    label: 'Natural colour (VIIRS)',
    sensor: 'NOAA-20 / VIIRS',
    resolution: '250 m',
    ext: 'jpg',
    tms: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    fallbackStart: '2018-01-05',
    description: 'A newer sensor with a slightly different overpass time.'
  },
  {
    key: 'lst',
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    group: 'science',
    label: 'Land surface temperature',
    sensor: 'Terra / MODIS',
    resolution: '1 km',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level7',
    maxZoom: 7,
    fallbackStart: '2000-02-24',
    ramp: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'],
    rampLow: 'cooler',
    rampHigh: 'hotter',
    description: 'How hot the ground itself is in the daytime. Gaps are cloud.'
  },
  {
    key: 'aerosol',
    id: 'MODIS_Terra_Aerosol',
    group: 'science',
    label: 'Air pollution (aerosols)',
    sensor: 'Terra / MODIS',
    resolution: '10 km',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level6',
    maxZoom: 6,
    fallbackStart: '2000-02-24',
    ramp: ['#3b4cc0', '#8db0fe', '#f7f7f7', '#f4987a', '#b40426'],
    rampLow: 'clean air',
    rampHigh: 'thick haze',
    description: 'Particles in the air (smoke, dust, smog) seen from space. Gaps are cloud or bright surfaces.'
  },
  {
    key: 'no2',
    id: 'OMI_Nitrogen_Dioxide_Tropo_Column',
    group: 'science',
    label: 'Nitrogen dioxide (traffic and industry)',
    sensor: 'Aura / OMI',
    resolution: '13 × 24 km',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level6',
    maxZoom: 6,
    fallbackStart: '2004-10-01',
    ramp: ['#fff7bc', '#fec44f', '#fe9929', '#d95f0e', '#993404'],
    rampLow: 'little NO₂',
    rampHigh: 'lots of NO₂',
    description: 'A gas released by vehicles, power plants and industry. Bright patches mark cities.'
  },
  {
    key: 'rain',
    id: 'IMERG_Precipitation_Rate',
    group: 'science',
    label: 'Rainfall rate',
    sensor: 'GPM / IMERG',
    resolution: '10 km',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level6',
    maxZoom: 6,
    fallbackStart: '2000-06-01',
    ramp: ['#c6dbef', '#6baed6', '#2171b5', '#08306b', '#6a1b9a'],
    rampLow: 'light rain',
    rampHigh: 'heavy rain',
    description: 'Estimated rain falling across the world. Transparent means none.'
  },
  {
    key: 'ndvi',
    id: 'MODIS_Terra_NDVI_8Day',
    group: 'science',
    label: 'Vegetation greenness',
    sensor: 'Terra / MODIS',
    resolution: '250 m',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    fallbackStart: '2025-01-01',
    ramp: ['#a6611a', '#dfc27d', '#f5f5f5', '#80cdc1', '#018571'],
    rampLow: 'bare or dry',
    rampHigh: 'lush and green',
    description: 'How green and healthy plants are (rolling 8-day average).'
  },
  {
    key: 'night',
    id: 'VIIRS_Black_Marble',
    group: 'night',
    label: 'Lights at night',
    sensor: 'Suomi NPP / VIIRS',
    resolution: '500 m',
    ext: 'png',
    tms: 'GoogleMapsCompatible_Level8',
    maxZoom: 8,
    fixedTime: '2016-01-01',
    fallbackStart: '2016-01-01',
    description: 'City lights from a 2016 night-time composite: where people live and work.'
  }
];

export const BASE_LAYER = {
  id: 'BlueMarble_ShadedRelief_Bathymetry',
  tms: 'GoogleMapsCompatible_Level8',
  ext: 'jpeg',
  maxZoom: 8,
  template: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`
};

export const LABELS_LAYER = {
  id: 'Reference_Labels_15m',
  tms: 'GoogleMapsCompatible_Level13',
  maxZoom: 13,
  template: `${GIBS}/Reference_Labels_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`
};

export const layerByKey = key => IMAGERY_LAYERS.find(l => l.key === key);

export function tileTemplate(layer) {
  const time = layer.fixedTime ?? '{time}';
  return `${GIBS}/${layer.id}/default/${time}/${layer.tms}/{z}/{y}/{x}.${layer.ext}`;
}

// ---- live date ranges from the GIBS capabilities document ------------------------------------------
const CAPS_URL = `${GIBS}/1.0.0/WMTSCapabilities.xml`;
const CAPS_TTL_MS = 6 * 60 * 60 * 1000;
let capsCache = null; // { at, ranges: Map<id,{start,end}> }
let capsInflight = null;

const isoDay = d => d.toISOString().slice(0, 10);

/** Parse `<Layer>` blocks for the layers we offer. Exported for tests. */
export function parseCapabilities(xml, ids) {
  const ranges = new Map();
  for (const block of xml.split('<Layer>').slice(1)) {
    const m = /<ows:Identifier>([^<]+)<\/ows:Identifier>/.exec(block);
    if (!m || !ids.includes(m[1])) continue;
    const dim = /<Dimension>[\s\S]*?<ows:Identifier>Time<\/ows:Identifier>[\s\S]*?<\/Dimension>/.exec(block);
    if (!dim) continue;
    const values = [...dim[0].matchAll(/<Value>([^<]+)<\/Value>/g)].map(v => v[1]);
    if (!values.length) continue;
    const first = values[0].split('/')[0];
    const last = values[values.length - 1].split('/');
    ranges.set(m[1], { start: first.slice(0, 10), end: (last[1] ?? last[0]).slice(0, 10) });
  }
  return ranges;
}

async function loadRanges() {
  if (capsCache && Date.now() - capsCache.at < CAPS_TTL_MS) return capsCache.ranges;
  if (!capsInflight) {
    capsInflight = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await globalThis.fetch(CAPS_URL, { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ranges = parseCapabilities(await r.text(), IMAGERY_LAYERS.map(l => l.id));
        capsCache = { at: Date.now(), ranges };
        return ranges;
      } catch (e) {
        console.warn('[imagery] could not read GIBS capabilities, using fallback date ranges:', e?.message);
        // Retry sooner than the normal TTL, but do not hammer.
        capsCache = { at: Date.now() - CAPS_TTL_MS + 5 * 60 * 1000, ranges: capsCache?.ranges ?? new Map() };
        return capsCache.ranges;
      } finally {
        clearTimeout(timer);
        capsInflight = null;
      }
    })();
  }
  return capsInflight;
}

/** Layer descriptions with live `start` / `end` dates and a ready-to-use tile URL template. */
export async function getLayerCatalog() {
  const ranges = await loadRanges();
  const yesterday = isoDay(new Date(Date.now() - 24 * 3600 * 1000));
  return IMAGERY_LAYERS.map(l => {
    const r = ranges.get(l.id);
    const fixed = l.fixedTime;
    return {
      key: l.key,
      id: l.id,
      group: l.group,
      label: l.label,
      sensor: l.sensor,
      resolution: l.resolution,
      maxZoom: l.maxZoom,
      description: l.description,
      ramp: l.ramp,
      rampLow: l.rampLow,
      rampHigh: l.rampHigh,
      start: fixed ?? r?.start ?? l.fallbackStart,
      end: fixed ?? r?.end ?? yesterday,
      fixedTime: fixed ?? null,
      tileTemplate: tileTemplate(l),
      live: Boolean(r)
    };
  });
}
