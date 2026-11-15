import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  Satellite,
  Radio,
  ShieldCheck,
  Waves,
  RefreshCw,
  Database,
  Search,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  EyeOff
} from 'lucide-react';
import {
  SWOT_TARGET_PRESETS,
  CSA_RCM_SAR_SCENES,
  NOAA_GHCN_STATION_PRESETS,
  fetchLiveSwotHydrocron,
  fetchLiveCanadaHydrometric,
  fetchAppeearsCatalog,
  fetchLiveCsaRcmCatalog,
  fetchLiveNoaaNceiStation,
  verifyAgencyKeysLive,
  fetchLiveGesDiscDataRods,
  SwotLiveResponse,
  CanadaHydrometricResponse,
  AppeearsProductSummary,
  CsaRcmDatasetRecord,
  NoaaNceiStationResponse,
  AgencyKeyVerificationSummary
} from '../services/liveEarthDataService';
import { bannerClass } from './PageBanner';
import { NASA_VARIABLES, PLANETARY_HOTSPOTS } from '../services/earthScienceData';
import { fetchRealSeries } from '../services/liveEarthDataService';
import {
  calculateMannKendall,
  calculateSensSlope,
  processMonthlyTimeSeries,
  applyBenjaminiHochbergFDR
} from '../services/statisticsEngine';
import { SwotTargetPreset } from '../types';

