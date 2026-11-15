import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { EarthSphere, EarthVariable, RegionHotspot } from '../types';
import {
  NASA_VARIABLES,
  PLANETARY_HOTSPOTS,
  DEMO_CASE_STUDIES,
  makeCustomRegion
} from '../services/earthScienceData';
import { GUIDED_QUESTIONS, GuidedQuestion } from '../services/guidedQuestions';
import { VariableCard } from './VariableCard';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Factory,
  Globe2,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  PlayCircle,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Thermometer,
  Wind,
  type LucideIcon
} from 'lucide-react';
import {
  LOCATION_MESSAGES,
  LocationFailure,
  PlaceResult,
  distanceKm,
  fetchCountryCenter,
  getBrowserPosition,
  placeLabel,
  reversePlace,
  searchPlaces
} from '../services/geocode';
import { formatCoords } from '../services/earthScienceData';
import { EarthNowCard } from './space/EarthNowCard';
import type { QuestionIcon } from '../services/guidedQuestions';

import { bannerClass } from './PageBanner';

const InteractiveEarthGlobe = lazy(() =>
  import('./InteractiveEarthGlobe').then(m => ({ default: m.InteractiveEarthGlobe }))
);

interface DetectiveWizardProps {
  onComplete: (variable: EarthVariable, region: RegionHotspot) => void;
  onSelectCaseStudy: (caseStudyId: string) => void;
  onOpenMap: (variable: EarthVariable) => void;
  onOpenCompare: () => void;
  onStartDemo: () => void;
  /** Variables whose data provider is not configured on this server; shown disabled, never faked. */
  unavailableVariableIds?: Set<string>;
}

const QUESTION_ICONS: Record<QuestionIcon, LucideIcon> = {
  heat: Thermometer,
  rain: CloudRain,
  soil: Sprout,
  air: Wind,
  city: Building2,
  co2: Factory,
  map: MapIcon,
  compare: Scale
};

/** "Where?" helpers: the browser's location (with honest, specific errors) and a place search that always works. */
interface LocatedMeta {
  source: 'device' | 'search';
  /** Reported position accuracy in km (device only). */
  accuracyKm?: number;
}

