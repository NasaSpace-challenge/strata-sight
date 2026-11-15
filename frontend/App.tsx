import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { EarthVariable, RegionHotspot, BaselinePeriod, AnomalyDisplayMode } from './types';
import { NASA_VARIABLES, PLANETARY_HOTSPOTS, DEMO_CASE_STUDIES, makeCustomRegion } from './services/earthScienceData';
import { fetchProviderStatus } from './services/liveEarthDataService';
import {
  processMonthlyTimeSeries,
  decomposeTimeSeries,
  calculateBivariateLeadLag
} from './services/statisticsEngine';
import { detectCompoundHotDryEvents } from './services/climateIndicesData';
import { detectMarineHeatwaves, calculateSpectralAndWaveletAnalysis } from './services/tippingAndSpectralEngine';
import { alignByDate, useRealSeries, useRealSeriesBundle } from './hooks/useRealSeries';
import { Header, TabId } from './components/Header';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { StatisticalSummaryCard } from './components/StatisticalSummaryCard';
import { VerdictCard } from './components/VerdictCard';
import type { MapMode } from './components/MapWorkspace';
import { VariableCard } from './components/VariableCard';
import { TabBanner } from './components/TabBanner';
import { SeeFromSpaceCard } from './components/space/SeeFromSpaceCard';
import { AiAssistantProvider, useAiAssistant, useRegisterAiContext, useSuspendAiAssistant } from './components/ai/AiAssistantContext';
import { AiAssistantUi, useAiDocked } from './components/ai/AiAssistantUi';
import { GuidedDemo, DemoStep } from './components/GuidedDemo';
import { ProvenanceStrip, SeriesErrorCard, SeriesLoading } from './components/DataStatus';
import { FileText, Compass, Sparkles } from 'lucide-react';

// Heavy / secondary views are loaded on demand so the first paint stays fast.
const DetectiveWizard = lazy(() => import('./components/DetectiveWizard').then(m => ({ default: m.DetectiveWizard })));
const DualRegionParadoxView = lazy(() => import('./components/DualRegionParadoxView').then(m => ({ default: m.DualRegionParadoxView })));
const MultiAgencyLiveLab = lazy(() => import('./components/MultiAgencyLiveLab').then(m => ({ default: m.MultiAgencyLiveLab })));
const ScienceGuideView = lazy(() => import('./components/ScienceGuideView').then(m => ({ default: m.ScienceGuideView })));
const DecompositionView = lazy(() => import('./components/DecompositionView').then(m => ({ default: m.DecompositionView })));
const BivariateAnalysisLab = lazy(() => import('./components/BivariateAnalysisLab').then(m => ({ default: m.BivariateAnalysisLab })));
const MapWorkspace = lazy(() => import('./components/MapWorkspace').then(m => ({ default: m.MapWorkspace })));
const ClimateTeleconnectionsLab = lazy(() => import('./components/ClimateTeleconnectionsLab').then(m => ({ default: m.ClimateTeleconnectionsLab })));
const CompoundEventsLab = lazy(() => import('./components/CompoundEventsLab').then(m => ({ default: m.CompoundEventsLab })));
const MarineHeatwaveLab = lazy(() => import('./components/MarineHeatwaveLab').then(m => ({ default: m.MarineHeatwaveLab })));
const SpectralWaveletLab = lazy(() => import('./components/SpectralWaveletLab').then(m => ({ default: m.SpectralWaveletLab })));
const ExecutiveSummaryModal = lazy(() => import('./components/ExecutiveSummaryModal').then(m => ({ default: m.ExecutiveSummaryModal })));

const TABS_WITHOUT_PRIMARY_SERIES: TabId[] = ['paradox', 'multiagency', 'about', 'map'];
const COMPOUND_VARIABLES = ['t2m', 'soil_wetness', 'precip_merra2'];

const ViewFallback: React.FC = () => <SeriesLoading label="Loading view…" />;

