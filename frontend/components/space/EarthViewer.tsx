import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Moon, Pause, Play, Satellite, Sun, TriangleAlert, X } from 'lucide-react';
import {
  addDays,
  EpicCollection,
  EpicDay,
  EpicImage,
  fetchEpicDates,
  fetchEpicDay,
  formatDay,
  formatKm,
  localSolarTime,
  timeAgo
} from '../../services/earthView';
import { formatCoords } from '../../services/earthScienceData';
import { LandPolygon, loadLand } from '../../services/landGrid';

interface EarthViewerProps {
  /** "YYYY-MM-DD" of the picture to open on */
  initialDate: string;
  onClose: () => void;
}

const COLLECTIONS: { id: EpicCollection; label: string; hint: string }[] = [
  { id: 'natural', label: 'Natural colour', hint: 'As the camera recorded it. Published within a day or two.' },
  { id: 'enhanced', label: 'Enhanced colour', hint: 'Colour-balanced for clarity. Published a few days later.' }
];

/** The newest available day that is on or before `want`, or the oldest/newest if none fits. `dates` is newest first. */
const nearestDate = (dates: string[], want: string): string => dates.find(d => d <= want) ?? (want > dates[0] ? dates[0] : dates[dates.length - 1]);

const ringPath = (ring: number[][]) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(lon + 180).toFixed(1)} ${(90 - lat).toFixed(1)}`).join('') + 'Z';

const Locator: React.FC<{ images: EpicImage[]; index: number }> = ({ images, index }) => {
  const polys = useMemo<LandPolygon[]>(loadLand, []);
  const land = useMemo(() => polys.map(p => p.map(ringPath).join('')).join(''), [polys]);
  const cur = images[index];
  const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
  return (
    <svg viewBox="0 0 360 180" className="w-full rounded-lg bg-slate-800" role="img" aria-label={cur?.lat != null ? `World map. The picture is centred on ${formatCoords(cur.lat, cur.lon ?? 0, 1)}.` : 'World map'}>
      {[-360, 0, 360].map(dx => (
        <path key={dx} d={land} transform={`translate(${dx} 0)`} fill="#475569" stroke="#64748b" strokeWidth="0.3" fillRule="evenodd" />
      ))}
      {images.map((im, i) =>
        im.lat == null || im.lon == null ? null : <circle key={im.image} cx={wrap(im.lon) + 180} cy={90 - im.lat} r={i === index ? 0 : 1.6} fill="#94a3b8" opacity="0.8" />
      )}
      {cur?.lat != null && cur.lon != null && (
        <>
          <circle cx={wrap(cur.lon) + 180} cy={90 - cur.lat} r="9" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
          <circle cx={wrap(cur.lon) + 180} cy={90 - cur.lat} r="3.4" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
        </>
      )}
    </svg>
  );
};

const Stat: React.FC<{ icon?: React.ReactNode; label: string; value: React.ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2" title={hint}>
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
      {icon}
      {label}
    </div>
    <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
  </div>
);

export const EarthViewer: React.FC<EarthViewerProps> = ({ initialDate, onClose }) => {
  const [collection, setCollection] = useState<EpicCollection>('natural');
  const [dates, setDates] = useState<string[] | null>(null);
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState<EpicDay | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(-1); // -1 = newest frame of the day once loaded
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(5);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef(date);
  dateRef.current = date;

  // dialog behaviour
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // which days exist for the chosen colour
  useEffect(() => {
    let active = true;
    setDates(null);
    fetchEpicDates(collection)
      .then(d => {
        if (!active) return;
        setDates(d);
        const cur = dateRef.current;
        const next = nearestDate(d, cur);
        if (next !== cur) {
          setNote(`NASA has no ${collection} pictures for ${formatDay(cur)}. Showing the nearest day, ${formatDay(next)}.`);
          setDate(next);
        }
      })
      .catch(e => {
        if (active) {
          setError((e as Error).message);
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [collection, attempt]);

  // the pictures of that day
  useEffect(() => {
    if (!dates) return;
    let active = true;
    setStatus('loading');
    setError(null);
    fetchEpicDay(date, collection)
      .then(d => {
        if (!active) return;
        setDay(d);
        setIndex(-1);
        setStatus('ready');
        setImgLoaded(false);
        d.images.forEach(im => {
          const img = new Image();
          img.src = im.thumbUrl; // warm the cache so playback is smooth
        });
      })
      .catch(e => {
        if (!active) return;
        setError((e as Error).message);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [date, collection, dates, attempt]);

  const images = day?.images ?? [];
  const cur = index < 0 ? images.length - 1 : Math.min(index, images.length - 1);
  const frame: EpicImage | undefined = images[cur];

  useEffect(() => {
    if (!playing || images.length < 2) return;
    const t = setInterval(() => setIndex(i => ((i < 0 ? images.length - 1 : i) + 1) % images.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, fps, images.length]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' && images.length) {
        setPlaying(false);
        setIndex(Math.min(images.length - 1, cur + 1));
      }
      if (e.key === 'ArrowLeft' && images.length) {
        setPlaying(false);
        setIndex(Math.max(0, cur - 1));
      }
      if (e.key === ' ' && images.length > 1 && tag !== 'BUTTON') {
        e.preventDefault();
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, images.length, cur]);

  const idxOfDate = dates ? dates.indexOf(date) : -1;
  const goDay = (delta: 1 | -1) => {
    if (!dates || idxOfDate < 0) return;
    const next = dates[idxOfDate + (delta === 1 ? -1 : 1)]; // dates are newest first
    if (next) {
      setNote(null);
      setPlaying(false);
      setDate(next);
    }
  };

  const src = frame ? (playing ? frame.thumbUrl : frame.imageUrl) : null;
  const time = frame ? frame.date.slice(11, 16) : '';

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 overflow-y-auto text-left" role="dialog" aria-modal="true" aria-label="Earth from NASA's EPIC camera" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
          <button
            ref={closeRef}
            onClick={onClose}
            className="absolute -top-1 right-0 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <header className="pr-12">
            <h3 className="text-lg font-bold text-white">Earth from 1.5 million km away</h3>
            <p className="text-xs text-slate-400">
              Official pictures from NASA’s EPIC camera on NOAA’s DSCOVR spacecraft, which sits about 1.5 million km away between Earth and the Sun.
            </p>
          </header>

          <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
            {/* Stage */}
            <div className="flex flex-col items-center">
              <div className="relative flex-shrink-0 aspect-square rounded-full overflow-hidden bg-black w-full max-w-[min(100%,58vh)]">
                {src && (
                  <img
                    src={src}
                    alt={`The whole Earth on ${frame ? formatDay(frame.date) : ''} at ${time} UTC, photographed by NASA's EPIC camera`}
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-full object-cover scale-[1.3] transition-opacity duration-300 ${imgLoaded || playing ? 'opacity-100' : 'opacity-60'}`}
                  />
                )}
                {(status === 'loading' || (src && !imgLoaded && !playing)) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Loader2 className="w-7 h-7 animate-spin text-white/80" />
                  </div>
                )}
                {status === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10 text-slate-200 text-sm">
                    <TriangleAlert className="w-6 h-6 mb-2 text-amber-400" />
                    {error}
                    <button onClick={() => setAttempt(a => a + 1)} className="mt-3 font-semibold underline">
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {/* Day timeline */}
              {images.length > 0 && (
                <div className="mt-4 w-full max-w-[min(100%,58vh)] space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPlaying(p => !p)}
                      disabled={images.length < 2}
                      className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-slate-900 hover:bg-slate-200 disabled:opacity-40"
                      aria-label={playing ? 'Pause' : 'Watch the Earth turn'}
                    >
                      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={images.length - 1}
                      value={cur}
                      onChange={e => {
                        setPlaying(false);
                        setIndex(Number(e.target.value));
                      }}
                      aria-label="Time of day"
                      className="flex-1 accent-sky-400"
                    />
                    <select value={fps} onChange={e => setFps(Number(e.target.value))} aria-label="Speed" className="bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1 text-xs">
                      <option value={2} className="text-slate-900">Slow</option>
                      <option value={5} className="text-slate-900">Normal</option>
                      <option value={10} className="text-slate-900">Fast</option>
                    </select>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{images[0].date.slice(11, 16)} UTC</span>
                    <span className="text-slate-200 font-semibold">
                      {time} UTC · picture {cur + 1} of {images.length}
                    </span>
                    <span>{images[images.length - 1].date.slice(11, 16)} UTC</span>
                  </div>
                </div>
              )}
            </div>

            {/* Panel */}
            <div className="space-y-4 text-slate-200">
              <div className="inline-flex w-full rounded-xl bg-white/10 p-1" role="group" aria-label="Picture type">
                {COLLECTIONS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setPlaying(false);
                      setNote(null);
                      setCollection(c.id);
                    }}
                    aria-pressed={collection === c.id}
                    title={c.hint}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${collection === c.id ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goDay(-1)}
                  disabled={!dates || idxOfDate < 0 || idxOfDate >= dates.length - 1}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={date}
                  min={dates?.[dates.length - 1]}
                  max={dates?.[0]}
                  onChange={e => {
                    if (!e.target.value || !dates) return;
                    setPlaying(false);
                    const next = nearestDate(dates, e.target.value);
                    setNote(next !== e.target.value ? `No pictures on ${formatDay(e.target.value)}. Showing the nearest day, ${formatDay(next)}.` : null);
                    setDate(next);
                  }}
                  aria-label="Day"
                  className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold text-white [color-scheme:dark] focus:outline-none focus:border-sky-400"
                />
                <button
                  onClick={() => goDay(1)}
                  disabled={!dates || idxOfDate <= 0}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"
                  aria-label="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-400 -mt-2">
                {frame ? `${formatDay(frame.date)} (${timeAgo(day!.date)})` : ' '}
                {dates && ` · ${dates.length.toLocaleString('en-GB')} days published since ${formatDay(dates[dates.length - 1])}`}
              </div>
              {note && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-xs text-amber-100" role="status">
                  <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" /> {note}
                </p>
              )}

              {frame && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Taken (UTC)" value={`${time}`} hint="Universal time, the same everywhere" />
                    <Stat
                      label="Local sun time"
                      value={frame.lon != null ? localSolarTime(frame.date, frame.lon) : 'n/a'}
                      hint="Approximate mean solar time at the middle of the picture"
                    />
                    <div className="col-span-2">
                      <Stat label="Centre of the picture" value={frame.lat != null && frame.lon != null ? formatCoords(frame.lat, frame.lon, 2) : 'n/a'} />
                    </div>
                    <Stat icon={<Satellite className="w-3 h-3" />} label="DSCOVR distance" value={frame.spacecraftKm != null ? formatKm(frame.spacecraftKm) : 'n/a'} hint="From the centre of the Earth" />
                    <Stat icon={<Moon className="w-3 h-3" />} label="Moon distance" value={frame.moonKm != null ? formatKm(frame.moonKm) : 'n/a'} hint="From the centre of the Earth" />
                    <div className="col-span-2">
                      <Stat
                        icon={<Sun className="w-3 h-3" />}
                        label="Sun distance"
                        value={frame.sunAu != null ? `${frame.sunAu.toFixed(3)} AU (${Math.round(frame.sunAu * 149.5978707).toLocaleString('en-GB')} million km)` : 'n/a'}
                        hint="1 AU is the average Earth–Sun distance"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wide font-semibold text-slate-400">Where the camera was looking{images.length > 1 ? ' (grey dots: the rest of the day)' : ''}</div>
                    <div className="max-w-md"><Locator images={images} index={cur} /></div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                    <a href={frame.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                      <Download className="w-3.5 h-3.5" /> Full-size JPG
                    </a>
                    <a href={frame.pngUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                      <Download className="w-3.5 h-3.5" /> Original PNG
                    </a>
                    <a href="https://epic.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                      NASA EPIC <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500">
                Source: NASA EPIC (DSCOVR), Level 1B. Distances are computed from the spacecraft, Moon and Sun positions NASA publishes with each picture. Local sun time is approximate. Use the arrow keys to step through the day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
