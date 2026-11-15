import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeftRight, BarChart3, Loader2, TriangleAlert } from 'lucide-react';
import { addDays, BestCandidate, clampDate, fetchBest, formatDay, ImageryLayer, LayersResponse } from '../../services/earthView';

interface BeforeAfterProps {
  layers: LayersResponse;
  lat: number;
  lon: number;
  label: string;
  onAnalyze?: () => void;
}

interface Pick {
  date: string;
  best: BestCandidate | null;
}

/** Same calendar day in another year, so the seasons match. */
const sameDayInYear = (iso: string, year: number) => {
  const [, m, d] = iso.split('-');
  // 29 Feb exists only in leap years
  return `${year}-${m}-${m === '02' && d === '29' ? '28' : d}`;
};

export const BeforeAfter: React.FC<BeforeAfterProps> = ({ layers, lat, lon, label, onAnalyze }) => {
  const layer = layers.layers.find(l => l.key === 'terra') as ImageryLayer;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leftRef = useRef<L.TileLayer | null>(null);
  const rightRef = useRef<L.TileLayer | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef(0.5);
  const [ratio, setRatio] = useState(0.5);

  const latestYear = Number(layer.end.slice(0, 4));
  const [year, setYear] = useState(2001);
  const [now, setNow] = useState<Pick | null>(null);
  const [before, setBefore] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyClip = useCallback(() => {
    const map = mapRef.current;
    const l = leftRef.current?.getContainer();
    const r = rightRef.current?.getContainer();
    if (!map || !l || !r) return;
    const size = map.getSize();
    const nw = map.containerPointToLayerPoint([0, 0]);
    const se = map.containerPointToLayerPoint(size);
    const x = nw.x + size.x * ratioRef.current;
    l.style.clip = `rect(${nw.y}px, ${x}px, ${se.y}px, ${nw.x}px)`;
    r.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${x}px)`;
  }, []);

  // ---- map ------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!mapEl.current) return;
    const map = L.map(mapEl.current, { center: [lat, lon], zoom: 8, minZoom: 3, maxZoom: 11, attributionControl: false, zoomControl: false, worldCopyJump: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution('Imagery: NASA EOSDIS GIBS / Worldview · Terra MODIS').addTo(map);
    L.tileLayer(layers.base.template, { maxNativeZoom: layers.base.maxZoom, maxZoom: 11, zIndex: 1 }).addTo(map);
    const opts = { maxNativeZoom: layer.maxZoom, maxZoom: 11, zIndex: 2 };
    leftRef.current = L.tileLayer(layer.tileTemplate.replace('{time}', layer.start), opts).addTo(map);
    rightRef.current = L.tileLayer(layer.tileTemplate.replace('{time}', layer.end), opts).addTo(map);
    L.marker([lat, lon], {
      icon: L.divIcon({ className: 'ep-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
      interactive: false,
      keyboard: false
    }).addTo(map);
    map.on('move zoom viewreset resize layeradd', applyClip);
    mapRef.current = map;
    applyClip();
    return () => {
      map.remove();
      mapRef.current = null;
      leftRef.current = null;
      rightRef.current = null;
    };
    // created once; place changes recentre below, dates update the two layers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setView([lat, lon], mapRef.current.getZoom());
  }, [lat, lon]);

  // ---- choose the two dates (clearest day near the same calendar day) -----------------------------
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const recent = await fetchBest(layer.key, lat, lon, { days: 7 });
        const nowDate = recent.best?.date ?? addDays(layer.end, -1);
        const target = clampDate(sameDayInYear(nowDate, year), layer);
        const around = await fetchBest(layer.key, lat, lon, { end: clampDate(addDays(target, 3), layer), days: 7 });
        if (!active) return;
        setNow({ date: nowDate, best: recent.best });
        setBefore({ date: around.best?.date ?? target, best: around.best });
        setBusy(false);
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setBusy(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [lat, lon, year, layer]);

  useEffect(() => {
    if (before) leftRef.current?.setUrl(layer.tileTemplate.replace('{time}', before.date));
    if (now) rightRef.current?.setUrl(layer.tileTemplate.replace('{time}', now.date));
    applyClip();
  }, [before, now, layer, applyClip]);

  useEffect(() => {
    ratioRef.current = ratio;
    applyClip();
  }, [ratio, applyClip]);

  // ---- slider ---------------------------------------------------------------------------------------
  const dragTo = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (box) setRatio(Math.min(0.97, Math.max(0.03, (clientX - box.left) / box.width)));
  };

  const years = Array.from({ length: latestYear - 2001 }, (_, i) => 2001 + i);
  const cloudy = [before, now].some(p => p?.best && p.best.cloudPct > 40);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <span className="font-semibold">Compare today with</span>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            aria-label="Year to compare with"
          >
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-500">Same time of year, clearest nearby day, so the seasons match.</span>
      </div>

      <div ref={boxRef} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 select-none">
        <div ref={mapEl} className="h-[380px] sm:h-[500px] w-full" role="application" aria-label={`Before and after satellite pictures of ${label}`} />
        {busy && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-900/40">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Finding clear days…
            </span>
          </div>
        )}
        {before && (
          <div className="absolute top-3 left-3 z-[500] rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white pointer-events-none">
            Before · {formatDay(before.date)}
          </div>
        )}
        {now && (
          <div className="absolute top-3 right-3 z-[500] rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white pointer-events-none">
            Now · {formatDay(now.date)}
          </div>
        )}
        {/* divider */}
        <div className="absolute inset-y-0 z-[550] w-0.5 bg-white shadow pointer-events-none" style={{ left: `${ratio * 100}%` }} />
        <button
          role="slider"
          aria-label="Drag to compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragTo(e.clientX);
          }}
          onPointerMove={e => e.buttons === 1 && dragTo(e.clientX)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') setRatio(r => Math.max(0.03, r - 0.05));
            if (e.key === 'ArrowRight') setRatio(r => Math.min(0.97, r + 0.05));
          }}
          style={{ left: `${ratio * 100}%`, touchAction: 'none' }}
          className="absolute top-1/2 z-[560] -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-300 flex items-center justify-center text-slate-700 cursor-ew-resize focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        >
          <ArrowLeftRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </p>
      )}
      {cloudy && !busy && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
          <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" />
          One of these pictures is partly cloudy (estimated {Math.max(before?.best?.cloudPct ?? 0, now?.best?.cloudPct ?? 0)}%). Try another year for a clearer comparison.
        </p>
      )}

      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        Terra / MODIS, 250 m per pixel. Differences between two pictures can come from season, weather, smoke and haze as well as real change on the ground. One day cannot prove a trend.
        {onAnalyze && (
          <button onClick={onAnalyze} className="ml-2 inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">
            <BarChart3 className="w-3.5 h-3.5" /> Test the change with 40+ years of data →
          </button>
        )}
      </div>
    </div>
  );
};
