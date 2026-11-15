import React, { useMemo, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Satellite } from 'lucide-react';
import { EventsResponse, formatDay, SpaceEvent, timeAgo } from '../../services/earthView';
import { eventStyle } from './eventStyle';

interface EventsTabProps {
  status: 'loading' | 'ready' | 'error';
  data: EventsResponse | null;
  error: string | null;
  label: string;
  onShowOnMap: (ev: SpaceEvent) => void;
  onRetry: () => void;
}

const EventRow: React.FC<{ ev: SpaceEvent; onShow: (ev: SpaceEvent) => void }> = ({ ev, onShow }) => {
  const style = eventStyle(ev.category.id);
  const Icon = style.icon;
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: style.color }} aria-hidden="true">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-slate-900">{ev.title}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${ev.status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>
            {ev.status === 'open' ? 'Ongoing' : 'Ended'}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {style.label} · {formatDay(ev.date)} ({timeAgo(ev.date)})
          {ev.magnitude && ` · ${ev.magnitude.value.toLocaleString()} ${ev.magnitude.unit}`}
          {typeof ev.distanceKm === 'number' && ` · ${Math.round(ev.distanceKm).toLocaleString()} km ${ev.direction ?? ''}`}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button onClick={() => onShow(ev)} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">
            <Satellite className="w-3.5 h-3.5" /> Show on satellite map
          </button>
          <a href={ev.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
            NASA EONET <ExternalLink className="w-3 h-3" />
          </a>
          {ev.sources[0] && (
            <a href={ev.sources[0].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
              Source: {ev.sources[0].id} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
};

export const EventsTab: React.FC<EventsTabProps> = ({ status, data, error, label, onShowOnMap, onRetry }) => {
  const [category, setCategory] = useState<string>('all');
  const [openOnly, setOpenOnly] = useState(false);

  const all = useMemo(() => (data ? [...data.nearby, ...data.elsewhere] : []), [data]);
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach(e => map.set(e.category.id, eventStyle(e.category.id).label));
    return [...map.entries()];
  }, [all]);
  const keep = (e: SpaceEvent) => (category === 'all' || e.category.id === category) && (!openOnly || e.status === 'open');
  const nearby = data?.nearby.filter(keep) ?? [];
  const elsewhere = data?.elsewhere.filter(keep) ?? [];

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Looking for natural events near {label}…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
        {error ?? 'Could not load events.'}{' '}
        <button onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Events detected by NASA and partner agencies (wildfires, storms, volcanoes, floods, sea ice and more) from NASA’s Earth Observatory Natural Event Tracker, within {data?.radiusKm ?? 600} km of {label}.
        Reports can be delayed and are not an official warning.
      </p>

      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Event type">
          {[['all', 'All'] as [string, string], ...categories].map(([id, text]) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${category === id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}
            >
              {text}
            </button>
          ))}
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} className="accent-orange-600" /> Ongoing only
          </label>
        </div>
      )}

      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
          <MapPin className="w-4 h-4 text-orange-600" /> Near {label} <span className="font-normal text-slate-400">({nearby.length})</span>
        </h3>
        {nearby.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No NASA-tracked natural events in the last month within {data?.radiusKm ?? 600} km. That is good news, and it only covers major events.
          </p>
        ) : (
          <ul className="space-y-2">
            {nearby.map(ev => (
              <EventRow key={ev.id} ev={ev} onShow={onShowOnMap} />
            ))}
          </ul>
        )}
      </section>

      {elsewhere.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            Elsewhere on Earth <span className="font-normal text-slate-400">({elsewhere.length})</span>
          </h3>
          <ul className="space-y-2">
            {elsewhere.slice(0, 8).map(ev => (
              <EventRow key={ev.id} ev={ev} onShow={onShowOnMap} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
