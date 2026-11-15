import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EarthVariable } from '../types';
import { fetchRealSeries } from '../services/liveEarthDataService';
import { applyBenjaminiHochbergFDR, processMonthlyTimeSeries } from '../services/statisticsEngine';
import { formatCoords } from '../services/earthScienceData';
import { LandPolygon, LAND_GRID_STEP, Ring, landCells, loadLand } from '../services/landGrid';
import { Loader2, MousePointerClick, Satellite } from 'lucide-react';

const STEP = LAND_GRID_STEP; // degrees; one real series is fetched per land cell
const W = 720;
const H = 360;
const X = (lon: number) => ((lon + 180) / 360) * W;
const Y = (lat: number) => ((90 - lat) / 180) * H;

function ringPath(ring: Ring): string {
  return ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}`).join('') + 'Z';
}

interface Cell {
  id: string;
  lat: number;
  lon: number;
}

interface CellResult extends Cell {
  slopePerDecade: number;
  pStar: number;
  naiveP: number;
}

/** Diverging blue (falling) – white – red (rising) */
function colorFor(value: number, maxAbs: number): string {
  const t = Math.max(-1, Math.min(1, maxAbs > 0 ? value / maxAbs : 0));
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  const white = [248, 250, 252];
  const target = t >= 0 ? [220, 38, 38] : [37, 99, 235];
  const k = Math.abs(t);
  return `rgb(${lerp(white[0], target[0], k)},${lerp(white[1], target[1], k)},${lerp(white[2], target[2], k)})`;
}

function fmtSlope(n: number): string {
  const a = Math.abs(n);
  const s = a >= 100 ? a.toFixed(0) : a >= 1 ? a.toFixed(2) : Number(a.toPrecision(2)).toString();
  return `${n < 0 ? '−' : '+'}${s}`;
}

interface TrendMapViewProps {
  variable: EarthVariable;
  onAnalyzePoint: (lat: number, lon: number) => void;
  /** Opens the satellite explorer on this spot */
  onSeeFromSpace?: (lat: number, lon: number) => void;
}

export const TrendMapView: React.FC<TrendMapViewProps> = ({ variable, onAnalyzePoint, onSeeFromSpace }) => {
  const polys = useMemo(loadLand, []);
  const landPath = useMemo(() => polys.map(p => p.map(ringPath).join('')).join(''), [polys]);
  const cells: Cell[] = useMemo(() => landCells(polys), [polys]);

  const supported = variable.provider === 'power' && variable.scope !== 'global';
  const [raw, setRaw] = useState<CellResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, failed: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    setRaw([]);
    setProgress({ done: 0, failed: 0 });
    setHover(null);
    setSelected(null);
    if (!supported) return;
    const myRun = ++runId.current;
    let cursor = 0;
    let done = 0;
    let failed = 0;
    const acc: CellResult[] = [];

    const worker = async () => {
      while (runId.current === myRun && cursor < cells.length) {
        const cell = cells[cursor++];
        try {
          const ts = await fetchRealSeries(variable.id, cell.lat, cell.lon);
          // yield to the browser so the map stays interactive while the statistics run
          await new Promise(r => setTimeout(r, 0));
          const res = processMonthlyTimeSeries(ts.dates, ts.values, variable.unit, '1991-2020');
          acc.push({
            ...cell,
            slopePerDecade: res.stats.sensSlopePerDecade,
            pStar: res.stats.hamedRaoMkPValue,
            naiveP: res.stats.mkPValue
          });
        } catch {
          failed++;
        }
        done++;
        if (runId.current === myRun) {
          setProgress({ done, failed });
          if (done % 4 === 0 || done === cells.length) setRaw([...acc]);
        }
      }
    };
    Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      if (runId.current === myRun) setRaw([...acc]);
    });
    return () => {
      runId.current++;
    };
  }, [variable.id, variable.unit, supported, cells]);

  // Field significance: Benjamini–Hochberg FDR across every cell on the map
  const results = useMemo(() => {
    if (raw.length === 0) return [];
    const fdr = applyBenjaminiHochbergFDR(
      raw.map(r => ({
        id: r.id,
        regionName: formatCoords(r.lat, r.lon, 1),
        variableName: variable.shortCode,
        slopePerDecade: r.slopePerDecade,
        unit: variable.unit,
        naiveMkPValue: r.naiveP,
        hamedRaoPValue: r.pStar
      })),
      0.05
    );
    return raw.map((r, i) => ({ ...r, q: fdr[i].bhAdjustedQValue, sig: fdr[i].survivesFdr05 }));
  }, [raw, variable]);

  const maxAbs = useMemo(() => {
    const abs = results.map(r => Math.abs(r.slopePerDecade)).sort((a, b) => a - b);
    return abs.length ? abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))] : 0;
  }, [results]);

  const summary = useMemo(() => {
    const sig = results.filter(r => r.sig);
    const up = sig.filter(r => r.slopePerDecade > 0);
    const down = sig.filter(r => r.slopePerDecade < 0);
    const strongestUp = [...up].sort((a, b) => b.slopePerDecade - a.slopePerDecade)[0];
    const strongestDown = [...down].sort((a, b) => a.slopePerDecade - b.slopePerDecade)[0];
    return { sig, up, down, strongestUp, strongestDown };
  }, [results]);

  const hovered = results.find(r => r.id === (hover ?? selected)) || null;
  const scanning = supported && progress.done < cells.length;

  if (!supported) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-2" role="status">
        <h3 className="text-base font-bold text-slate-900">Trend map is not available for this variable</h3>
        <p className="text-sm text-slate-600">
          {variable.name} comes from {variable.scope === 'global' ? 'a single worldwide reference station' : 'a single-point satellite time-series service'},
          so it cannot be sampled across the globe quickly. Choose a MERRA-2 variable (temperature, humidity, cloud, aerosol, rainfall,
          soil wetness, sunlight, wind or ozone) to map where change is happening.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-semibold">Where is it changing?</div>
          <h3 className="text-lg font-bold text-slate-900">
            {variable.name}: trend per decade across land ({cells.length} sampled cells)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Each square is a real {variable.resolution ? `${variable.resolution} ` : ''}series sampled every {STEP}°, {variable.startYear ?? 1981} to
            present. <strong>Dots</strong> mark cells where the trend is still significant after correcting for testing {results.length || cells.length} places at once (false-discovery rate 5%).
          </p>
        </div>
        {scanning && (
          <div className="flex items-center gap-2 text-xs text-slate-600" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            Fetching real data… {progress.done}/{cells.length}
          </div>
        )}
      </div>

      {scanning && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${(progress.done / cells.length) * 100}%` }} />
        </div>
      )}

      <div className="relative rounded-xl border border-slate-200 bg-sky-50/60 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`Map of ${variable.name} trends`}>
          <clipPath id="trend-map-clip">
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          <g clipPath="url(#trend-map-clip)">
            {[0, W, -W].map(dx => (
              <path key={dx} d={landPath} transform={`translate(${dx} 0)`} fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.4" fillRule="evenodd" />
            ))}
          </g>
          {results.map(r => {
            const x = X(r.lon - STEP / 2);
            const y = Y(r.lat + STEP / 2);
            const size = (STEP / 360) * W;
            return (
              <g
                key={r.id}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover(h => (h === r.id ? null : h))}
                onClick={e => {
                  // Touch: first tap reads the value (no hover on phones); mouse: click goes straight to analysis.
                  const pt = (e.nativeEvent as PointerEvent).pointerType;
                  if (pt === 'touch' || pt === 'pen') {
                    setSelected(r.id);
                    setHover(r.id);
                  } else onAnalyzePoint(r.lat, r.lon);
                }}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={size}
                  height={size}
                  fill={colorFor(r.slopePerDecade, maxAbs)}
                  fillOpacity={r.sig ? 0.95 : 0.6}
                  stroke={hover === r.id ? '#0F172A' : '#ffffff'}
                  strokeWidth={hover === r.id ? 1.2 : 0.4}
                />
                {r.sig && <circle cx={x + size / 2} cy={y + size / 2} r={1.7} fill="#0F172A" />}
              </g>
            );
          })}
        </svg>
        {results.length === 0 && !scanning && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">No data could be retrieved.</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-mono">{maxAbs ? `−${fmtSlope(maxAbs).slice(1)}` : '−'}</span>
          <span
            className="h-2.5 w-40 rounded-full border border-slate-200"
            style={{ background: `linear-gradient(to right, ${colorFor(-1, 1)}, ${colorFor(0, 1)}, ${colorFor(1, 1)})` }}
            aria-hidden="true"
          />
          <span className="font-mono">{maxAbs ? fmtSlope(maxAbs) : '+'}</span>
          <span>{variable.unit} per decade (blue = falling, red = rising)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-900" /> significant after FDR
          <span className="inline-block w-3 h-3 ml-3 rounded-sm bg-slate-300 opacity-60" /> not distinguishable from noise
        </div>
      </div>

      {/* Readout */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-sm text-slate-800 min-h-[84px]" aria-live="polite">
          {hovered ? (
            <>
              <div className="font-semibold">{formatCoords(hovered.lat, hovered.lon, 1)}</div>
              <div>
                {fmtSlope(hovered.slopePerDecade)} {variable.unit} per decade
              </div>
              <div className="text-xs text-slate-500">
                {hovered.sig ? 'Significant after FDR' : 'Not significant after FDR'} (p* = {hovered.pStar <= 0.0001 ? '< 0.0001' : hovered.pStar}, q ={' '}
                {hovered.q <= 0.0001 ? '< 0.0001' : hovered.q}).
              </div>
              <button
                onClick={() => onAnalyzePoint(hovered.lat, hovered.lon)}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Analyze this location →
              </button>
              {onSeeFromSpace && (
                <button
                  onClick={() => onSeeFromSpace(hovered.lat, hovered.lon)}
                  className="mt-2 ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-slate-500 text-slate-800 text-xs font-semibold"
                >
                  <Satellite className="w-3.5 h-3.5" /> See it from space
                </button>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 text-slate-600">
              <MousePointerClick className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Hover (or tap) a square to read its trend, then analyze that exact location in detail.</span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-sm text-slate-800 space-y-1">
          {results.length === 0 ? (
            <span className="text-slate-500">Summary appears as data arrives…</span>
          ) : (
            <>
              <div>
                <strong>{summary.sig.length}</strong> of {results.length} cells show a real change: <strong>{summary.up.length}</strong> rising,{' '}
                <strong>{summary.down.length}</strong> falling.
              </div>
              {summary.strongestUp && (
                <div className="text-xs text-slate-600">
                  Strongest rise near {formatCoords(summary.strongestUp.lat, summary.strongestUp.lon, 1)} ({fmtSlope(summary.strongestUp.slopePerDecade)} {variable.unit}/decade).
                </div>
              )}
              {summary.strongestDown && (
                <div className="text-xs text-slate-600">
                  Strongest fall near {formatCoords(summary.strongestDown.lat, summary.strongestDown.lon, 1)} ({fmtSlope(summary.strongestDown.slopePerDecade)} {variable.unit}/decade).
                </div>
              )}
              {progress.failed > 0 && <div className="text-xs text-amber-700">{progress.failed} cell(s) could not be retrieved and are left blank.</div>}
            </>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Neighbouring cells are not independent, so the FDR correction is approximate; treat isolated dots with caution. Land cells are chosen by whether the cell
        centre lies on land, so some coastal cells are omitted. Coastlines: Natural Earth 1:110m.
      </p>
    </div>
  );
};
