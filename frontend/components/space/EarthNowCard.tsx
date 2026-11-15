import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { EpicLatest, fetchEpicLatest, timeAgo } from '../../services/earthView';

// Land outlines and the full viewer load only when someone opens it.
const EarthViewer = lazy(() => import('./EarthViewer').then(m => ({ default: m.EarthViewer })));

/** The most recent whole-Earth picture from NASA's EPIC camera on DSCOVR; click for a large view. Renders nothing if unavailable. */
export const EarthNowCard: React.FC = () => {
  const [epic, setEpic] = useState<EpicLatest | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let active = true;
    fetchEpicLatest()
      .then(r => active && setEpic(r))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return null;
  return (
    <figure className="flex-shrink-0 flex flex-col items-center text-center w-44 sm:w-56 mx-auto lg:mx-0">
      <button
        onClick={() => epic && setOpen(true)}
        disabled={!epic}
        className="group relative w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-slate-950 overflow-hidden shadow-lg ring-1 ring-slate-300 hover:ring-4 hover:ring-blue-400/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500 transition-shadow cursor-zoom-in"
        aria-label="View the latest picture of Earth larger"
      >
        {epic && (
          <img
            src={epic.thumbUrl}
            alt="The whole Earth as photographed by NASA's EPIC camera on the DSCOVR satellite"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`w-full h-full object-cover scale-[1.3] transition-all duration-700 group-hover:scale-[1.38] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white opacity-90 group-hover:opacity-100">
          <Maximize2 className="w-3 h-3" /> View larger
        </span>
      </button>
      <figcaption className="mt-2 text-[11px] text-slate-500 leading-snug">
        <strong className="text-slate-700 block">Earth, {epic ? timeAgo(epic.date.replace(' ', 'T') + 'Z') : 'right now'}</strong>
        Photographed by NASA’s EPIC camera, 1.5 million km away.
      </figcaption>
      {open && epic && (
        <Suspense fallback={null}>
          <EarthViewer initialDate={epic.date.slice(0, 10)} onClose={close} />
        </Suspense>
      )}
    </figure>
  );
};