function formatSigned(v: number): string {
  const a = Math.abs(v);
  const t = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : Number(a.toPrecision(2)).toString();
  return `${v < 0 ? '−' : '+'}${t}`;
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<TabId>('detective');
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('trend');
  const [paradoxCaseId, setParadoxCaseId] = useState<string | undefined>(undefined);

  const defaultVariable = NASA_VARIABLES.find(v => v.id === 't2m') || NASA_VARIABLES[0];
  const [selectedVariable, setSelectedVariable] = useState<EarthVariable>(defaultVariable);
  const [selectedSecondaryVariable, setSelectedSecondaryVariable] = useState<EarthVariable>(
    NASA_VARIABLES.find(v => v.id === 'soil_wetness') || NASA_VARIABLES[1]
  );
  const [selectedRegion, setSelectedRegion] = useState<RegionHotspot>(PLANETARY_HOTSPOTS[0]);
  const [customCoordinates, setCustomCoordinates] = useState<{ lat: number; lon: number }>(
    PLANETARY_HOTSPOTS[0].coordinates
  );
  const [plainEnglish, setPlainEnglish] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('stratasight.plainEnglish') ?? localStorage.getItem('earthpulse.plainEnglish');
      return v !== 'false';
    } catch {
      return true;
    }
  });
  const [showFullStats, setShowFullStats] = useState(false);
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const ai = useAiAssistant();
  const aiDocked = useAiDocked();
  const handleTogglePlain = (plain: boolean) => {
    setPlainEnglish(plain);
    try {
      localStorage.setItem('stratasight.plainEnglish', String(plain));
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  };
  const [baseline, setBaseline] = useState<BaselinePeriod>('1991-2020');
  const [anomalyMode, setAnomalyMode] = useState<AnomalyDisplayMode>('PHYSICAL');

  // Which variables can this server actually deliver right now?
  const [unavailableVariableIds, setUnavailableVariableIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    fetchProviderStatus().then(status => {
      if (!active || !status) return;
      setUnavailableVariableIds(new Set(status.variables.filter(v => !v.available).map(v => v.id)));
    });
    return () => {
      active = false;
    };
  }, []);
  const availableVariables = useMemo(
    () => NASA_VARIABLES.filter(v => !unavailableVariableIds.has(v.id)),
    [unavailableVariableIds]
  );

  const { lat, lon } = customCoordinates;

  // ---- REAL data: primary series -------------------------------------------------------------
  const primary = useRealSeries(
    selectedVariable.id,
    lat,
    lon,
    !TABS_WITHOUT_PRIMARY_SERIES.includes(activeTab)
  );

  const processed = useMemo(
    () =>
      primary.data
        ? processMonthlyTimeSeries(primary.data.dates, primary.data.values, selectedVariable.unit, baseline)
        : null,
    [primary.data, selectedVariable.unit, baseline]
  );

  // ---- Engines run ONLY for the tab that needs them ---------------------------------------------
  const decomposition = useMemo(
    () =>
      activeTab === 'decomposition' && primary.data
        ? decomposeTimeSeries(primary.data.dates, primary.data.values)
        : null,
    [activeTab, primary.data]
  );

  const spectralAnalysis = useMemo(
    () => (activeTab === 'spectral' && processed ? calculateSpectralAndWaveletAnalysis(processed.points) : null),
    [activeTab, processed]
  );

  const heatwaveAnalysis = useMemo(
    () =>
      (activeTab === 'heatwave' || isDossierModalOpen) && processed
        ? detectMarineHeatwaves(processed.points, selectedVariable.unit)
        : null,
    [activeTab, isDossierModalOpen, processed, selectedVariable.unit]
  );

  // Bivariate lead-lag: secondary real series aligned on common months
  const secondary = useRealSeries(selectedSecondaryVariable.id, lat, lon, activeTab === 'bivariate');
  const bivariateCorrelation = useMemo(() => {
    if (activeTab !== 'bivariate' || !primary.data || !secondary.data) return null;
    const aligned = alignByDate([primary.data, secondary.data]);
    if (aligned.dates.length < 36) return null;
    const a = processMonthlyTimeSeries(aligned.dates, aligned.values[0], selectedVariable.unit, baseline);
    const b = processMonthlyTimeSeries(aligned.dates, aligned.values[1], selectedSecondaryVariable.unit, baseline);
    return calculateBivariateLeadLag(
      a.points.map(p => p.date),
      a.points.map(p => p.anomaly),
      b.points.map(p => p.anomaly),
      selectedVariable.shortCode,
      selectedSecondaryVariable.shortCode
    );
  }, [activeTab, primary.data, secondary.data, selectedVariable, selectedSecondaryVariable, baseline]);

  // Compound hot-and-dry: three real, co-registered MERRA-2 series
  const compoundBundle = useRealSeriesBundle(COMPOUND_VARIABLES, lat, lon, activeTab === 'compound');
  const compoundAnalysis = useMemo(() => {
    if (activeTab !== 'compound' || compoundBundle.status !== 'ready') return null;
    const series = COMPOUND_VARIABLES.map(id => compoundBundle.data[id]);
    const aligned = alignByDate(series);
    const [t, sm, pr] = aligned.values.map((vals, i) =>
      processMonthlyTimeSeries(aligned.dates, vals, series[i].unit, baseline)
    );
    return detectCompoundHotDryEvents(t.points, sm.points, pr.points);
  }, [activeTab, compoundBundle.status, compoundBundle.data, baseline]);

  // ---- Navigation helpers ---------------------------------------------------------------------
  const goTo = (tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSpace = () => {
    setMapMode('space');
    goTo('map');
  };

  const selectRegion = (region: RegionHotspot) => {
    setSelectedRegion(region);
    setCustomCoordinates(region.coordinates);
  };

  const handleWizardComplete = (variable: EarthVariable, region: RegionHotspot) => {
    setSelectedVariable(variable);
    selectRegion(region);
    goTo('explorer');
  };

  const handleSelectCaseStudy = (caseStudyId: string) => {
    const cs = DEMO_CASE_STUDIES.find(c => c.id === caseStudyId);
    if (!cs) return;
    const v = NASA_VARIABLES.find(item => item.id === cs.variableId) || defaultVariable;
    const r = PLANETARY_HOTSPOTS.find(item => item.id === cs.primaryRegionId) || PLANETARY_HOTSPOTS[0];
    if (cs.targetLabTab) {
      setSelectedVariable(v);
      selectRegion(r);
      goTo(cs.targetLabTab as TabId);
      return;
    }
    if (cs.secondaryRegionId) {
      setParadoxCaseId(cs.id);
      goTo('paradox');
      return;
    }
    setSelectedVariable(v);
    selectRegion(r);
    if (cs.secondaryVariableId) {
      const v2 = NASA_VARIABLES.find(item => item.id === cs.secondaryVariableId);
      if (v2) setSelectedSecondaryVariable(v2);
    }
    goTo('explorer');
  };


  // ---- Guided demo: one complete investigation, driven through the real app ----------------------
  const demoSteps: DemoStep[] = [
    {
      title: 'Every investigation starts with a question',
      body: 'Instead of a menu of datasets, you pick a plain question. Behind the scenes it maps to a real NASA or NOAA variable and a place worth looking at.',
      lookFor: 'The eight question cards, then the one big button that gives you the answer.',
      run: () => goTo('detective')
    },
    {
      title: 'The answer comes first',
      body: 'Is the air over South Asia getting dirtier? The verdict card answers the four questions of the challenge: what is changing, where, how much, and whether it is statistically real.',
      lookFor: 'The confidence meter and the "Is it real?" tile. Flip the Plain English / Technical switch to see the test statistics.',
      run: () => {
        const v = NASA_VARIABLES.find(x => x.id === 'aod550');
        const r = PLANETARY_HOTSPOTS.find(x => x.id === 'south_asia_indo_gangetic');
        if (v && r) {
          setSelectedVariable(v);
          selectRegion(r);
        }
        setShowFullStats(false);
        goTo('explorer');
      }
    },
    {
      title: 'Then show your work',
      body: 'The chart shows the real monthly record, the anomaly against a 1991–2020 baseline and the trend line. Interpolated gaps are marked; nothing is simulated.',
      lookFor: 'The full statistical report: Mann-Kendall with autocorrelation correction, Sen\'s slope with a confidence interval, and the change-point test.',
      run: () => {
        setShowFullStats(true);
        goTo('explorer');
        setTimeout(() => window.scrollTo({ top: 520, behavior: 'smooth' }), 300);
      }
    },
    {
      title: 'Two places, opposite stories',
      body: 'Aerosols are rising over the Indo-Gangetic Plain while falling over Scandinavia. Placing the verdicts side by side makes the contrast, and the evidence for each, obvious.',
      lookFor: 'The two verdict cards: opposite arrows, both with high confidence.',
      run: () => handleSelectCaseStudy('case_aerosol_divergence')
    },
    {
      title: 'Where else is it changing?',
      body: 'The trend map samples real series on a 15° grid. Colour shows the size and direction of change; dots mark cells that survive a false-discovery correction across the whole map.',
      lookFor: 'Red over India, where aerosols are rising fastest, and blue over eastern China, where clean-air policy is cutting them. Click any square to analyze that exact spot.',
      run: () => {
        const v = NASA_VARIABLES.find(x => x.id === 'aod550');
        if (v) setSelectedVariable(v);
        goTo('map');
      }
    },
    {
      title: 'How you know it is real',
      body: 'Every series shows its agency, product, DOI and license. The methods page explains each test in plain language, including what this tool cannot tell you: it detects change, it does not attribute it.',
      lookFor: 'The provenance table and the limitations section.',
      run: () => goTo('about')
    }
  ];
  const goDemo = (i: number) => {
    const clamped = Math.max(0, Math.min(demoSteps.length - 1, i));
    setDemoIndex(clamped);
    demoSteps[clamped].run();
  };

  const isGlobalScope = selectedVariable.scope === 'global';
  const regionOptions = PLANETARY_HOTSPOTS.some(r => r.id === selectedRegion.id)
    ? PLANETARY_HOTSPOTS
    : [selectedRegion, ...PLANETARY_HOTSPOTS];

  // Shared loading / error rendering for tabs that depend on the primary series
  const primaryGate = (render: (p: NonNullable<typeof processed>) => React.ReactNode) => {
    if (primary.status === 'error') {
      return (
        <SeriesErrorCard
          message={primary.error || 'Unknown error'}
          onRetry={primary.retry}
          hint="Pick another variable or a land location (soil-moisture and some satellite products only cover land), or retry."
        />
      );
    }
    if (!processed) return <SeriesLoading />;
    return render(processed);
  };

  const quickBarSlope = processed
    ? `${formatSigned(processed.stats.sensSlopePerDecade)} ${selectedVariable.unit}/dec`
    : null;

  // Tell the AI assistant what is on screen (every analysis tab that has a primary series).
  const aiContext = useMemo(
    () =>
      processed && activeTab !== 'detective' && !TABS_WITHOUT_PRIMARY_SERIES.includes(activeTab)
        ? { variable: selectedVariable, region: selectedRegion, stats: processed.stats }
        : null,
    [processed, activeTab, selectedVariable, selectedRegion]
  );
  useRegisterAiContext('app', aiContext);
  useSuspendAiAssistant(demoIndex !== null);

  return (
    <div
      className={`min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans transition-[padding] duration-300 motion-reduce:transition-none ${
        aiDocked ? 'xl:pr-[440px]' : ''
      }`}
    >
      <Header
        activeTab={activeTab}
        setActiveTab={tab => goTo(tab)}
        onOpenQuickDemo={() => goDemo(0)}
      />

      {/* Global context bar: what are we looking at right now? */}
      {activeTab !== 'detective' && !TABS_WITHOUT_PRIMARY_SERIES.includes(activeTab) && (
        <section className="bg-white border-b border-slate-200/90 py-2 text-xs shadow-sm sm:sticky sm:top-16 z-30">
          <div className="ep-container flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-900">{isGlobalScope ? 'Global' : selectedRegion.name}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-700">{selectedVariable.name}</span>
              {quickBarSlope && (
                <span className="text-blue-700 font-mono font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {quickBarSlope}
                </span>
              )}
              {primary.status === 'loading' && (
                <span className="text-slate-500 font-mono text-[11px]">fetching…</span>
              )}
              {primary.data && (
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
                    primary.data.provenance.mode === 'CACHED_REAL'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {primary.data.provenance.mode === 'CACHED_REAL' ? 'SAVED REAL DATA' : 'REAL DATA'} ·{' '}
                  {primary.data.provenance.sourceAgency}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo('detective')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <span>New question</span>
              </button>
              {aiContext && (
                <button
                  onClick={ai.openPanel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI</span>
                </button>
              )}
              <button
                onClick={() => setIsDossierModalOpen(true)}
                disabled={!processed}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-xs shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-slate-300" />
                <span>Report &amp; CSV</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <main className="ep-container flex-1 py-6">
        <TabBanner tab={activeTab} />
        <Suspense fallback={<ViewFallback />}>
          {activeTab === 'detective' && (
            <DetectiveWizard
              onComplete={handleWizardComplete}
              onSelectCaseStudy={handleSelectCaseStudy}
              onOpenMap={v => {
                setSelectedVariable(v);
                goTo('map');
              }}
              onOpenCompare={() => goTo('paradox')}
              onStartDemo={() => goDemo(0)}
              unavailableVariableIds={unavailableVariableIds}
            />
          )}

          {activeTab === 'multiagency' && <MultiAgencyLiveLab />}

          {activeTab === 'explorer' && (
            <div className="space-y-6">
              {/* Selectors */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 shadow-card">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  Variable
                  <select
                    value={selectedVariable.id}
                    onChange={e => {
                      const found = availableVariables.find(v => v.id === e.target.value);
                      if (found) setSelectedVariable(found);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold max-w-[280px]"
                  >
                    {availableVariables.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  Region
                  <select
                    value={selectedRegion.id}
                    disabled={isGlobalScope}
                    onChange={e => {
                      const found = regionOptions.find(r => r.id === e.target.value);
                      if (found) selectRegion(found);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold max-w-[280px] disabled:opacity-50"
                  >
                    {regionOptions.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {isGlobalScope && (
                  <span className="text-[11px] text-slate-500">This is a worldwide reference series; the region does not apply.</span>
                )}
                <button
                  onClick={() => goTo('map')}
                  className="md:ml-auto text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Pick any coordinate on the map →
                </button>
              </div>

              {primary.data && (
                <ProvenanceStrip provenance={primary.data.provenance} lat={lat} lon={lon} global={isGlobalScope} />
              )}

              <VariableCard variable={selectedVariable} compact={false} />

              {primaryGate(p => (
                <>
                  <VerdictCard
                    stats={p.stats}
                    variable={selectedVariable}
                    regionLabel={selectedRegion.name}
                    points={p.points}
                    provenance={primary.data?.provenance}
                    isGlobal={isGlobalScope}
                    plainEnglish={plainEnglish}
                    onTogglePlain={handleTogglePlain}
                    actions={[
                      { label: 'Ask the AI Climatologist why', onClick: () => ai.ask(), primary: true },
                      { label: 'Compare with another region', onClick: () => goTo('paradox') },
                      { label: 'See where else it is changing', onClick: () => goTo('map') },
                      { label: 'Is it linked to El Niño?', onClick: () => goTo('teleconnections') }
                    ]}
                  />
                  {!isGlobalScope && (
                    <SeeFromSpaceCard
                      lat={lat}
                      lon={lon}
                      regionLabel={selectedRegion.name}
                      onOpen={openSpace}
                    />
                  )}
                  <TimeSeriesChart
                    points={p.points}
                    unit={selectedVariable.unit}
                    variableName={selectedVariable.name}
                    regionName={isGlobalScope ? 'Global' : selectedRegion.name}
                    baseline={baseline}
                    onBaselineChange={setBaseline}
                    anomalyMode={anomalyMode}
                    onAnomalyModeChange={setAnomalyMode}
                    changepoint={p.stats.changepoint}
                  />
                  {plainEnglish && !showFullStats ? (
                    <button
                      onClick={() => setShowFullStats(true)}
                      className="w-full text-left bg-white rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 px-5 py-4 text-sm text-slate-600"
                    >
                      <span className="font-semibold text-slate-800">Show the full statistical report</span>: Mann-Kendall,
                      Sen's slope, serial-correlation correction, break test, power analysis
                    </button>
                  ) : (
                    <StatisticalSummaryCard
                      stats={p.stats}
                      regionName={isGlobalScope ? 'Global' : selectedRegion.name}
                      variableName={selectedVariable.name}
                    />
                  )}
                </>
              ))}
            </div>
          )}

          {activeTab === 'paradox' && (
            <DualRegionParadoxView
              initialCaseId={paradoxCaseId}
              plainEnglish={plainEnglish}
              onTogglePlain={handleTogglePlain}
            />
          )}

          {activeTab === 'map' && (
            <MapWorkspace
              variable={selectedVariable}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              customCoordinates={customCoordinates}
              onCustomCoordinatesChange={setCustomCoordinates}
              mode={mapMode}
              onModeChange={setMapMode}
              onAnalyzePoint={(la, lo, label) => {
                selectRegion(makeCustomRegion(la, lo, label));
                goTo('explorer');
              }}
            />
          )}

          {activeTab === 'teleconnections' &&
            primaryGate(p => (
              <ClimateTeleconnectionsLab variable={selectedVariable} region={selectedRegion} points={p.points} />
            ))}

          {activeTab === 'heatwave' &&
            primaryGate(() =>
              heatwaveAnalysis ? (
                <MarineHeatwaveLab variable={selectedVariable} region={selectedRegion} analysis={heatwaveAnalysis} />
              ) : (
                <SeriesLoading />
              )
            )}

          {activeTab === 'spectral' &&
            primaryGate(() =>
              spectralAnalysis ? (
                <SpectralWaveletLab variable={selectedVariable} region={selectedRegion} spectral={spectralAnalysis} />
              ) : (
                <SeriesLoading />
              )
            )}

          {activeTab === 'decomposition' &&
            primaryGate(() =>
              decomposition ? (
                <DecompositionView
                  decomposition={decomposition}
                  variableName={selectedVariable.name}
                  unit={selectedVariable.unit}
                  regionName={selectedRegion.name}
                />
              ) : (
                <SeriesLoading />
              )
            )}

          {activeTab === 'bivariate' &&
            (primary.status === 'error' || secondary.status === 'error' ? (
              <SeriesErrorCard
                message={(primary.error || secondary.error) as string}
                onRetry={() => {
                  primary.retry();
                  secondary.retry();
                }}
              />
            ) : bivariateCorrelation ? (
              <BivariateAnalysisLab
                primaryVariable={selectedVariable}
                secondaryVariable={selectedSecondaryVariable}
                onSecondaryVariableChange={setSelectedSecondaryVariable}
                variables={availableVariables}
                region={selectedRegion}
                correlation={bivariateCorrelation}
              />
            ) : (
              <SeriesLoading />
            ))}

          {activeTab === 'compound' &&
            (compoundBundle.status === 'error' ? (
              <SeriesErrorCard message={compoundBundle.error || 'Unknown error'} onRetry={compoundBundle.retry} />
            ) : compoundAnalysis ? (
              <CompoundEventsLab region={selectedRegion} analysis={compoundAnalysis} />
            ) : (
              <SeriesLoading label="Fetching temperature, soil wetness and precipitation…" />
            ))}

          {activeTab === 'about' && <ScienceGuideView />}
        </Suspense>
      </main>

      {demoIndex !== null && (
        <GuidedDemo steps={demoSteps} index={demoIndex} onGo={goDemo} onExit={() => setDemoIndex(null)} />
      )}

      <AiAssistantUi onOpenGuide={() => goTo('about')} />


      {isDossierModalOpen && processed && (
        <Suspense fallback={null}>
          <ExecutiveSummaryModal
            isOpen={isDossierModalOpen}
            onClose={() => setIsDossierModalOpen(false)}
            variable={selectedVariable}
            region={selectedRegion}
            stats={processed.stats}
            points={processed.points}
            heatwaveAnalysis={heatwaveAnalysis}
            compoundAnalysis={null}
            showSatellite={!isGlobalScope}
            provenanceLine={
              primary.data
                ? `${primary.data.provenance.product || ''} (${primary.data.provenance.sourceAgency}). ` +
                  `Record ${primary.data.provenance.recordStart} to ${primary.data.provenance.recordEnd}, ` +
                  `${primary.data.provenance.months} months, ${primary.data.provenance.interpolatedMonths ?? 0} interpolated. ` +
                  `${primary.data.provenance.doi ? `DOI ${primary.data.provenance.doi}. ` : ''}` +
                  `License: ${primary.data.provenance.license || 'see source'}.`
                : undefined
            }
          />
        </Suspense>
      )}

      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-12">
        <div className="ep-container space-y-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <img src="/brand/stratasight-icon.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              <span>
                Strata
                <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-[CanvasText]">Sight</span>
                {' '}| NASA Space Apps Challenge 2026 · Team StrataSight
              </span>
            </span>
            <span className="font-mono text-slate-500 text-[11px]">
              NASA POWER (MERRA-2/CERES) • GES DISC (GLDAS, GPM IMERG, AIRS, OMI) • NOAA GML • PO.DAAC SWOT • KNMI • CSA • Geo.ca
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed text-center sm:text-left">
            Every series is retrieved from the agency API shown on its provenance strip; nothing is simulated. Contains
            information licensed under the Open Government Licence – Canada. KNMI Climate Explorer data is used for
            non-commercial scientific research. NASA does not endorse any non-U.S. Government entity and is not responsible
            for information contained on non-U.S. Government websites.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AiAssistantProvider>
      <AppInner />
    </AiAssistantProvider>
  );
}
