/**
 * Pre-fetches the REAL series the demo and the trend map need, so judges never wait on a cold cache.
 *
 *   npm run warm                         fill the local cache (data-cache/)
 *   npm run seed                         refresh the committed read-only seed (backend/seed-cache/)
 *   npm run warm -- --map=all            also scan the trend-map grid for every NASA POWER variable
 *   npm run warm -- --map=t2m,aod550     choose map variables (default: t2m,aod550; 'none' to skip)
 *
 * Nothing here is simulated: every entry is a real agency response, stored with its original fetch time
 * and provenance. If an agency is unreachable at demo time the backend serves these entries flagged
 * CACHED_REAL, never as live.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const seed = args.includes('--seed');
const mapArg = args.find(a => a.startsWith('--map='))?.slice(6) ?? 't2m,aod550';

if (seed) {
  process.env.STRATASIGHT_CACHE_DIR = path.join(root, 'backend', 'seed-cache');
  process.env.EARTHPULSE_CACHE_DIR = process.env.STRATASIGHT_CACHE_DIR;
}

const { getSeries } = await import('../backend/seriesService.js');
const { NASA_VARIABLES, PLANETARY_HOTSPOTS, DEMO_CASE_STUDIES } = await import('../frontend/services/earthScienceData.ts');
const { GUIDED_QUESTIONS } = await import('../frontend/services/guidedQuestions.ts');
const { landCells } = await import('../frontend/services/landGrid.ts');

type Job = { variableId: string; lat: number; lon: number };
const jobs = new Map<string, Job>();
const add = (variableId: string | undefined, regionId: string | undefined) => {
  const r = PLANETARY_HOTSPOTS.find((x: any) => x.id === regionId);
  if (!variableId || !r) return;
  const j = { variableId, lat: r.coordinates.lat, lon: r.coordinates.lon };
  jobs.set(`${j.variableId}|${j.lat}|${j.lon}`, j);
};

// 1. Verified stories (primary + secondary variable at both regions)
for (const cs of DEMO_CASE_STUDIES as any[]) {
  for (const v of [cs.variableId, cs.secondaryVariableId]) {
    add(v, cs.primaryRegionId);
    add(v, cs.secondaryRegionId);
  }
}
// 2. Start-page questions at their suggested places
for (const q of GUIDED_QUESTIONS as any[]) {
  add(q.variableId, q.suggestedRegionIds[0]);
  for (const id of q.suggestedRegionIds) add(q.variableId, id);
}
// 3. Worldwide records and the default Analyze view
for (const v of ['co2_mlo', 'ch4_global']) add(v, PLANETARY_HOTSPOTS[0].id);
add('t2m', PLANETARY_HOTSPOTS[0].id);

// 4. Trend-map grids
const powerIds = (NASA_VARIABLES as any[]).filter(v => v.provider === 'power' && v.scope !== 'global').map(v => v.id);
const mapIds = mapArg === 'all' ? powerIds : mapArg === 'none' ? [] : mapArg.split(',').filter(Boolean);
for (const id of mapIds) {
  for (const c of landCells()) {
    const j = { variableId: id, lat: c.lat, lon: c.lon };
    jobs.set(`${j.variableId}|${j.lat}|${j.lon}`, j);
  }
}

const list = [...jobs.values()];
console.log(`Warming ${list.length} real series ${seed ? '(writing committed seed)' : ''}…`);
let done = 0;
let failed = 0;
const failures: string[] = [];

async function worker() {
  while (list.length) {
    const j = list.shift()!;
    try {
      await getSeries(j.variableId, j.lat, j.lon, undefined as any, undefined as any);
    } catch (e: any) {
      failed++;
      failures.push(`${j.variableId} @ ${j.lat},${j.lon}: ${e.message}`);
    }
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${done + list.length} (${failed} failed)`);
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`Done: ${done - failed} cached, ${failed} failed.`);
failures.slice(0, 15).forEach(f => console.log('  ✗', f));
process.exit(0);