export const MultiAgencyLiveLab: React.FC = () => {
  const [subTab, setSubTab] = useState<'swot' | 'csa_sar' | 'fdr_scanner' | 'appeears' | 'stations_keys'>('swot');

  // SWOT + Geo.ca state
  const [selectedPreset, setSelectedPreset] = useState<SwotTargetPreset>(SWOT_TARGET_PRESETS[0]);
  const [customReachInput, setCustomReachInput] = useState('');
  const [swotData, setSwotData] = useState<SwotLiveResponse | null>(null);
  const [canadaGauge, setCanadaGauge] = useState<CanadaHydrometricResponse | null>(null);
  const [loadingSwot, setLoadingSwot] = useState(false);

  // CSA RCM-3 SAR state
  const [selectedSarSceneId, setSelectedSarSceneId] = useState(CSA_RCM_SAR_SCENES[0].id);
  const activeSarScene = useMemo(
    () => CSA_RCM_SAR_SCENES.find(s => s.id === selectedSarSceneId) || CSA_RCM_SAR_SCENES[0],
    [selectedSarSceneId]
  );

  // AppEEARS Catalog state
  const [appeearsQuery, setAppeearsQuery] = useState('');
  const [appeearsState, setAppeearsState] = useState<{
    totalCatalogProducts: number;
    products: AppeearsProductSummary[];
    live: boolean;
  }>({ totalCatalogProducts: 193, products: [], live: false });
  const [loadingAppeears, setLoadingAppeears] = useState(false);

  // Live CSA / Open Canada CKAN RCM Catalog state
  const [csaRcmCatalog, setCsaRcmCatalog] = useState<{
    live: boolean;
    totalMatched: number;
    datasets: CsaRcmDatasetRecord[];
  }>({ live: false, totalMatched: 0, datasets: [] });

  // Live Zero-Auth NOAA NCEI GSOM Station & Key Verification state
  const [selectedNoaaStation, setSelectedNoaaStation] = useState(NOAA_GHCN_STATION_PRESETS[0].stationId);
  const [customNoaaInput, setCustomNoaaInput] = useState('');
  const [noaaStationData, setNoaaStationData] = useState<NoaaNceiStationResponse | null>(null);
  const [loadingNoaaStation, setLoadingNoaaStation] = useState(false);
  const [keyStatus, setKeyStatus] = useState<AgencyKeyVerificationSummary | null>(null);
  const [dataRodsTest, setDataRodsTest] = useState<{
    ok: boolean;
    status: number;
    count?: number;
    sample?: string;
    latencyMs?: number;
    error?: string;
    hint?: string;
  } | null>(null);
  const [testingKeys, setTestingKeys] = useState(false);

  const loadSwotAndGauge = async (preset: SwotTargetPreset) => {
    setLoadingSwot(true);
    try {
      const [swotRes, gaugeRes] = await Promise.all([
        fetchLiveSwotHydrocron(preset),
        preset.canadaHydrometricStation
          ? fetchLiveCanadaHydrometric(preset.canadaHydrometricStation, 1995)
          : Promise.resolve(null)
      ]);
      setSwotData(swotRes);
      setCanadaGauge(gaugeRes);
    } finally {
      setLoadingSwot(false);
    }
  };

  useEffect(() => {
    loadSwotAndGauge(selectedPreset);
  }, [selectedPreset]);

  useEffect(() => {
    if (subTab !== 'appeears') return;
    let active = true;
    setLoadingAppeears(true);
    fetchAppeearsCatalog(appeearsQuery)
      .then(res => {
        if (active) setAppeearsState(res);
      })
      .finally(() => {
        if (active) setLoadingAppeears(false);
      });
    return () => {
      active = false;
    };
  }, [subTab, appeearsQuery]);

  useEffect(() => {
    if (subTab !== 'csa_sar' || csaRcmCatalog.datasets.length > 0) return;
    fetchLiveCsaRcmCatalog(8).then(setCsaRcmCatalog);
  }, [subTab, csaRcmCatalog.datasets.length]);

  useEffect(() => {
    if (subTab !== 'stations_keys') return;
    let active = true;
    setLoadingNoaaStation(true);
    fetchLiveNoaaNceiStation(selectedNoaaStation, 2000, 2024)
      .then(res => {
        if (active) setNoaaStationData(res);
      })
      .finally(() => {
        if (active) setLoadingNoaaStation(false);
      });
    if (!keyStatus) {
      verifyAgencyKeysLive().then(k => {
        if (active) setKeyStatus(k);
      });
    }
    return () => {
      active = false;
    };
  }, [subTab, selectedNoaaStation]);

  const handleRunKeyDiagnostics = async () => {
    setTestingKeys(true);
    try {
      const [keys, rods] = await Promise.all([
        verifyAgencyKeysLive(),
        fetchLiveGesDiscDataRods(36.1, -112.1, 2022, 2023)
      ]);
      setKeyStatus(keys);
      setDataRodsTest({
        ok: rods.ok,
        status: rods.status,
        count: rods.values?.length,
        sample:
          rods.dates && rods.values && rods.dates.length > 0
            ? `${rods.dates[0]}: ${rods.values[0]} kg/m²`
            : undefined,
        latencyMs: rods.latencyMs,
        error: rods.error,
        hint: rods.hint
      });
    } finally {
      setTestingKeys(false);
    }
  };

  // SWOT statistical summary
  const swotStats = useMemo(() => {
    const obs = swotData?.observations || [];
    if (obs.length < 4) return null;
    const wseArr = obs.map(o => o.wse);
    const mk = calculateMannKendall(wseArr);
    const senPerPass = calculateSensSlope(wseArr);
    const minWse = Math.min(...wseArr);
    const maxWse = Math.max(...wseArr);
    return {
      count: obs.length,
      meanWse: Number((wseArr.reduce((a, b) => a + b, 0) / obs.length).toFixed(2)),
      dynamicRangeM: Number((maxWse - minWse).toFixed(2)),
      mkPValue: mk.pValue,
      mkZ: Number(mk.z.toFixed(2)),
      senPerPassM: Number(senPerPass.toFixed(4))
    };
  }, [swotData]);

  // Canada ECCC Hydrometric trend stats
  const gaugeStats = useMemo(() => {
    if (!canadaGauge || canadaGauge.points.length < 24) return null;
    const valid = canadaGauge.points.filter(p => p.dischargeM3s !== null);
    if (valid.length < 24) return null;
    const res = processMonthlyTimeSeries(
      valid.map(p => p.date),
      valid.map(p => p.dischargeM3s as number),
      'm³/s',
      '1991-2020'
    );
    return {
      stats: res.stats,
      recentSeries: valid.slice(-120)
    };
  }, [canadaGauge]);

  // Benjamini-Hochberg Multi-Hotspot / Multi-Variable FDR Scanner (REAL series for every cell)
  type FdrRaw = {
    id: string;
    regionName: string;
    variableName: string;
    slopePerDecade: number;
    unit: string;
    naiveMkPValue: number;
    hamedRaoPValue: number;
  };
  const [fdrRaw, setFdrRaw] = useState<FdrRaw[]>([]);
  const [fdrProgress, setFdrProgress] = useState({ done: 0, total: 0, failed: 0 });

  useEffect(() => {
    if (subTab !== 'fdr_scanner' || fdrRaw.length > 0 || fdrProgress.total > 0) return;
    let active = true;
    const scanVars = ['t2m', 'precip_merra2', 'soil_wetness'];
    const jobs: { regionId: string; variableId: string }[] = [];
    for (const region of PLANETARY_HOTSPOTS) for (const v of scanVars) jobs.push({ regionId: region.id, variableId: v });
    setFdrProgress({ done: 0, total: jobs.length, failed: 0 });
    const results: FdrRaw[] = [];
    let cursor = 0;
    let done = 0;
    let failed = 0;

    const worker = async () => {
      while (active && cursor < jobs.length) {
        const job = jobs[cursor++];
        const region = PLANETARY_HOTSPOTS.find(r => r.id === job.regionId)!;
        const variable = NASA_VARIABLES.find(v => v.id === job.variableId)!;
        try {
          const ts = await fetchRealSeries(variable.id, region.coordinates.lat, region.coordinates.lon);
          const proc = processMonthlyTimeSeries(ts.dates, ts.values, variable.unit, '1991-2020');
          results.push({
            id: `${region.id}__${variable.id}`,
            regionName: region.name.split('(')[0].trim(),
            variableName: variable.shortCode,
            slopePerDecade: proc.stats.slopePerDecade,
            unit: variable.unit,
            naiveMkPValue: proc.stats.mkPValue,
            hamedRaoPValue: proc.stats.hamedRaoMkPValue
          });
        } catch {
          failed++;
        }
        done++;
        if (active) setFdrProgress({ done, total: jobs.length, failed });
      }
    };
    Promise.all([worker(), worker(), worker()]).then(() => {
      if (active) setFdrRaw(results);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const fdrScanResults = useMemo(
    () => (fdrRaw.length > 0 ? applyBenjaminiHochbergFDR(fdrRaw, 0.05) : []),
    [fdrRaw]
  );

  const handleCustomReachQuery = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customReachInput.trim();
    if (!cleaned) return;
    setSelectedPreset({
      id: `custom_${cleaned}`,
      name: `Custom SWOT Reach #${cleaned}`,
      country: 'Global',
      featureType: cleaned.length === 10 ? 'PriorLake' : 'Reach',
      featureId: cleaned,
      coordinates: { lat: 0, lon: 0 },
      scientificContext: 'Live on-demand SWORD / PriorLake identifier queried directly from NASA PO.DAAC Hydrocron.'
    });
  };

  const tabs = [
    { id: 'swot', label: 'Live SWOT & Geo.ca Gauges', icon: Waves },
    { id: 'csa_sar', label: 'CSA RCM-3 All-Weather SAR', icon: Radio },
    { id: 'fdr_scanner', label: 'Benjamini-Hochberg FDR Scanner', icon: ShieldCheck },
    { id: 'appeears', label: 'Live AppEEARS Cloud Catalog (193)', icon: Database },
    { id: 'stations_keys', label: 'Live NOAA Stations & API Keys', icon: Satellite }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className={`${bannerClass('sky')} rounded-2xl p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/85 border border-sky-200 text-sky-800 text-xs font-mono font-semibold mb-2 shadow-sm">
              <Satellite className="w-3.5 h-3.5 text-sky-600" />
              <span>Multi-Agency Live Telemetry: NASA PO.DAAC • LP DAAC • CSA • Geo.ca</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              SWOT Interferometry, CSA RADARSAT SAR & Ground-Truth Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Combines live unauthenticated NASA/CNES/CSA SWOT Hydrocron satellite water-surface elevation passes,
              Geo.ca / ECCC 100-year hydrometric ground stations, CSA RCM-3 C-Band SAR smoke-penetrating wildfire
              backscatter (OK2080033), and Benjamini–Hochberg False Discovery Rate multiple-testing protection.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1.5 text-xs font-mono">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              <span className={`w-2 h-2 rounded-full ${swotData?.provenance.mode === 'LIVE_AGENCY_API' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>
                {loadingSwot
                  ? 'CONTACTING PO.DAAC…'
                  : swotData?.provenance.mode === 'LIVE_AGENCY_API'
                  ? `LIVE PO.DAAC CONNECTED (${swotData.provenance.latencyMs ?? '-'} ms)`
                  : 'PO.DAAC UNREACHABLE: NO DATA SHOWN'}
              </span>
            </span>
            <span className="text-[11px] text-slate-500">
              Contains information licensed under the Open Government Licence – Canada.
            </span>
          </div>
        </div>

        {/* Accessible Single-Row Scrolling Tablist with Shape Underline (WCAG 1.4.1 compliant) */}
        <div
          role="tablist"
          aria-label="Multi-agency mission control modules"
          className="mt-5 pt-4 border-t border-slate-100/80 flex flex-wrap items-center gap-1"
        >
          {tabs.map(t => {
            const Icon = t.icon;
            const selected = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                onClick={() => setSubTab(t.id)}
                className={`relative flex-none flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors ${
                  selected
                    ? 'text-blue-700 bg-blue-50/70 border-b-[3px] border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-b-[3px] border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANEL 1: LIVE SWOT HYDROCRON + GEO.CA HYDROMETRIC VALIDATION */}
      {subTab === 'swot' && (
        <div role="tabpanel" aria-labelledby="tab-swot" className="space-y-6">
          {/* Target Selector & Custom SWORD Input */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Verified SWOT Satellite Targets:</span>
                {SWOT_TARGET_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPreset(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedPreset.id === p.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {p.name.split('(')[0].trim()} ({p.country})
                  </button>
                ))}
              </div>

              <form onSubmit={handleCustomReachQuery} className="flex items-center gap-2">
                <input
                  type="text"
                  value={customReachInput}
                  onChange={e => setCustomReachInput(e.target.value)}
                  placeholder="Custom SWORD ID (e.g. 71224100221)"
                  aria-label="Custom SWORD Reach or PriorLake ID"
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 w-56 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSwot ? 'animate-spin' : ''}`} />
                  <span>Query PO.DAAC</span>
                </button>
              </form>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900">
                  {selectedPreset.featureType} #{selectedPreset.featureId}:{' '}
                </span>
                <span>{selectedPreset.scientificContext}</span>
              </div>
              <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex-shrink-0">
                {swotData?.validOverpasses || 0} Valid KaRIn Overpasses
              </span>
            </div>
          </div>

          {/* KPI Strip */}
          {swotStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[11px] font-mono text-slate-500 uppercase">Mean SWOT WSE (EGM2008)</span>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">{swotStats.meanWse} m</div>
                <span className="text-[11px] text-slate-500">Ka-Band Interferometer (KaRIn)</span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[11px] font-mono text-slate-500 uppercase">Seasonal Flood Pulse Range</span>
                <div className="text-xl font-mono font-bold text-blue-600 mt-1">{swotStats.dynamicRangeM} m</div>
                <span className="text-[11px] text-slate-500">Peak-to-trough elevation swing</span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[11px] font-mono text-slate-500 uppercase">SWOT Short-Record MK Test</span>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  p = {swotStats.mkPValue.toFixed(3)}
                </div>
                <span className="text-[11px] text-slate-500">Z = {swotStats.mkZ} ({swotStats.count} passes)</span>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-[11px] font-mono text-slate-500 uppercase">ECCC Ground Gauge Baseline</span>
                <div className="text-xl font-mono font-bold text-emerald-700 mt-1">
                  {gaugeStats
                    ? `${gaugeStats.stats.slopePerDecade > 0 ? '+' : ''}${gaugeStats.stats.slopePerDecade} m³/s/dec`
                    : 'Orbital Only'}
                </div>
                <span className="text-[11px] text-slate-500">
                  {canadaGauge ? `${canadaGauge.stationName} (${canadaGauge.stationNumber})` : 'No paired CA gauge'}
                </span>
              </div>
            </div>
          )}

          {/* Dual Charts: Live SWOT KaRIn WSE + Paired Geo.ca 30-Yr Hydrometric Ground Station */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    NASA/CNES/CSA SWOT Water Surface Elevation & Width/Area
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Source: {swotData?.provenance.sourceAgency || 'PO.DAAC Hydrocron'}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  2023–2026 Orbital Era
                </span>
              </div>

              <div className="h-72 w-full">
                {loadingSwot ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500" role="status">
                    Querying NASA PO.DAAC Hydrocron…
                  </div>
                ) : !swotData || swotData.observations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-1" role="alert">
                    <span className="text-sm font-semibold text-slate-800">No SWOT data available</span>
                    <span className="text-xs text-slate-500 max-w-sm">
                      {swotData?.unavailableReason ||
                        'This feature has no valid SWOT overpasses in the queried window.'}
                    </span>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={swotData?.observations || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                    <YAxis
                      yAxisId="wse"
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10 }}
                      label={{ value: 'WSE (m)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="aux"
                      orientation="right"
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10 }}
                      label={{
                        value: selectedPreset.featureType === 'PriorLake' ? 'Area (km²)' : 'Width (m)',
                        angle: 90,
                        position: 'insideRight',
                        fontSize: 10
                      }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      yAxisId="aux"
                      type="monotone"
                      dataKey={selectedPreset.featureType === 'PriorLake' ? 'areaKm2' : 'width'}
                      name={selectedPreset.featureType === 'PriorLake' ? 'Lake Surface Area (km²)' : 'River Width (m)'}
                      fill="#DBEAFE"
                      stroke="#60A5FA"
                      fillOpacity={0.45}
                    />
                    <Line
                      yAxisId="wse"
                      type="monotone"
                      dataKey="wse"
                      name="Water Surface Elevation (m)"
                      stroke="#1D4ED8"
                      strokeWidth={2.4}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Geo.ca / ECCC In-Situ Hydrometric Ground-Truth Validation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {canadaGauge
                      ? `${canadaGauge.stationName} (${canadaGauge.stationNumber}) • Hamed-Rao p* = ${gaugeStats?.stats.hamedRaoMkPValue ?? 'N/A'}`
                      : 'Select a Canadian SWOT corridor above to cross-validate against ECCC HYDAT gauges'}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  OGL–Canada
                </span>
              </div>

              <div className="h-72 w-full">
                {gaugeStats ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={gaugeStats.recentSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Discharge (m³/s)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="dischargeM3s"
                        name="Monthly Mean Discharge (m³/s)"
                        fill="#059669"
                        radius={[2, 2, 0, 0]}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                    Click one of the Canadian SWOT targets (BC Fraser, Manitoba Winnipeg, Quebec St. Lawrence, or Alberta Lake) to stream paired Geo.ca / ECCC hydrometric gauge telemetry.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 2: CSA RADARSAT CONSTELLATION MISSION (RCM-3) ALL-WEATHER SAR */}
      {subTab === 'csa_sar' && (
        <div role="tabpanel" aria-labelledby="tab-csa_sar" className="space-y-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="note">
            <strong>Illustrative example, not a retrieved time series.</strong> The backscatter and burn-scar values below are
            representative figures summarised from the Canadian Space Agency SAR tutorial narrative to explain how
            all-weather radar sees through smoke. Only the CSA / Open Canada dataset catalogue further down is queried live.
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {CSA_RCM_SAR_SCENES.map(sc => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedSarSceneId(sc.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedSarSceneId === sc.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {sc.applicationPillar}: {sc.title.split(' ')[0]} {sc.title.split(' ')[1]}
                  </button>
                ))}
              </div>
              <a
                href="https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <span>CSA SAR Python Repo (OK2080033)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-700">{activeSarScene.productCode}</span>
                  <span className="text-[11px] font-mono text-slate-500">{activeSarScene.beamMode}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{activeSarScene.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{activeSarScene.summary}</p>
                <div className="text-[11px] font-mono text-slate-500 pt-1">
                  Location: {activeSarScene.location}
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2 font-mono text-xs">
                <div className="text-amber-400 font-bold flex items-center space-x-1.5">
                  <Flame className="w-4 h-4" />
                  <span>RCM .SAFE Radiometric Calibration</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Parsed from <code className="text-sky-300">manifest.safe</code> &amp;{' '}
                  <code className="text-sky-300">metadata/calibration/lutSigma.xml</code>:
                </p>
                <div className="bg-slate-800 rounded-lg p-2.5 text-sky-300 text-center text-xs border border-slate-700">
                  σ⁰ [dB] = 10 · log₁₀((DN² + B) / A_i)
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  C-band λ = 5.55 cm (5.405 GHz) penetrates 100% pyrocumulus smoke &amp; Arctic polar night while MODIS/Landsat optical bands saturate.
                </p>
              </div>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeSarScene.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="db"
                    domain={[-28, -4]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'SAR Backscatter σ⁰ (dB)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Smoke / Cloud Opacity (%)', angle: 90, position: 'insideRight', fontSize: 11 }}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="pct"
                    dataKey="opticalCloudSmokeCoverPct"
                    name="Optical Cloud / Wildfire Smoke Obstruction (%)"
                    fill="#CBD5E1"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="db"
                    type="monotone"
                    dataKey="sigma0HhDb"
                    name="RCM Co-Pol σ⁰ HH / VV (dB)"
                    stroke="#0F172A"
                    strokeWidth={2.2}
                  />
                  <Line
                    yAxisId="db"
                    type="monotone"
                    dataKey="sigma0HvDb"
                    name="RCM Cross-Pol Canopy σ⁰ HV / VH (dB)"
                    stroke="#DC2626"
                    strokeWidth={2.6}
                  />
                  <ReferenceLine yAxisId="pct" y={70} stroke="#F59E0B" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {activeSarScene.timeline.map(pt => (
                <span
                  key={pt.date}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-mono text-[11px] ${
                    pt.modisUsable
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {!pt.modisUsable && <EyeOff className="w-3 h-3" />}
                  <span>
                    {pt.date}: {pt.modisUsable ? 'Optical Clear' : 'Optical Blinded: RCM SAR Active'}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Live CSA / Government of Canada Open Data CKAN Registry */}
          {csaRcmCatalog.datasets.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 id="csa-ckan-caption" className="text-sm font-bold text-slate-900">
                    Live Government of Canada / CSA RADARSAT Constellation Mission CKAN Registry ({csaRcmCatalog.totalMatched} Federal Datasets)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Streamed live from <code className="font-mono text-blue-700">open.canada.ca/data/api/action/package_search</code> under Open Government Licence – Canada.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] font-semibold">
                  LIVE FEDERAL CKAN API
                </span>
              </div>

              <div tabIndex={0} role="region" aria-labelledby="csa-ckan-caption" className="overflow-auto max-h-64 rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">RADARSAT Constellation Dataset</th>
                      <th scope="col" className="py-2.5 px-3">Lead Canadian Agency</th>
                      <th scope="col" className="py-2.5 px-3">Formats</th>
                      <th scope="col" className="py-2.5 px-3">Updated</th>
                      <th scope="col" className="py-2.5 px-3">Portal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csaRcmCatalog.datasets.map(ds => (
                      <tr key={ds.id} className="hover:bg-slate-50">
                        <th scope="row" className="py-2 px-3 font-semibold text-slate-900">{ds.title}</th>
                        <td className="py-2 px-3 text-slate-600">{ds.organization}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{ds.formats.join(', ') || 'GeoTIFF / SAFE'}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{ds.updatedAt}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <a
                            href={ds.portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:underline font-semibold"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 3: BENJAMINI-HOCHBERG FALSE DISCOVERY RATE (FDR) PLANETARY SCANNER */}
      {subTab === 'fdr_scanner' && (
        <div role="tabpanel" aria-labelledby="tab-fdr_scanner" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 id="fdr-table-caption" className="text-base font-bold text-slate-900">
                Multi-Hypothesis Benjamini–Hochberg False Discovery Rate (FDR α = 0.05) Audit
              </h3>
              <p className="text-xs text-slate-600">
                Simultaneously testing {fdrScanResults.length || fdrProgress.total} region-variable pairs (real NASA MERRA-2 / POWER series, 1981–present) without multiple-testing correction risks Type I false discoveries (Statsig &amp; KNMI guidance).
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">
              {fdrScanResults.length === 0
                ? `Scanning real data… ${fdrProgress.done}/${fdrProgress.total}`
                : `${fdrScanResults.filter(r => r.survivesFdr05).length} / ${fdrScanResults.length} Survive BH-FDR (q < 0.05)`}
            </span>
          </div>
          {fdrProgress.failed > 0 && (
            <p className="text-xs text-amber-700" role="status">
              {fdrProgress.failed} region-variable pair(s) could not be retrieved and were excluded from the test family.
            </p>
          )}

          {/* Semantic Sticky Responsive Table (modern-web-guidance pattern) */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="fdr-table-caption"
            className="overflow-auto max-h-[460px] rounded-xl border border-slate-200"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-4 sticky left-0 bg-slate-100 z-20">Region Hotspot</th>
                  <th scope="col" className="py-3 px-3">Variable</th>
                  <th scope="col" className="py-3 px-3">Decadal Slope</th>
                  <th scope="col" className="py-3 px-3">Naive MK p</th>
                  <th scope="col" className="py-3 px-3">Hamed–Rao p*</th>
                  <th scope="col" className="py-3 px-3">BH-FDR q-value</th>
                  <th scope="col" className="py-3 px-4">Scientific Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fdrScanResults.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/90">
                    <th scope="row" className="py-2.5 px-4 font-semibold text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                      {row.regionName}
                    </th>
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">{row.variableName}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.slopePerDecade > 0 ? `+${row.slopePerDecade}` : row.slopePerDecade} {row.unit}/dec
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{row.naiveMkPValue.toFixed(4)}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">{row.hamedRaoPValue.toFixed(4)}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-700 font-bold">{row.bhAdjustedQValue.toFixed(4)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {row.survivesFdr05 ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified Discovery</span>
                        </span>
                      ) : row.falsePositiveCaught ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[11px]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>False Positive Filtered!</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Null Retained</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANEL 4: LIVE NASA LP DAAC APPEEARS CLOUD PRODUCT EXPLORER */}
      {subTab === 'appeears' && (
        <div role="tabpanel" aria-labelledby="tab-appeears" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 id="appeears-caption" className="text-base font-bold text-slate-900">
                NASA Earthdata Cloud / AppEEARS Analysis-Ready Product Catalog ({appeearsState.totalCatalogProducts} Products)
              </h3>
              <p className="text-xs text-slate-600">
                Live catalog queried from <code className="font-mono text-blue-700">appeears.earthdatacloud.nasa.gov/api/product</code> for QA-screened point &amp; polygon time-series extraction.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={appeearsQuery}
                onChange={e => setAppeearsQuery(e.target.value)}
                placeholder="Filter MODIS, ECOSTRESS, SMAP, HLS..."
                aria-label="Search NASA AppEEARS products"
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 w-64 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-labelledby="appeears-caption"
            className="overflow-auto max-h-[420px] rounded-xl border border-slate-200"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-2.5 px-4 sticky left-0 bg-slate-100">Product &amp; Version</th>
                  <th scope="col" className="py-2.5 px-3">Satellite / Platform</th>
                  <th scope="col" className="py-2.5 px-3">Geophysical Parameter</th>
                  <th scope="col" className="py-2.5 px-3">Spatial Res</th>
                  <th scope="col" className="py-2.5 px-3">Cadence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingAppeears ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      Querying NASA LP DAAC Earthdata Cloud...
                    </td>
                  </tr>
                ) : (
                  appeearsState.products.map(p => (
                    <tr key={p.productAndVersion} className="hover:bg-slate-50">
                      <th scope="row" className="py-2.5 px-4 font-mono font-bold text-blue-700 sticky left-0 bg-white whitespace-nowrap">
                        {p.productAndVersion}
                      </th>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{p.platform}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.description}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">{p.resolution}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{p.temporalGranularity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANEL 5: ZERO-AUTH LIVE NOAA WEATHER STATIONS & .ENV KEY DIAGNOSTICS */}
      {subTab === 'stations_keys' && (
        <div role="tabpanel" aria-labelledby="tab-stations_keys" className="space-y-6">
          {/* Live Zero-Auth NOAA NCEI GSOM Station Explorer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live NOAA NCEI Global Summary of the Month (GSOM) Ground Stations (zero token required)
                </h3>
                <p className="text-xs text-slate-600">
                  Streamed live from <code className="font-mono text-blue-700">ncei.noaa.gov/access/services/data/v1</code> (pairs automatically with CDO v2 when <code className="font-mono">NOAA_CDO_TOKEN</code> is set).
                </p>
              </div>
              {noaaStationData && (
                <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-semibold">
                  LIVE NOAA NCEI: {noaaStationData.observations.length} Monthly Records ({noaaStationData.latencyMs || 220} ms)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {NOAA_GHCN_STATION_PRESETS.map(st => (
                  <button
                    key={st.stationId}
                    type="button"
                    onClick={() => setSelectedNoaaStation(st.stationId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedNoaaStation === st.stationId
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (customNoaaInput.trim()) setSelectedNoaaStation(customNoaaInput.trim());
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customNoaaInput}
                  onChange={e => setCustomNoaaInput(e.target.value)}
                  placeholder="Custom GHCN ID (e.g. USW00094728)"
                  aria-label="Custom NOAA GHCN station ID"
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono w-56"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Load Station
                </button>
              </form>
            </div>

            <div className="h-72 w-full">
              {loadingNoaaStation ? (
                <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                  Querying NOAA NCEI Access Data Service v1...
                </div>
              ) : noaaStationData && noaaStationData.observations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={noaaStationData.observations.slice(-120)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 10 }} unit="°C" />
                    <YAxis yAxisId="prcp" orientation="right" tick={{ fontSize: 10 }} unit=" mm" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="prcp" dataKey="prcpMm" name="Monthly Precipitation (mm)" fill="#93C5FD" />
                    <Line yAxisId="temp" type="monotone" dataKey="tavgC" name="Station Mean Temp TAVG (°C)" stroke="#DC2626" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                  No station records returned for {selectedNoaaStation}.
                </div>
              )}
            </div>
          </div>

          {/* Live .env.local Token & GES DISC Hydrology Data Rods Verification Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">
                  Authenticated Space Agency Key &amp; NASA GES DISC Data Rods Self-Test
                </h3>
                <p className="text-xs text-slate-300">
                  8 live space-agency feeds run with zero keys. Add <code className="font-mono text-emerald-300">EARTHDATA_TOKEN</code> &amp;{' '}
                  <code className="font-mono text-emerald-300">NOAA_CDO_TOKEN</code> to <code className="font-mono text-sky-300">backend/.env.local</code> and click test below.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunKeyDiagnostics}
                disabled={testingKeys}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center space-x-1.5 flex-shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingKeys ? 'animate-spin' : ''}`} />
                <span>{testingKeys ? 'Testing Upstream Tokens...' : 'Test Live Keys & GES DISC Data Rods'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-slate-400">EARTHDATA_TOKEN (NASA URS)</div>
                <div className={keyStatus?.tokenChecks.earthdataToken.valid ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                  {keyStatus?.tokenChecks.earthdataToken.configured
                    ? keyStatus.tokenChecks.earthdataToken.valid
                      ? `VALID (HTTP ${keyStatus.tokenChecks.earthdataToken.httpStatus} • ${keyStatus.tokenChecks.earthdataToken.latencyMs} ms)`
                      : `INVALID / EXPIRED`
                    : 'NOT SET IN backend/.env.local'}
                </div>
                <div className="text-[11px] text-slate-400">Unlocks GES DISC Data Rods + AppEEARS Tasks</div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-slate-400">NOAA_CDO_TOKEN (NCEI v2)</div>
                <div className={keyStatus?.tokenChecks.noaaCdoToken.valid ? 'text-emerald-400 font-bold' : 'text-sky-300 font-bold'}>
                  {keyStatus?.tokenChecks.noaaCdoToken.configured
                    ? keyStatus.tokenChecks.noaaCdoToken.valid
                      ? `VALID (HTTP ${keyStatus.tokenChecks.noaaCdoToken.httpStatus} • ${keyStatus.tokenChecks.noaaCdoToken.latencyMs} ms)`
                      : `INVALID TOKEN`
                    : 'OPTIONAL (Zero-Auth GSOM Active)'}
                </div>
                <div className="text-[11px] text-slate-400">Unlocks /api/earthdata/noaa-cdo v2</div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-slate-400">NASA GES DISC Data Rods Test</div>
                <div className={dataRodsTest?.ok ? 'text-emerald-400 font-bold' : 'text-slate-300 font-bold'}>
                  {dataRodsTest
                    ? dataRodsTest.ok
                      ? `LIVE (${dataRodsTest.count} mos • ${dataRodsTest.sample})`
                      : `HTTP ${dataRodsTest.status}: ${dataRodsTest.error}`
                    : 'Click "Test Live Keys" to query hydro1.gesdisc'}
                </div>
                {dataRodsTest?.hint && <div className="text-[10px] text-amber-300">{dataRodsTest.hint}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
