/**
 * Land-sampling grid shared by the trend map (browser) and the cache-warming script (Node).
 * Natural Earth 1:110m land polygons via the `world-atlas` package.
 */
import { feature } from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';

export const LAND_GRID_STEP = 15; // degrees

export type Ring = number[][];
export type LandPolygon = Ring[]; // [outer, ...holes]

export function loadLand(): LandPolygon[] {
  const fc: any = feature(landTopology as any, (landTopology as any).objects.land);
  const geoms: any[] = fc.type === 'FeatureCollection' ? fc.features.map((f: any) => f.geometry) : [fc.geometry ?? fc];
  const polys: LandPolygon[] = [];
  for (const g of geoms) {
    if (!g) continue;
    if (g.type === 'Polygon') polys.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polys.push(...g.coordinates);
  }
  // Some rings (Eurasia/Chukotka, Antarctica) cross the antimeridian: make longitudes continuous
  // so they draw and test correctly (copies shifted by ±360° cover the wrapped part).
  return polys.map(poly =>
    poly.map(ring => {
      const out: Ring = [];
      let prev = ring[0][0];
      for (const [lon, lat] of ring) {
        let l = lon;
        while (l - prev > 180) l -= 360;
        while (l - prev < -180) l += 360;
        out.push([l, lat]);
        prev = l;
      }
      return out;
    })
  );
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function onLand(lon: number, lat: number, polys: LandPolygon[]): boolean {
  for (const poly of polys) {
    for (const shift of [0, 360, -360]) {
      const lo = lon + shift;
      if (inRing(lo, lat, poly[0]) && !poly.slice(1).some(h => inRing(lo, lat, h))) return true;
    }
  }
  return false;
}


export interface LandCell {
  id: string;
  lat: number;
  lon: number;
}

/** Cell centres (excluding Antarctica) whose centre lies on land. */
export function landCells(polys: LandPolygon[] = loadLand()): LandCell[] {
  const out: LandCell[] = [];
  for (let lat = -52.5; lat <= 67.5; lat += LAND_GRID_STEP) {
    for (let lon = -172.5; lon <= 172.5; lon += LAND_GRID_STEP) {
      if (onLand(lon, lat, polys)) out.push({ id: `${lat}_${lon}`, lat, lon });
    }
  }
  return out;
}
