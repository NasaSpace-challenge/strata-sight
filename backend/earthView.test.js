import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTrueColor,
  bearingDeg,
  chooseBest,
  compassPoint,
  dateWindow,
  distanceKm,
  epicUrls,
  normalizeEpicImage,
  isIsoDate,
  mergeRoundRobin,
  normalizeEvent,
  normalizeMediaItem,
  pickVideoUrl,
  snapshotBbox
} from './earthViewLogic.js';
import { parseCapabilities } from './imageryLayers.js';

const solid = (r, g, b, n = 100) => {
  const a = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4);
  return a;
};

test('snapshotBbox is square on the ground at any latitude', () => {
  for (const lat of [0, 31.4, 60, -45]) {
    const [s, w, n, e] = snapshotBbox(lat, 10, 100);
    const heightKm = (n - s) * 111.32;
    const widthKm = (e - w) * 111.32 * Math.cos((lat * Math.PI) / 180);
    assert.ok(Math.abs(heightKm - 100) < 0.5, `height at ${lat}`);
    assert.ok(Math.abs(widthKm - 100) < 0.5, `width at ${lat}`);
  }
});

test('snapshotBbox stays inside the world near the poles and the date line', () => {
  const [s, w, n, e] = snapshotBbox(89, 179.9, 400);
  assert.ok(s >= -90 && n <= 90 && w >= -180 && e <= 180);
});

test('distance and bearing are sane', () => {
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.2) < 1);
  assert.equal(compassPoint(bearingDeg(0, 0, 1, 0)), 'N');
  assert.equal(compassPoint(bearingDeg(0, 0, 0, 1)), 'E');
  assert.equal(compassPoint(bearingDeg(0, 0, -1, -1)), 'SW');
});

const pct = r => ({ noDataPct: r.noDataPct, cloudPct: r.cloudPct });

test('analyzeTrueColor tells cloud, land and no-data apart', () => {
  assert.deepEqual(pct(analyzeTrueColor(solid(240, 240, 240), 10, 10)), { noDataPct: 0, cloudPct: 100 });
  assert.deepEqual(pct(analyzeTrueColor(solid(90, 110, 70), 10, 10)), { noDataPct: 0, cloudPct: 0 });
  assert.deepEqual(pct(analyzeTrueColor(solid(0, 0, 0), 10, 10)), { noDataPct: 100, cloudPct: 100 });
  // half black, half cloud: cloud share is measured on the valid half only
  const mix = new Uint8Array(400);
  mix.set(solid(0, 0, 0, 50), 0);
  mix.set(solid(250, 250, 250, 50), 200);
  assert.deepEqual(pct(analyzeTrueColor(mix, 10, 10)), { noDataPct: 50, cloudPct: 100 });
});

test('smog-grey is not mistaken for cloud', () => {
  assert.equal(analyzeTrueColor(solid(150, 150, 140), 10, 10).cloudPct, 0);
});

test('chooseBest prefers clear days, then the newest, and skips empty frames', () => {
  const c = [
    { date: '2026-11-15', cloudPct: 3, noDataPct: 60 }, // mostly no data: unusable
    { date: '2026-11-14', cloudPct: 10, noDataPct: 0 },
    { date: '2026-11-13', cloudPct: 88, noDataPct: 0 },
    { date: '2026-11-12', cloudPct: 5, noDataPct: 0 }
  ];
  assert.equal(chooseBest(c).date, '2026-11-14'); // 10% is within tolerance of the 5% minimum, and newer
  assert.equal(chooseBest([{ date: 'x', cloudPct: 0, noDataPct: 99 }]), null);
});

test('chooseBest skips dim pictures when equally clear ones exist', () => {
  const c = [
    { date: '2026-11-12', cloudPct: 0, noDataPct: 0, brightness: 58 }, // dim
    { date: '2026-11-11', cloudPct: 0, noDataPct: 0, brightness: 81 },
    { date: '2026-11-10', cloudPct: 0, noDataPct: 0, brightness: 107 }
  ];
  assert.equal(chooseBest(c).date, '2026-11-11');
  assert.equal(analyzeTrueColor(solid(100, 100, 100), 4, 4).brightness, 100);
});

test('dateWindow counts back from the end and respects the layer start', () => {
  assert.deepEqual(dateWindow('2026-03-02', 4, '2000-01-01'), ['2026-03-02', '2026-03-01', '2026-02-28', '2026-02-27']);
  assert.deepEqual(dateWindow('2000-02-25', 5, '2000-02-24'), ['2000-02-25', '2000-02-24']);
});

test('isIsoDate rejects junk', () => {
  assert.ok(isIsoDate('2026-11-15'));
  for (const bad of ['2026-13-01', '15-11-2026', '', 'abc', '2026-11-1']) assert.equal(isIsoDate(bad), false, bad);
});

