import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Clapperboard, Crosshair, Images, Loader2, LocateFixed, MapPin, Newspaper, Satellite, Search, TriangleAlert, SplitSquareHorizontal } from 'lucide-react';
import { EarthVariable, RegionHotspot } from '../../types';
import { formatCoords, PLANETARY_HOTSPOTS } from '../../services/earthScienceData';
import { getBrowserPosition, LOCATION_MESSAGES, LocationFailure, placeLabel, PlaceResult, reversePlace, searchPlaces } from '../../services/geocode';
import { EventsResponse, fetchEvents, fetchLayers, LayersResponse, SpaceEvent } from '../../services/earthView';
import { LiveViewTab, MapFocus } from './LiveViewTab';
import { BeforeAfter } from './BeforeAfter';
import { TimeLapse } from './TimeLapse';
import { EventsTab } from './EventsTab';
import { MediaTab } from './MediaTab';

interface PlaceExplorerProps {
  variable: EarthVariable;
  selectedRegion: RegionHotspot;
  onAnalyze: (lat: number, lon: number, label?: string) => void;
}

type TabId = 'live' | 'change' | 'events' | 'media';

interface Place {
  lat: number;
  lon: number;
  label: string;
  name: string | null;
  admin1: string | null;
  country: string | null;
  resolving: boolean;
}

const isCustom = (r: RegionHotspot) => r.id.startsWith('custom_');

const initialPlace = (r: RegionHotspot): Place => ({
  lat: r.coordinates.lat,
  lon: r.coordinates.lon,
  label: isCustom(r) && r.name.startsWith('Custom location') ? formatCoords(r.coordinates.lat, r.coordinates.lon, 2) : r.name,
  name: isCustom(r) && r.name.startsWith('Custom location') ? null : r.name,
  admin1: null,
  country: null,
  resolving: isCustom(r) && r.name.startsWith('Custom location')
});

