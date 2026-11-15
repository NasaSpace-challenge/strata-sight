import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, ImageOff, Loader2, Play, Search, X } from 'lucide-react';
import { fetchMedia, fetchVideoAsset, MediaItem, mediaQueriesFor } from '../../services/earthView';

interface MediaTabProps {
  name: string | null;
  admin1?: string | null;
  country?: string | null;
  label: string;
}

type Filter = 'all' | 'image' | 'video';

const Lightbox: React.FC<{ item: MediaItem; onClose: () => void }> = ({ item, onClose }) => {
  const [video, setVideo] = useState<{ videoUrl: string | null; captionsUrl: string | null } | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (item.type !== 'video') return;
    let active = true;
    fetchVideoAsset(item.id)
      .then(v => active && (v.videoUrl ? setVideo(v) : setVideoFailed(true)))
      .catch(() => active && setVideoFailed(true));
    return () => {
      active = false;
    };
  }, [item]);

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/85 flex items-center justify-center p-3 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={e => e.stopPropagation()}>
        <button ref={closeRef} onClick={onClose} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <div className="bg-black flex items-center justify-center min-h-[200px]">
          {item.type === 'video' ? (
            video?.videoUrl ? (
              <video src={video.videoUrl} controls autoPlay playsInline poster={item.thumb} className="w-full max-h-[60vh]">
                {video.captionsUrl && <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" />}
              </video>
            ) : videoFailed ? (
              <div className="p-8 text-center text-slate-300 text-sm">
                <img src={item.thumb} alt="" className="mx-auto mb-3 max-h-40 rounded" />
                This video can’t be played here. Watch it on NASA’s site below.
              </div>
            ) : (
              <Loader2 className="w-7 h-7 animate-spin text-slate-300 my-16" />
            )
          ) : (
            <img src={item.image ?? item.thumb} alt={item.title} className="w-full max-h-[60vh] object-contain" />
          )}
        </div>
        <div className="p-4 overflow-y-auto">
          <h3 className="text-base font-bold text-slate-900 pr-8">{item.title}</h3>
          <div className="mt-0.5 text-xs text-slate-500">
            {item.date && new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {item.credit && ` · ${item.credit}`}
          </div>
          {item.description && <p className="mt-2 text-sm text-slate-700 leading-relaxed line-clamp-6">{item.description}</p>}
          <a href={item.page} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
            View on NASA Images and Video Library <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export const MediaTab: React.FC<MediaTabProps> = ({ name, admin1, country, label }) => {
  const [queries, setQueries] = useState<string[]>(() => mediaQueriesFor({ name, admin1, country }));
  const [custom, setCustom] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    setQueries(mediaQueriesFor({ name, admin1, country }));
    setCustom('');
  }, [name, admin1, country]);

  useEffect(() => {
    if (queries.length === 0) {
      setItems([]);
      setStatus('ready');
      return;
    }
    const ctrl = new AbortController();
    setStatus('loading');
    fetchMedia(queries, ctrl.signal)
      .then(r => {
        setItems(r.items);
        setStatus('ready');
      })
      .catch(e => e.name !== 'AbortError' && setStatus('error'));
    return () => ctrl.abort();
  }, [queries, attempt]);

  const shown = items.filter(i => filter === 'all' || i.type === filter);
  const videos = items.filter(i => i.type === 'video').length;

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => {
          e.preventDefault();
          const q = custom.trim();
          if (q.length >= 2) setQueries([q]);
        }}
        className="flex gap-2"
        role="search"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder={`Search NASA pictures and videos (showing: ${queries.join(', ') || 'nothing'})`}
            aria-label="Search NASA media"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Media type">
        {([
          ['all', `All (${items.length})`],
          ['image', `Pictures (${items.length - videos})`],
          ['video', `Videos (${videos})`]
        ] as [Filter, string][]).map(([id, text]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${filter === id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}
          >
            {text}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Searching NASA’s archive for {label}…
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
          The NASA media library did not respond.{' '}
          <button onClick={() => setAttempt(a => a + 1)} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}
      {status === 'ready' && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
          <ImageOff className="w-7 h-7 mx-auto mb-2 text-slate-400" />
          NASA has no {filter === 'all' ? 'pictures or videos' : filter === 'image' ? 'pictures' : 'videos'} tagged with this place. The archive is patchy for smaller places, so try the country or a nearby landmark in the search box.
        </div>
      )}
      {status === 'ready' && shown.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shown.map(item => (
            <li key={item.id}>
              <button onClick={() => setOpen(item)} className="group block w-full text-left rounded-xl overflow-hidden border border-slate-200 bg-white hover:border-slate-400 hover:shadow-md transition">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={item.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {item.type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full bg-slate-900/75 text-white flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <Play className="w-5 h-5 ml-0.5" />
                      </span>
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-slate-900 line-clamp-2">{item.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{item.date ? new Date(item.date).getFullYear() : ''}{item.credit ? ` · ${item.credit}` : ''}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-400">Pictures and videos from the NASA Image and Video Library. Matched by place keywords, so a few may be only loosely related. Most are not real time.</p>

      {open && <Lightbox item={open} onClose={close} />}
    </div>
  );
};