const PlaceFinder: React.FC<{ onLocated: (place: PlaceResult, meta: LocatedMeta) => void }> = ({ onLocated }) => {
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    setSearchError(null);
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setResults(await searchPlaces(q, controller.signal));
        setSearching(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setResults([]);
        setSearchError((e as Error).message);
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const useMyLocation = async () => {
    setLocating(true);
    setLocationNote(null);
    let pos: { lat: number; lon: number; accuracyMeters: number };
    try {
      pos = await getBrowserPosition();
    } catch (code) {
      setLocationNote({ kind: 'error', text: LOCATION_MESSAGES[code as LocationFailure] ?? LOCATION_MESSAGES.unavailable });
      setLocating(false);
      return;
    }
    const accuracyKm = pos.accuracyMeters ? pos.accuracyMeters / 1000 : undefined;
    setLocationNote({ kind: 'ok', text: 'Position found. Looking up the place name…' });
    let place: PlaceResult;
    try {
      place = await reversePlace(pos.lat, pos.lon);
      setLocationNote(null);
    } catch {
      // Still usable: the data only needs coordinates. Say so honestly.
      place = { name: 'Your location', admin1: null, country: null, lat: pos.lat, lon: pos.lon };
      setLocationNote({ kind: 'error', text: 'Could not look up the place name right now, but your coordinates will still work.' });
    }
    // reverse lookup keeps the device's exact coordinates for the data request
    onLocated({ ...place, lat: pos.lat, lon: pos.lon }, { source: 'device', accuracyKm });
    setLocating(false);
  };

  const pick = (p: PlaceResult) => {
    onLocated(p, { source: 'search' });
    setQuery('');
    setResults([]);
    setLocationNote(null);
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-sm font-medium text-slate-700 disabled:opacity-60 flex-shrink-0"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <LocateFixed className="w-4 h-4 text-blue-600" />}
          {locating ? 'Waiting for your browser…' : 'Use my location'}
        </button>
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Or search any city or place…"
            aria-label="Search for a city or place"
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-2.5" aria-hidden="true" />}
          {(results.length > 0 || (query.trim().length >= 2 && !searching && !searchError)) && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-elevated overflow-hidden" role="listbox" aria-label="Matching places">
              {results.map(p => (
                <li key={`${p.lat}_${p.lon}_${p.name}`} role="option" aria-selected={false}>
                  <button onClick={() => pick(p)} className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-blue-50 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{placeLabel(p)}</span>
                    <span className="ml-auto text-[11px] font-mono text-slate-400 flex-shrink-0">{formatCoords(p.lat, p.lon, 1)}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3.5 py-2 text-sm text-slate-500">No place found. Try a different spelling.</li>}
            </ul>
          )}
        </div>
      </div>
      {locationNote && (
        <p className={`text-xs ${locationNote.kind === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
          {locationNote.text}
        </p>
      )}
      {searchError && (
        <p className="text-xs text-amber-700" role="status">
          {searchError} You can still pick one of the places above or use the Map tab to choose any coordinate.
        </p>
      )}
    </div>
  );
};

const StepBadge: React.FC<{ n: number }> = ({ n }) => (
  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex-shrink-0">
    {n}
  </span>
);

export const DetectiveWizard: React.FC<DetectiveWizardProps> = ({
  onComplete,
  onSelectCaseStudy,
  onOpenMap,
  onOpenCompare,
  onStartDemo,
  unavailableVariableIds
}) => {
  const questions = useMemo(
    () => GUIDED_QUESTIONS.filter(q => !unavailableVariableIds?.has(q.variableId)),
    [unavailableVariableIds]
  );
  const [question, setQuestion] = useState<GuidedQuestion | null>(questions[0] ?? null);
  const [variable, setVariable] = useState<EarthVariable>(
    NASA_VARIABLES.find(v => v.id === (questions[0]?.variableId ?? 't2m')) ?? NASA_VARIABLES[0]
  );
  const [region, setRegion] = useState<RegionHotspot>(
    PLANETARY_HOTSPOTS.find(r => r.id === questions[0]?.suggestedRegionIds[0]) ?? PLANETARY_HOTSPOTS[0]
  );
  const [placeCtx, setPlaceCtx] = useState<{
    place: PlaceResult;
    here: RegionHotspot;
    source: 'device' | 'search';
    accuracyKm?: number;
    country: RegionHotspot | null;
    nearby: { region: RegionHotspot; km: number }[];
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSphere, setSelectedSphere] = useState<EarthSphere | 'All'>('All');

  const kind = question?.kind ?? 'analyze';
  const isGlobal = variable.scope === 'global';
  const needsRegion = kind === 'analyze' && !isGlobal;

  const pickQuestion = (q: GuidedQuestion) => {
    setQuestion(q);
    const v = NASA_VARIABLES.find(item => item.id === q.variableId);
    if (v) setVariable(v);
    const suggested = PLANETARY_HOTSPOTS.find(r => r.id === q.suggestedRegionIds[0]);
    // keep a place the user picked themselves (location / search); otherwise jump to a good example place
    if (suggested && !region.id.startsWith('custom_')) setRegion(suggested);
  };

  const suggestedIds = question?.suggestedRegionIds ?? [];
  const suggestedRegions = suggestedIds
    .map(id => PLANETARY_HOTSPOTS.find(r => r.id === id))
    .filter((r): r is RegionHotspot => !!r);
  const otherRegions = PLANETARY_HOTSPOTS.filter(r => !suggestedIds.includes(r.id));

  const onLocated = (place: PlaceResult, meta: LocatedMeta) => {
    const named = place.name !== 'Your location';
    const here: RegionHotspot = {
      ...makeCustomRegion(place.lat, place.lon, named ? placeLabel(place) : undefined),
      continent: place.continent ?? 'Custom'
    };
    setRegion(here);
    const nearby = PLANETARY_HOTSPOTS.map(r => ({
      region: r,
      km: distanceKm(place.lat, place.lon, r.coordinates.lat, r.coordinates.lon)
    }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
    setPlaceCtx({ place, here, source: meta.source, accuracyKm: meta.accuracyKm, country: null, nearby });
    if (place.countryCode && place.country) {
      const code = place.countryCode;
      fetchCountryCenter(code, place.country).then(c => {
        if (!c) return;
        const countryRegion: RegionHotspot = {
          ...makeCustomRegion(c.lat, c.lon, `${place.country} (country centre)`),
          description: `The grid cell at the geographic centre of ${place.country}. It describes that one spot, not a national average.`,
          continent: place.continent ?? 'Custom'
        };
        setPlaceCtx(prev => (prev && prev.here.id === here.id ? { ...prev, country: countryRegion } : prev));
      });
    }
  };

  const launch = () => {
    if (kind === 'map') onOpenMap(variable);
    else if (kind === 'compare') onOpenCompare();
    else onComplete(variable, region);
  };

  const ctaLabel =
    kind === 'map'
      ? 'Show me the world map'
      : kind === 'compare'
        ? 'Compare two places'
        : 'Show me the answer';

  const spheres: (EarthSphere | 'All')[] = ['All', ...Array.from(new Set(NASA_VARIABLES.map(v => v.sphere)))];
  const filteredVariables = NASA_VARIABLES.filter(v => {
    const q = searchQuery.toLowerCase();
    const matches = !q || v.name.toLowerCase().includes(q) || v.shortCode.toLowerCase().includes(q) || v.definition.toLowerCase().includes(q);
    return (selectedSphere === 'All' || v.sphere === selectedSphere) && matches && !unavailableVariableIds?.has(v.id);
  });

  const regionPill = (r: RegionHotspot, label?: string) => {
    const active = region.id === r.id;
    return (
      <button
        key={r.id}
        onClick={() => setRegion(r)}
        aria-pressed={active}
        className={`px-3.5 py-2 rounded-xl border text-sm text-left transition-all ${
          active
            ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-md'
            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        {label ?? r.name.split('(')[0].trim()}
      </button>
    );
  };

  return (
    <div className="space-y-6 py-2 pb-24">
      {/* Hero */}
      <section className="ep-hero-gradient rounded-2xl border border-blue-200/80 ring-1 ring-inset ring-white/80 p-6 sm:p-8 shadow-card flex flex-col-reverse lg:flex-row lg:items-center gap-6">
        <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/85 border border-emerald-200/90 text-emerald-800 text-xs font-semibold shadow-sm mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Real NASA &amp; NOAA data. Nothing is simulated.
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Is your part of the Earth{' '}
          <span className="bg-gradient-to-r from-nasa-blue via-brand-600 to-sky-700 bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-[CanvasText]">
            changing?
          </span>
        </h1>
        <p className="mt-3 text-base text-slate-700 max-w-2xl leading-relaxed">
          Choose a question. We pull decades of real satellite and station data and tell you <strong>what</strong> is changing,{' '}
          <strong>where</strong>, <strong>by how much</strong>, and whether it is <strong>statistically real</strong>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onStartDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-nasa-blue to-brand-600 hover:from-brand-700 hover:to-brand-600 text-white text-sm font-semibold shadow-md shadow-blue-900/10 transition-all"
          >
            <PlayCircle className="w-4 h-4" /> Take the 60-second guided demo
          </button>
          <span className="text-xs text-slate-600 self-center">Or pick a question below. It takes three clicks.</span>
        </div>
        </div>
        <EarthNowCard />
      </section>

      {/* Step 1 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4" aria-labelledby="step1">
        <div className="flex items-center gap-3">
          <StepBadge n={1} />
          <h2 id="step1" className="text-lg font-bold text-slate-900">
            What do you want to know?
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-labelledby="step1">
          {questions.map(q => {
            const active = question?.id === q.id;
            return (
              <button
                key={q.id}
                role="radio"
                aria-checked={active}
                onClick={() => pickQuestion(q)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-md'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300'
                }`}
              >
                {(() => {
                  const Icon = QUESTION_ICONS[q.icon];
                  return (
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </span>
                  );
                })()}
                <div className="mt-1.5 font-bold text-slate-900 text-sm leading-snug">{q.text}</div>
                <div className="mt-1 text-[11px] text-slate-500 leading-snug">{q.how}</div>
              </button>
            );
          })}
        </div>
        {question && question.variableId !== variable.id && (
          <p className="text-xs text-slate-500">Custom variable selected: {variable.name}.</p>
        )}
      </section>

      {/* Step 2 */}
      {needsRegion && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4" aria-labelledby="step2">
          <div className="flex items-center gap-3">
            <StepBadge n={2} />
            <h2 id="step2" className="text-lg font-bold text-slate-900">
              Where?
            </h2>
          </div>
          <PlaceFinder onLocated={onLocated} />

          {placeCtx && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3" aria-label="Your location">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white flex-shrink-0" aria-hidden="true">
                  <MapPin className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-blue-700">
                    {placeCtx.source === 'device' ? 'Your location' : 'Chosen place'}
                  </div>
                  <div className="text-base font-bold text-slate-900 leading-snug">
                    {placeCtx.place.name === 'Your location' ? formatCoords(placeCtx.place.lat, placeCtx.place.lon, 2) : placeLabel(placeCtx.place)}
                  </div>
                  <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-slate-600">
                    <div className="flex gap-1">
                      <dt className="text-slate-400">Coordinates</dt>
                      <dd className="font-mono">{formatCoords(placeCtx.place.lat, placeCtx.place.lon, 2)}</dd>
                    </div>
                    {placeCtx.place.country && (
                      <div className="flex gap-1">
                        <dt className="text-slate-400">Country</dt>
                        <dd>{placeCtx.place.country}</dd>
                      </div>
                    )}
                    {placeCtx.place.continent && (
                      <div className="flex gap-1">
                        <dt className="text-slate-400">Continent</dt>
                        <dd>{placeCtx.place.continent}</dd>
                      </div>
                    )}
                    {placeCtx.accuracyKm !== undefined && (
                      <div className="flex gap-1">
                        <dt className="text-slate-400">Accuracy</dt>
                        <dd>about {placeCtx.accuracyKm < 1 ? '<1' : Math.round(placeCtx.accuracyKm)} km</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
              {placeCtx.accuracyKm !== undefined && placeCtx.accuracyKm > 25 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
                  Your browser only gave an approximate position (Wi-Fi or network based, within about {Math.round(placeCtx.accuracyKm)} km), so the place name could be a
                  neighbouring city. If it is not right, search for your city above.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="w-full text-[11px] uppercase tracking-wide font-semibold text-slate-400">Choose the scale</span>
                {regionPill(placeCtx.here, placeCtx.place.name === 'Your location' ? 'This location' : `${placeCtx.place.name} (local)`)}
                {placeCtx.country ? (
                  regionPill(placeCtx.country, `${placeCtx.place.country} (country centre)`)
                ) : placeCtx.place.country ? (
                  <span className="px-3.5 py-2 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {placeCtx.place.country}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="w-full text-[11px] uppercase tracking-wide font-semibold text-slate-400">Well-studied regions near you</span>
                {placeCtx.nearby.map(n => (
                  <span key={n.region.id} className="inline-flex items-center gap-1.5">
                    {regionPill(n.region)}
                    <span className="text-[11px] text-slate-400 font-mono -ml-1 mr-1">{Math.round(n.km).toLocaleString()} km</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {suggestedRegions.length > 0 && <span className="w-full text-[11px] uppercase tracking-wide font-semibold text-slate-400">Interesting places for this question</span>}
            {suggestedRegions.map(r => regionPill(r))}
          </div>
          <details className="group">
            <summary className="text-sm font-semibold text-blue-700 cursor-pointer select-none flex items-center gap-1 list-none">
              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" /> More places
            </summary>
            <div className="flex flex-wrap gap-2 mt-3">{otherRegions.map(r => regionPill(r))}</div>
          </details>
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Selected: <strong className="text-slate-700">{region.name}</strong>
            <span className="font-mono text-slate-400">({formatCoords(region.coordinates.lat, region.coordinates.lon, 2)})</span>
          </p>
          {region.description && <p className="text-xs text-slate-500 -mt-1">{region.description}</p>}
        </section>
      )}

      {/* Step 3 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-50 to-white border border-brand-200 text-slate-900 p-5 sm:p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StepBadge n={needsRegion ? 3 : 2} />
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-700">Your answer</span>
          </div>
          <div className="mt-2 text-lg font-bold leading-snug">
            {kind === 'map' && `Map where ${variable.name} is changing across the world's land`}
            {kind === 'compare' && 'Put two regions side by side and see who is changing, and who is not'}
            {kind === 'analyze' && (
              <>
                Analyze <span className="text-blue-700">{variable.name}</span>
                {needsRegion ? (
                  <>
                    {' '}
                    in <span className="text-emerald-700">{region.name.split('(')[0].trim()}</span>
                  </>
                ) : (
                  ' (worldwide record)'
                )}
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Mann–Kendall trend test with autocorrelation correction, Sen&apos;s slope with confidence interval, change-point check.</p>
        </div>
        <button
          onClick={launch}
          className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md transition-all active:scale-95"
        >
          {ctaLabel} <ArrowRight className="w-5 h-5" />
        </button>
      </section>

      {/* Verified stories */}
      <section className="space-y-3" aria-labelledby="stories">
        <h2 id="stories" className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-amber-500" /> Or start from a verified story
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_CASE_STUDIES.map(cs => (
            <button
              key={cs.id}
              onClick={() => onSelectCaseStudy(cs.id)}
              className="group text-left rounded-xl bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-400 p-4 transition-all shadow-sm hover:shadow-md"
            >
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">{cs.badge}</span>
              <h3 className="mt-2 font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">{cs.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cs.subtitle}</p>
              <span className="mt-2 inline-flex items-center text-[11px] font-semibold text-blue-600">
                Open story <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Advanced: all variables */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-card">
        <button
          onClick={() => setShowAdvanced(s => !s)}
          aria-expanded={showAdvanced}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div>
            <div className="font-bold text-slate-900">Browse all {NASA_VARIABLES.filter(v => !unavailableVariableIds?.has(v.id)).length} variables</div>
            <div className="text-xs text-slate-500">For researchers: pick any variable instead of a question.</div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search variables…"
                  aria-label="Search variables"
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                {spheres.map(sphere => (
                  <button
                    key={sphere}
                    onClick={() => setSelectedSphere(sphere)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedSphere === sphere ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sphere}
                  </button>
                ))}
              </div>
            </div>
            {unavailableVariableIds && unavailableVariableIds.size > 0 && (
              <p className="text-[11px] text-slate-500">
                {unavailableVariableIds.size} variable(s) are hidden because their data provider is not available on this server.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredVariables.map(v => (
                <VariableCard
                  key={v.id}
                  variable={v}
                  isSelected={variable.id === v.id}
                  onSelect={() => {
                    setVariable(v);
                    setQuestion(q => (q && q.kind === 'analyze' ? q : GUIDED_QUESTIONS[0]));
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Selected: <strong>{variable.name}</strong>. Choose a region above (step 2) and press the button to analyze it.
            </p>
          </div>
        )}
      </section>

      {/* Optional 3D globe (lazy) */}
      <section className={`${bannerClass('sky')} rounded-2xl`}>
        <button
          onClick={() => setShowGlobe(s => !s)}
          aria-expanded={showGlobe}
          className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex flex-shrink-0 w-12 h-12 rounded-2xl bg-white/85 ring-1 ring-white shadow-sm items-center justify-center text-sky-700">
              <Globe2 className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-sky-700">NASA GIBS · 3D</div>
              <div className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Explore on a <span className="ep-banner-accent">3D globe</span>
              </div>
              <div className="mt-1 text-sm text-slate-700">Real NASA satellite imagery by day. Click a hotspot to select it.</div>
            </div>
          </div>
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white/85 ring-1 ring-white shadow-sm flex items-center justify-center">
            <ChevronDown className={`w-5 h-5 text-sky-700 transition-transform ${showGlobe ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {showGlobe && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-slate-500">Loading globe…</div>}>
              <InteractiveEarthGlobe
                selectedRegion={region}
                onSelectRegion={setRegion}
                selectedVariable={variable}
                onLaunchLab={launch}
                onCoordinatePicked={() => {}}
              />
            </Suspense>
          </div>
        )}
      </section>
    </div>
  );
};