export const PlaceExplorer: React.FC<PlaceExplorerProps> = ({ variable: _variable, selectedRegion, onAnalyze }) => {
  const [place, setPlace] = useState<Place>(() => initialPlace(selectedRegion));
  const [tab, setTab] = useState<TabId>('live');
  const [layers, setLayers] = useState<LayersResponse | null>(null);
  const [layersError, setLayersError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [eventsStatus, setEventsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsAttempt, setEventsAttempt] = useState(0);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [changeView, setChangeView] = useState<'slider' | 'film'>('slider');

  // search + locate
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const searchRef = useRef<AbortController | null>(null);

  const [layerAttempt, setLayerAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLayersError(null);
    fetchLayers()
      .then(l => active && setLayers(l))
      .catch(e => active && setLayersError((e as Error).message));
    return () => {
      active = false;
    };
  }, [layerAttempt]);

  // events follow the place
  useEffect(() => {
    const ctrl = new AbortController();
    setEventsStatus('loading');
    fetchEvents(place.lat, place.lon, 600, ctrl.signal)
      .then(r => {
        setEvents(r);
        setEventsStatus('ready');
      })
      .catch(e => {
        if (e.name === 'AbortError') return;
        setEventsError((e as Error).message);
        setEventsStatus('error');
      });
    return () => ctrl.abort();
  }, [place.lat, place.lon, eventsAttempt]);

  // name a clicked point
  useEffect(() => {
    if (!place.resolving) return;
    const ctrl = new AbortController();
    const { lat, lon } = place;
    reversePlace(lat, lon, ctrl.signal)
      .then(p =>
        setPlace(prev =>
          prev.lat === lat && prev.lon === lon
            ? {
                ...prev,
                resolving: false,
                label: p.name === 'Your location' ? formatCoords(lat, lon, 2) : placeLabel(p),
                name: p.name === 'Your location' ? null : p.name,
                admin1: p.admin1,
                country: p.country
              }
            : prev
        )
      )
      .catch(e => e.name !== 'AbortError' && setPlace(prev => (prev.lat === lat && prev.lon === lon ? { ...prev, resolving: false } : prev)));
    return () => ctrl.abort();
  }, [place.lat, place.lon, place.resolving]);

  const pickPoint = useCallback((lat: number, lon: number) => {
    setPlace({ lat, lon, label: formatCoords(lat, lon, 2), name: null, admin1: null, country: null, resolving: true });
    setMessage(null);
  }, []);

  const pickNamed = (p: PlaceResult) => {
    setPlace({ lat: p.lat, lon: p.lon, label: placeLabel(p), name: p.name, admin1: p.admin1, country: p.country, resolving: false });
    setResults(null);
    setQuery('');
    setMessage(null);
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    searchRef.current?.abort();
    const ctrl = new AbortController();
    searchRef.current = ctrl;
    setSearching(true);
    setMessage(null);
    try {
      const found = await searchPlaces(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults(found);
      if (found.length === 0) setMessage(`No place found for “${q}”. Check the spelling or try a larger nearby city.`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setMessage((err as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    setMessage(null);
    try {
      const pos = await getBrowserPosition();
      pickPoint(Number(pos.lat.toFixed(3)), Number(pos.lon.toFixed(3)));
    } catch (err) {
      const code = err as LocationFailure;
      setMessage(LOCATION_MESSAGES[code] ?? 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const allEvents: SpaceEvent[] = useMemo(() => (events ? [...events.nearby, ...events.elsewhere.slice(0, 40)] : []), [events]);
  const nearbyCount = events?.nearby.length ?? 0;

  const showEventOnMap = (ev: SpaceEvent) => {
    setFocus({ lat: ev.lat, lon: ev.lon, zoom: 8, nonce: Date.now() });
    setTab('live');
  };

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'live', label: 'Satellite', icon: Satellite },
    { id: 'change', label: 'Change', icon: SplitSquareHorizontal },
    { id: 'events', label: 'Events', icon: Newspaper, badge: eventsStatus === 'ready' ? nearbyCount : undefined },
    { id: 'media', label: 'NASA media', icon: Images }
  ];

  return (
    <div className="space-y-4">
      {/* Place header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[14rem] flex-1">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <MapPin className="w-3.5 h-3.5" /> Exploring
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug break-words">
              {place.label}
              {place.resolving && <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin text-slate-400" aria-label="Looking up place name" />}
            </h2>
            <div className="text-xs text-slate-500 font-mono">{formatCoords(place.lat, place.lon, 3)}</div>
          </div>
          <button
            onClick={() => onAnalyze(place.lat, place.lon, place.name ? place.label : undefined)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm"
          >
            <BarChart3 className="w-4 h-4" /> Analyze long-term change here
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={runSearch} className="relative flex-1" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (!e.target.value) setResults(null);
              }}
              placeholder="Search any city or place, then press Enter"
              aria-label="Search a place"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
            {results && results.length > 0 && (
              <ul className="absolute z-[700] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" role="listbox">
                {results.slice(0, 6).map((r, i) => (
                  <li key={`${r.lat}-${r.lon}-${i}`}>
                    <button type="button" onClick={() => pickNamed(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{placeLabel(r)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <button
            onClick={locate}
            disabled={locating}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-400 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-blue-600" />} My location
          </button>
          <select
            value=""
            onChange={e => {
              const r = PLANETARY_HOTSPOTS.find(h => h.id === e.target.value);
              if (r) {
                setPlace({ lat: r.coordinates.lat, lon: r.coordinates.lon, label: r.name, name: r.name, admin1: null, country: null, resolving: false });
                setMessage(null);
              }
            }}
            aria-label="Famous places"
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">Famous places…</option>
            {PLANETARY_HOTSPOTS.map(h => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        {message && (
          <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" /> {message}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Crosshair className="w-3 h-3" /> You can also click anywhere on the satellite map to explore that spot.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200" role="tablist" aria-label="Place views">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.badge ? <span className="text-[10px] font-bold rounded-full bg-orange-100 text-orange-800 px-1.5 py-0.5">{t.badge}</span> : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {layersError && (tab === 'live' || tab === 'change') ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
            Could not reach NASA’s imagery service: {layersError}{' '}
            <button onClick={() => setLayerAttempt(a => a + 1)} className="font-semibold underline">
              Try again
            </button>
          </div>
        ) : !layers && (tab === 'live' || tab === 'change') ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Connecting to NASA imagery…
          </div>
        ) : null}

        {layers && tab === 'live' && (
          <LiveViewTab
            layers={layers}
            lat={place.lat}
            lon={place.lon}
            label={place.label}
            initialLayerKey="terra"
            events={allEvents}
            focus={focus}
            onPick={pickPoint}
            onOpenEvents={() => setTab('events')}
          />
        )}
        {layers && tab === 'change' && (
          <div className="space-y-3">
            <div className="inline-flex rounded-xl bg-slate-100 border border-slate-200 p-1" role="group" aria-label="Change view">
              {([
                ['slider', 'Then vs now', SplitSquareHorizontal],
                ['film', 'Time-lapse', Clapperboard]
              ] as const).map(([id, text, Icon]) => (
                <button
                  key={id}
                  onClick={() => setChangeView(id)}
                  aria-pressed={changeView === id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${changeView === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {text}
                </button>
              ))}
            </div>
            {changeView === 'slider' ? (
              <BeforeAfter layers={layers} lat={place.lat} lon={place.lon} label={place.label} onAnalyze={() => onAnalyze(place.lat, place.lon, place.name ? place.label : undefined)} />
            ) : (
              <TimeLapse layers={layers} lat={place.lat} lon={place.lon} label={place.label} />
            )}
          </div>
        )}
        {tab === 'events' && (
          <EventsTab status={eventsStatus} data={events} error={eventsError} label={place.label} onShowOnMap={showEventOnMap} onRetry={() => setEventsAttempt(a => a + 1)} />
        )}
        {tab === 'media' && <MediaTab name={place.name} admin1={place.admin1} country={place.country} label={place.label} />}
      </div>
    </div>
  );
};
