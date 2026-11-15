import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronLeft, ChevronRight, ExternalLink, Flame, Loader2, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import {
  addDays,
  BestResponse,
  clampDate,
  fetchBest,
  formatDay,
  ImageryLayer,
  LayersResponse,
  SpaceEvent,
  worldviewUrl
} from '../../services/earthView';
import { eventStyle } from './eventStyle';

export interface MapFocus {
  lat: number;
  lon: number;
  zoom?: number;
  nonce: number;
}

interface LiveViewTabProps {
  layers: LayersResponse;
  lat: number;
  lon: number;
  label: string;
  initialLayerKey: string;
  events: SpaceEvent[];
  focus: MapFocus | null;
  onPick: (lat: number, lon: number) => void;
  onOpenEvents: () => void;
}

const SHORT: Record<string, string> = {
  terra: 'Terra (morning)',
  aqua: 'Aqua (afternoon)',
  noaa20: 'NOAA-20',
  lst: 'Heat of the ground',
  aerosol: 'Air pollution',
  no2: 'Nitrogen dioxide',
  rain: 'Rainfall',
  ndvi: 'Greenness',
  night: 'Lights at night'
};

const cloudTone = (pct: number) => (pct <= 25 ? 'bg-emerald-500' : pct <= 60 ? 'bg-amber-500' : 'bg-rose-500');

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; title?: string }> = ({ active, onClick, children, title }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    title={title}
    className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
      active ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
    }`}
  >
    {children}
  </button>
);

export const LiveViewTab: React.FC<LiveViewTabProps> = ({ layers, lat, lon, label, initialLayerKey, events, focus, onPick, onOpenEvents }) => {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataLayerRef = useRef<L.TileLayer | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const eventGroupRef = useRef<L.LayerGroup | null>(null);
  const skipFlyRef = useRef(false);
  const lastPlaceRef = useRef({ lat, lon });
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const userPickedDate = useRef(false);

  const initial = layers.layers.find(l => l.key === initialLayerKey) ?? layers.layers[0];
  const [layerKey, setLayerKey] = useState(initial.key);
  const layer: ImageryLayer = layers.layers.find(l => l.key === layerKey) ?? initial;
  const [date, setDate] = useState(() => clampDate(addDays(initial.end, -1), initial));
  const dateRef = useRef(date);
  dateRef.current = date;
  const appliedDate = useRef(date);
  const [opacity, setOpacity] = useState(0.8);
  const [showEvents, setShowEvents] = useState(true);
  const [best, setBest] = useState<BestResponse | null>(null);
  const [loadingTiles, setLoadingTiles] = useState(true);
  const [missingTiles, setMissingTiles] = useState(0);

  // ---- map creation (once) -----------------------------------------------------------------------
  useEffect(() => {
    if (!mapEl.current) return;
    const map = L.map(mapEl.current, {
      center: [lat, lon],
      zoom: 8,
      minZoom: 2,
      maxZoom: 12,
      worldCopyJump: true,
      attributionControl: false,
      zoomControl: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution('Imagery: NASA EOSDIS GIBS / Worldview').addTo(map);
    L.tileLayer(layers.base.template, { maxNativeZoom: layers.base.maxZoom, maxZoom: 12, zIndex: 1 }).addTo(map);
    map.createPane('labels').style.zIndex = '450';
    map.getPane('labels')!.style.pointerEvents = 'none';
    // GIBS serves some empty label tiles as opaque black; "screen" keeps the white text and drops the black.
    map.getPane('labels')!.style.mixBlendMode = 'screen';
    L.tileLayer(layers.labels.template, { maxNativeZoom: layers.labels.maxZoom, maxZoom: 12, pane: 'labels', opacity: 0.9 }).addTo(map);

    pinRef.current = L.marker([lat, lon], {
      icon: L.divIcon({ className: 'ep-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
      interactive: false,
      keyboard: false
    }).addTo(map);
    eventGroupRef.current = L.layerGroup().addTo(map);

    map.on('click', e => {
      skipFlyRef.current = true;
      onPickRef.current(Number(e.latlng.lat.toFixed(3)), Number((((e.latlng.lng + 540) % 360) - 180).toFixed(3)));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      dataLayerRef.current = null;
    };
    // the map is created exactly once; later changes are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- data layer: replace when the layer changes ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dataLayerRef.current?.remove();
    setMissingTiles(0);
    appliedDate.current = dateRef.current;
    const url = layer.tileTemplate.replace('{time}', dateRef.current);
    const tl = L.tileLayer(url, {
      maxNativeZoom: layer.maxZoom,
      maxZoom: 12,
      zIndex: 2,
      opacity: layer.group === 'photo' ? 1 : opacity,
      attribution: `${layer.sensor}`
    });
    tl.on('loading', () => setLoadingTiles(true));
    tl.on('load', () => setLoadingTiles(false));
    tl.on('tileerror', () => setMissingTiles(n => n + 1));
    tl.addTo(map);
    dataLayerRef.current = tl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.key]);

  // ---- date change: swap the tile URL in place -------------------------------------------------------
  useEffect(() => {
    const tl = dataLayerRef.current;
    if (!tl || layer.fixedTime || appliedDate.current === date) return;
    appliedDate.current = date;
    setMissingTiles(0);
    setLoadingTiles(true);
    tl.setUrl(layer.tileTemplate.replace('{time}', date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (layer.group !== 'photo') dataLayerRef.current?.setOpacity(opacity);
  }, [opacity, layer.group, layer.key]);

  // ---- the place marker, and flying to a newly chosen place -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinRef.current?.setLatLng([lat, lon]);
    const moved = lastPlaceRef.current.lat !== lat || lastPlaceRef.current.lon !== lon;
    lastPlaceRef.current = { lat, lon };
    if (moved && !skipFlyRef.current) map.flyTo([lat, lon], Math.max(map.getZoom(), 7), { duration: 1.2 });
    skipFlyRef.current = false;
  }, [lat, lon]);

  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.flyTo([focus.lat, focus.lon], focus.zoom ?? 9, { duration: 1 });
  }, [focus]);

  // ---- natural-event markers ----------------------------------------------------------------------------
  useEffect(() => {
    const group = eventGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showEvents) return;
    for (const ev of events) {
      const style = eventStyle(ev.category.id);
      const marker = L.circleMarker([ev.lat, ev.lon], {
        radius: ev.status === 'open' ? 8 : 6,
        color: '#ffffff',
        weight: 2,
        fillColor: style.color,
        fillOpacity: ev.status === 'open' ? 0.95 : 0.55
      });
      const box = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = ev.title;
      const meta = document.createElement('div');
      meta.textContent = `${style.label} · ${ev.status === 'open' ? 'ongoing' : 'ended'} · ${formatDay(ev.date)}`;
      meta.style.fontSize = '12px';
      box.append(title, meta);
      marker.bindPopup(box);
      marker.addTo(group);
    }
  }, [events, showEvents]);

  // ---- clearest recent day (natural-colour layers only) -------------------------------------------
  useEffect(() => {
    userPickedDate.current = false;
    if (layer.group !== 'photo') {
      setBest(null);
      return;
    }
    let active = true;
    setBest(null);
    fetchBest(layer.key, lat, lon, { days: 7 })
      .then(r => {
        if (!active) return;
        setBest(r);
        if (!userPickedDate.current && r.best) setDate(r.best.date);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [layer.key, lat, lon, layer.group]);

  const chooseLayer = (key: string) => {
    const next = layers.layers.find(l => l.key === key);
    if (!next || next.key === layerKey) return;
    setDate(d => clampDate(d, next));
    setLayerKey(key);
  };
  const pickDate = (d: string) => {
    userPickedDate.current = true;
    setDate(clampDate(d, layer));
  };

  const photoLayers = layers.layers.filter(l => l.group === 'photo');
  const dataLayers = layers.layers.filter(l => l.group !== 'photo');
  const candidates = best?.candidates ?? [];
  const wv = worldviewUrl(layer.id, lat, lon, layer.fixedTime ?? date);

  return (
    <div className="space-y-3">
      {/* Layer chooser */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Satellite pictures">
          <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Pictures</span>
          {photoLayers.map(l => (
            <Chip key={l.key} active={layerKey === l.key} onClick={() => chooseLayer(l.key)} title={l.description}>
              {SHORT[l.key] ?? l.label}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Data layers">
          <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Data</span>
          {dataLayers.map(l => (
            <Chip key={l.key} active={layerKey === l.key} onClick={() => chooseLayer(l.key)} title={l.description}>
              {SHORT[l.key] ?? l.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Date controls */}
      {!layer.fixedTime && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => pickDate(addDays(date, -1))}
              disabled={date <= layer.start}
              className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={date}
              min={layer.start}
              max={layer.end}
              onChange={e => e.target.value && pickDate(e.target.value)}
              aria-label="Date of the satellite picture"
              className="bg-transparent text-sm font-semibold text-slate-800 px-1 py-1.5 focus:outline-none"
            />
            <button
              onClick={() => pickDate(addDays(date, 1))}
              disabled={date >= layer.end}
              className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => pickDate(layer.end)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-400"
          >
            Newest
          </button>
          <span className="text-[11px] text-slate-400">
            {formatDay(layer.start)} to {formatDay(layer.end)}
          </span>
          {layer.group !== 'photo' && (
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Layer strength
              <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} aria-label="Layer strength" className="w-24 accent-blue-600" />
            </label>
          )}
        </div>
      )}

      {/* Clearest recent days */}
      {layer.group === 'photo' && candidates.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
            Last 7 days at this place <span className="normal-case font-normal">(estimated cloud cover)</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {candidates.map(c => {
              const unusable = c.noDataPct > 25;
              return (
                <button
                  key={c.date}
                  onClick={() => pickDate(c.date)}
                  aria-pressed={date === c.date}
                  disabled={unusable}
                  title={unusable ? 'The satellite has not covered this place yet' : `About ${c.cloudPct}% cloud`}
                  className={`flex-shrink-0 w-[76px] rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    date === c.date ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-400'
                  } ${unusable ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="text-[11px] font-semibold text-slate-800">
                    {new Date(`${c.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${cloudTone(c.cloudPct)}`} style={{ width: `${unusable ? 0 : Math.max(6, c.cloudPct)}%` }} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{unusable ? 'no pass yet' : `${c.cloudPct}% cloud`}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
        <div ref={mapEl} className="h-[380px] sm:h-[500px] w-full" role="application" aria-label={`Interactive satellite map of ${label}, ${layer.label}, ${layer.fixedTime ?? date}. Click to choose another place.`} />
        {loadingTiles && (
          <div className="absolute top-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Loading imagery…
          </div>
        )}
        {events.length > 0 && (
          <label className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow cursor-pointer">
            <input type="checkbox" checked={showEvents} onChange={e => setShowEvents(e.target.checked)} className="accent-orange-600" />
            <Flame className="w-3.5 h-3.5 text-orange-600" /> Natural events ({events.length})
          </label>
        )}
        {layer.group === 'science' && layer.ramp && (
          <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 shadow w-52">
            <div className="text-[11px] font-semibold text-slate-700 leading-tight">{layer.label}</div>
            <div className="mt-1 h-2.5 rounded-full" style={{ background: `linear-gradient(to right, ${layer.ramp.join(',')})` }} aria-hidden="true" />
            <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
              <span>{layer.rampLow}</span>
              <span>{layer.rampHigh}</span>
            </div>
          </div>
        )}
      </div>

      {missingTiles > 0 && !loadingTiles && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
          <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" />
          Part of the map has no picture for {formatDay(layer.fixedTime ?? date)}. The satellite may not have passed over, or the data may not be published yet. Try an earlier day.
        </p>
      )}

      {/* Caption: provenance, always visible */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">{layer.label}</strong>
        {' · '}
        {layer.sensor} · {layer.resolution} per pixel · {layer.fixedTime ? `composite from ${layer.fixedTime.slice(0, 4)}` : formatDay(date)}
        <br />
        {layer.description}{' '}
        <a href={wv} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">
          Open in NASA Worldview <ExternalLink className="w-3 h-3" />
        </a>
        {events.length > 0 && (
          <button onClick={onOpenEvents} className="ml-2 font-semibold text-orange-700 hover:text-orange-900">
            See the events list →
          </button>
        )}
      </div>
    </div>
  );
};