test('normalizeEvent handles points, polygons and missing geometry', () => {
  const point = normalizeEvent(
    {
      id: 'E1',
      title: 'Wildfire X',
      link: 'l',
      closed: null,
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [{ id: 'IRWIN', url: 'u' }],
      geometry: [
        { date: '2026-11-10T00:00:00Z', type: 'Point', coordinates: [74, 30] },
        { date: '2026-11-12T00:00:00Z', type: 'Point', coordinates: [74.5, 31], magnitudeValue: 500, magnitudeUnit: 'acres' }
      ]
    },
    { lat: 31, lon: 74 }
  );
  assert.equal(point.lat, 31);
  assert.equal(point.lon, 74.5);
  assert.deepEqual(point.magnitude, { value: 500, unit: 'acres' });
  assert.equal(point.status, 'open');
  assert.equal(point.direction, 'E');
  assert.ok(point.distanceKm > 40 && point.distanceKm < 60);

  const poly = normalizeEvent({ id: 'E2', title: 'Ice', categories: [], geometry: [{ date: '2026-01-01', type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] }] });
  assert.deepEqual([poly.lat, poly.lon], [1, 1]);
  assert.equal(normalizeEvent({ id: 'E3', title: 'x', geometry: [] }), null);
});

test('normalizeMediaItem maps fields, upgrades the image size and drops other planets', () => {
  const item = (title, description = '') => ({
    data: [{ nasa_id: 'iss069e009939', title, description, media_type: 'image', center: 'JSC', date_created: '2023-05-10T00:00:00Z', photographer: '' }],
    links: [{ rel: 'preview', href: 'http://images-assets.nasa.gov/image/iss069e009939/iss069e009939~thumb.jpg' }]
  });
  const m = normalizeMediaItem(item('City lights of Lahore', '<b>Night</b> view'), 'Lahore');
  assert.equal(m.thumb.startsWith('https://'), true);
  assert.equal(m.image.endsWith('~medium.jpg'), true);
  assert.equal(m.description, 'Night view');
  assert.equal(m.credit, 'JSC');
  assert.equal(m.page, 'https://images.nasa.gov/details/iss069e009939');
  assert.equal(normalizeMediaItem(item('Indus Vallis', 'A channel on Mars'), 'Indus'), null);
  assert.equal(normalizeMediaItem({ data: [{ nasa_id: 'x', media_type: 'audio' }], links: [] }, 'q'), null);
});

test('pickVideoUrl prefers a web-friendly MP4 over the original', () => {
  const assets = ['http://a/v~orig.mp4', 'http://a/v~medium.mp4', 'http://a/v~small.mp4', 'http://a/v.vtt'];
  assert.equal(pickVideoUrl(assets), 'https://a/v~medium.mp4');
  assert.equal(pickVideoUrl(['http://a/only.mp4']), 'https://a/only.mp4');
  assert.equal(pickVideoUrl(['http://a/x.jpg']), null);
});

test('mergeRoundRobin interleaves, dedupes and limits', () => {
  const a = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const b = [{ id: 2 }, { id: 4 }];
  assert.deepEqual(mergeRoundRobin([a, b], 10).map(x => x.id), [1, 2, 4, 3]);
  assert.equal(mergeRoundRobin([a, b], 2).length, 2);
});

test('epicUrls builds archive links from the image timestamp', () => {
  const u = epicUrls('epic_1b_20261112000830', '2026-11-12 00:08:30');
  assert.equal(u.image, 'https://epic.gsfc.nasa.gov/archive/natural/2026/11/12/jpg/epic_1b_20261112000830.jpg');
  assert.ok(u.thumb.includes('/thumbs/'));
});

test('normalizeEpicImage turns J2000 vectors into distances and picks the collection', () => {
  const raw = {
    image: 'epic_RGB_20261109005515',
    date: '2026-11-09 00:51:44',
    centroid_coordinates: { lat: -9.88, lon: 152.97 },
    dscovr_j2000_position: { x: 1000000, y: 1000000, z: 0 },
    lunar_j2000_position: { x: 384400, y: 0, z: 0 },
    sun_j2000_position: { x: 149597870.7, y: 0, z: 0 }
  };
  const e = normalizeEpicImage(raw, 'enhanced');
  assert.equal(e.spacecraftKm, 1414214);
  assert.equal(e.moonKm, 384400);
  assert.equal(e.sunAu, 1);
  assert.ok(e.imageUrl.includes('/archive/enhanced/2026/11/09/jpg/'));
  assert.ok(e.pngUrl.endsWith('.png'));
  assert.equal(normalizeEpicImage({ image: 'x', date: '2026-11-09 00:00:00' }).lat, null);
});

test('parseCapabilities reads the first and last date of a layer', () => {
  const xml = `<Contents>
    <Layer><ows:Identifier>Other</ows:Identifier><Dimension><ows:Identifier>Time</ows:Identifier><Value>2001-01-01/2002-01-01/P1D</Value></Dimension></Layer>
    <Layer><ows:Identifier>MODIS_Terra_CorrectedReflectance_TrueColor</ows:Identifier>
      <Dimension><ows:Identifier>Time</ows:Identifier><Default>2026-11-15</Default>
        <Value>2000-02-24/2000-04-25/P1D</Value><Value>2025-11-10/2026-11-15/P1D</Value></Dimension></Layer>
  </Contents>`;
  const r = parseCapabilities(xml, ['MODIS_Terra_CorrectedReflectance_TrueColor']);
  assert.deepEqual(r.get('MODIS_Terra_CorrectedReflectance_TrueColor'), { start: '2000-02-24', end: '2026-11-15' });
  assert.equal(r.has('Other'), false);
});
