import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Loader2, Pause, Play, TriangleAlert } from 'lucide-react';
import { addDays, BestCandidate, fetchBest, formatDay, LayersResponse, snapshotUrl } from '../../services/earthView';

interface TimeLapseProps {
  layers: LayersResponse;
  lat: number;
  lon: number;
  label: string;
}

interface Frame extends BestCandidate {
  url: string;
}

const PRESETS = [
  { id: '14', label: 'Last 2 weeks', days: 14 },
  { id: '30', label: 'Last 30 days', days: 30 }
] as const;
const SPANS = [
  { km: 50, label: 'Close (50 km)' },
  { km: 100, label: 'Local (100 km)' },
  { km: 250, label: 'Region (250 km)' }
];

/** Load images with limited parallelism; resolves the urls that loaded. */
async function preload(urls: string[], onProgress: (n: number) => void, signal: { cancelled: boolean }): Promise<Set<string>> {
  const ok = new Set<string>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < urls.length && !signal.cancelled) {
      const url = urls[next++];
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          ok.add(url);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return ok;
}

export const TimeLapse: React.FC<TimeLapseProps> = ({ layers, lat, lon, label }) => {
  const layer = layers.layers.find(l => l.key === 'terra')!;
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('14');
  const [span, setSpan] = useState(100);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [frames, setFrames] = useState<Frame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hideCloudy, setHideCloudy] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(2);
  const job = useRef({ cancelled: false });

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shown = useMemo(() => {
    if (!hideCloudy) return frames;
    const lum = frames.map(f => f.brightness ?? 0).sort((a, b) => a - b);
    const median = lum[Math.floor(lum.length / 2)] || 0;
    // very cloudy days and dim passes (low sun, haze) would make the loop flicker
    return frames.filter(f => f.cloudPct <= 70 && (f.brightness === undefined || f.brightness >= median * 0.6));
  }, [frames, hideCloudy]);
  const hiddenCount = frames.length - shown.length;
  const frame = shown[Math.min(index, Math.max(0, shown.length - 1))];

  // A new place or setting invalidates the loaded film.
  useEffect(() => {
    job.current.cancelled = true;
    setStatus('idle');
    setFrames([]);
    setPlaying(false);
    setIndex(0);
  }, [lat, lon, span, preset]);

  useEffect(() => () => void (job.current.cancelled = true), []);

  const build = useCallback(async () => {
    job.current.cancelled = true;
    const mine = { cancelled: false };
    job.current = mine;
    setStatus('loading');
    setError(null);
    setPlaying(false);
    setFrames([]);
    setIndex(0);
    try {
      const days = PRESETS.find(p => p.id === preset)!.days;
      const lastDay = addDays(layer.end, -1); // today is usually only partly covered
      // 1) which days have a usable picture here (tiny cached probes, 14 days per request)
      const chunks: Promise<{ candidates: BestCandidate[] }>[] = [];
      for (let offset = 0; offset < days; offset += 14) {
        chunks.push(fetchBest(layer.key, lat, lon, { end: addDays(lastDay, -offset), days: Math.min(14, days - offset), span }));
      }
      const probes = (await Promise.all(chunks)).flatMap(c => c.candidates);
      const usable = probes
        .filter(c => c.noDataPct <= 25)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map(c => ({ ...c, url: snapshotUrl(layer.key, lat, lon, c.date, { span, size: 560 }) }));
      if (usable.length < 3) throw new Error('Too few days with a usable satellite picture here. Try a larger area or a different place.');
      // 2) fetch the pictures themselves
      setProgress({ done: 0, total: usable.length });
      const ok = await preload(usable.map(f => f.url), n => !mine.cancelled && setProgress(p => ({ ...p, done: n })), mine);
      if (mine.cancelled) return;
      const loaded = usable.filter(f => ok.has(f.url));
      if (loaded.length < 3) throw new Error('NASA did not return enough pictures. Please try again in a moment.');
      setFrames(loaded);
      setStatus('ready');
      setIndex(0);
      setPlaying(!reducedMotion);
    } catch (e) {
      if (!mine.cancelled) {
        setError((e as Error).message);
        setStatus('error');
      }
    }
  }, [layer, lat, lon, preset, span, reducedMotion]);

  // playback
  useEffect(() => {
    if (!playing || shown.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % shown.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, fps, shown.length]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 border border-slate-200 p-1" role="group" aria-label="Time range">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              aria-pressed={preset === p.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={span}
          onChange={e => setSpan(Number(e.target.value))}
          aria-label="Area covered"
          className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
        >
          {SPANS.map(s => (
            <option key={s.km} value={s.km}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={build}
          disabled={status === 'loading'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
          {status === 'ready' ? 'Rebuild time-lapse' : 'Make time-lapse'}
        </button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square max-h-[520px] mx-auto w-full sm:w-[520px]">
        {frame ? (
          <>
            <img src={frame.url} alt={`Satellite picture of ${label} on ${formatDay(frame.date)}, about ${frame.cloudPct}% cloud`} className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white">{formatDay(frame.date)}</div>
            <div className="absolute top-3 right-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-slate-200">
              {Math.min(index, shown.length - 1) + 1} / {shown.length}
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200">~{frame.cloudPct}% cloud</div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-slate-300">
            {status === 'loading' ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <p className="mt-3 text-sm font-medium">{progress.total ? `Downloading pictures from NASA… ${progress.done} of ${progress.total}` : 'Checking which days have a clear view…'}</p>
                {progress.total > 0 && (
                  <div className="mt-3 h-1.5 w-56 rounded-full bg-slate-700 overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-blue-400 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                )}
              </>
            ) : (
              <>
                <Clapperboard className="w-9 h-9 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">Watch {label} change day by day</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">Press “Make time-lapse” to fetch the real daily pictures from NASA’s Terra satellite and play them as a loop.</p>
              </>
            )}
          </div>
        )}
      </div>

      {status === 'ready' && shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 max-w-[520px] mx-auto">
          <button
            onClick={() => setPlaying(p => !p)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white hover:bg-slate-800"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={shown.length - 1}
            value={Math.min(index, shown.length - 1)}
            onChange={e => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            aria-label="Frame"
            className="flex-1 min-w-[140px] accent-blue-600"
          />
          <select value={fps} onChange={e => setFps(Number(e.target.value))} aria-label="Speed" className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
            <option value={1}>Slow</option>
            <option value={2}>Normal</option>
            <option value={4}>Fast</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 w-full sm:w-auto">
            <input type="checkbox" checked={hideCloudy} onChange={e => setHideCloudy(e.target.checked)} className="accent-blue-600" />
            Hide cloudy or dim days{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
          </label>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" /> {error}
        </p>
      )}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        Real daily pictures from NASA’s Terra / MODIS satellite (250 m per pixel), one per day the satellite had a usable view. Moving smoke, cloud and haze are the weather, not a loop of one image. This is a series of snapshots, not live video.
      </div>
    </div>
  );
};
