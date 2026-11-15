import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ImageOff, Loader2, Satellite } from 'lucide-react';
import { formatDay, timeAgo } from '../../services/earthView';
import { useBestSnapshot } from '../../hooks/useBestSnapshot';

interface SeeFromSpaceCardProps {
  lat: number;
  lon: number;
  regionLabel: string;
  onOpen: () => void;
}

/** A real satellite picture of the place under the verdict, loaded only when it scrolls into view. */
export const SeeFromSpaceCard: React.FC<SeeFromSpaceCardProps> = ({ lat, lon, regionLabel, onOpen }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const snap = useBestSnapshot(lat, lon, visible, 100, 640);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => setPhotoFailed(false), [snap.url]);

  return (
    <section ref={ref} aria-label="See it from space" className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative sm:w-[46%] aspect-[16/10] sm:aspect-auto sm:min-h-[210px] bg-slate-900 flex-shrink-0">
          {snap.url && !photoFailed ? (
            <img src={snap.url} alt={`Satellite picture of ${regionLabel}`} onError={() => setPhotoFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-xs text-center px-4">
              {snap.status === 'error' || photoFailed ? (
                <>
                  <ImageOff className="w-6 h-6 mb-2 text-slate-500" />
                  {snap.error ?? 'The picture could not be loaded.'}
                </>
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              )}
            </div>
          )}
          {snap.best && snap.url && !photoFailed && (
            <div className="absolute bottom-2 left-2 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] text-white">
              {formatDay(snap.best.date)} ({timeAgo(snap.best.date)}) · ~{snap.best.cloudPct}% cloud
            </div>
          )}
        </div>
        <div className="p-5 flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            <Satellite className="w-3.5 h-3.5" /> The place, from space
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900">{regionLabel} as NASA’s satellites see it</h3>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            The clearest picture from the last week, from Terra / MODIS. It shows the place today. The statistics above are what tell you whether it is changing.
          </p>
          <div className="mt-auto pt-4">
            <button onClick={onOpen} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm">
              Explore, time-lapse, then vs now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
