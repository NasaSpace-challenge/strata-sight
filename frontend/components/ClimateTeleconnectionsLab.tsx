import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  EarthVariable,
  RegionHotspot,
  ClimateIndexId,
  TimeSeriesPoint,
  ClimateIndexMetadata,
  ClimateIndexPoint
} from '../types';
import {
  CLIMATE_INDICES,
  calculateTeleconnectionCoupling
} from '../services/climateIndicesData';
import { fetchLiveKnmiIndex, KnmiLiveIndexResponse } from '../services/liveEarthDataService';
import { Radio, Waves, ArrowRight, Award, BarChart2, Activity } from 'lucide-react';

interface ClimateTeleconnectionsLabProps {
  variable: EarthVariable;
  region: RegionHotspot;
  points: TimeSeriesPoint[];
}

export const ClimateTeleconnectionsLab: React.FC<ClimateTeleconnectionsLabProps> = ({
  variable,
  region,
  points
}) => {
  const [selectedIndexId, setSelectedIndexId] = useState<ClimateIndexId>('ENSO_ONI');
  const [liveKnmi, setLiveKnmi] = useState<KnmiLiveIndexResponse | null>(null);
  const [knmiState, setKnmiState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const selectedIndexMeta: ClimateIndexMetadata =
    CLIMATE_INDICES.find(ci => ci.id === selectedIndexId) || CLIMATE_INDICES[0];

  useEffect(() => {
    let active = true;
    setKnmiState('loading');
    const startYear = Number(points[0]?.date?.slice(0, 4)) || 1981;
    const endYear = Number(points[points.length - 1]?.date?.slice(0, 4)) || 2025;
    fetchLiveKnmiIndex(selectedIndexId, selectedIndexMeta.significanceThreshold, startYear, endYear).then(res => {
      if (!active) return;
      setLiveKnmi(res);
      setKnmiState(res ? 'ready' : 'unavailable');
    });
    return () => {
      active = false;
    };
  }, [selectedIndexId, selectedIndexMeta.significanceThreshold]);

  // Use only months present in BOTH the regional series and the observed index (no synthetic index).
  const { alignedPoints, indexPoints } = useMemo(() => {
    if (!liveKnmi || liveKnmi.points.length === 0) {
      return { alignedPoints: [] as TimeSeriesPoint[], indexPoints: [] as ClimateIndexPoint[] };
    }
    const byDate = new Map(liveKnmi.points.map(pt => [pt.date, pt]));
    const ap: TimeSeriesPoint[] = [];
    const ip: ClimateIndexPoint[] = [];
    for (const p of points) {
      const hit = byDate.get(p.date);
      if (!hit) continue;
      ap.push(p);
      ip.push({
        date: p.date,
        year: p.year,
        month: p.month,
        value: hit.value,
        phase: hit.phase
      } as ClimateIndexPoint);
    }
    return { alignedPoints: ap, indexPoints: ip };
  }, [liveKnmi, points]);

  const coupling = calculateTeleconnectionCoupling(indexPoints, alignedPoints, selectedIndexMeta);

  // Merge time series with climate index
  const chartData = alignedPoints.map((p, idx) => {
    const idxPt = indexPoints[idx];
    return {
      date: p.date,
      anomaly: p.anomaly,
      indexValue: idxPt ? idxPt.value : 0,
      phase: idxPt ? idxPt.phase : 'NEUTRAL'
    };
  });

  if (alignedPoints.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-sm" role="status">
        <Waves className="w-8 h-8 text-slate-600 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">
          {knmiState === 'loading' ? 'Loading the observed climate index…' : 'Climate index feed unavailable'}
        </h3>
        {knmiState !== 'loading' && (
          <>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              The KNMI Climate Explorer feed for {selectedIndexMeta.name} could not be reached, so there is nothing real to
              correlate against. StrataSight never substitutes a made-up index.
            </p>
            <div className="flex justify-center gap-2">
              {CLIMATE_INDICES.map(ci => (
                <button
                  key={ci.id}
                  onClick={() => setSelectedIndexId(ci.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50"
                >
                  Try {ci.name.split(' (')[0]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header and Teleconnection Index Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-sky-700 uppercase tracking-wider font-semibold">
            <Waves className="w-3.5 h-3.5" />
            <span>Climate Teleconnection Telecoupling Engine</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Regional Teleconnection Coupling: {selectedIndexMeta.name} vs. {variable.name} in {region.name}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            {selectedIndexMeta.fullName} ({liveKnmi ? 'KNMI Climate Explorer • climexp.knmi.nl' : selectedIndexMeta.agency})
          </p>
          {liveKnmi && (
            <div className="mt-1.5 inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE KNMI ASCII FEED ({liveKnmi.latencyMs || 140} ms) • Non-U.S. Gov Partner Attribution</span>
            </div>
          )}
        </div>

        {/* Index Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
          {CLIMATE_INDICES.map(ci => (
            <button
              key={ci.id}
              onClick={() => setSelectedIndexId(ci.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedIndexId === ci.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {ci.name.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Narrative Synthesis Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start space-x-3">
        <Radio className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-800 leading-relaxed">
          <span className="font-bold text-sky-700 block mb-0.5">Teleconnection Telecoupling Diagnostic:</span>
          <span>{coupling.dominantPhaseImpact}</span>
        </div>
      </div>

      {/* Teleconnection Statistics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Pearson Correlation (r)</div>
          <div className="text-lg font-mono font-bold text-sky-700 mt-1">
            {coupling.pearsonR > 0 ? `+${coupling.pearsonR}` : coupling.pearsonR}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">p = {coupling.pValue}</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">{selectedIndexMeta.positivePhaseName} Anomaly</div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            {coupling.positivePhaseMeanAnomaly > 0 ? `+${coupling.positivePhaseMeanAnomaly}` : coupling.positivePhaseMeanAnomaly}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Composite average</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">{selectedIndexMeta.negativePhaseName} Anomaly</div>
          <div className="text-lg font-mono font-bold text-blue-700 mt-1">
            {coupling.negativePhaseMeanAnomaly > 0 ? `+${coupling.negativePhaseMeanAnomaly}` : coupling.negativePhaseMeanAnomaly}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Composite average</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Phase Contrast Divergence</div>
          <div className="text-lg font-mono font-bold text-emerald-700 mt-1">
            {coupling.phaseContrastDelta > 0 ? `+${coupling.phaseContrastDelta}` : coupling.phaseContrastDelta} {variable.unit}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Positive vs Negative</div>
        </div>
      </div>

      {/* Dual Axis Dual Chart: Regional Anomaly vs Climate Index */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-bold text-slate-900">
            Regional Anomaly Time Series Overlaid with {selectedIndexMeta.name} (2000–2024)
          </span>
          <span className="text-[11px] font-mono text-sky-700">
            Cyan = Regional Anomaly • Orange = {selectedIndexMeta.name}
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => (v.endsWith('-01') ? v.substring(0, 4) : '')}
              />
              {/* Left Y-Axis for Regional Anomaly */}
              <YAxis
                yAxisId="left"
                stroke="#00b4d8"
                tick={{ fontSize: 10 }}
                unit={` ${variable.unit}`}
              />
              {/* Right Y-Axis for Climate Index Value */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                tick={{ fontSize: 10 }}
                unit=" idx"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '11px',
                  borderRadius: '8px'
                }}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine yAxisId="left" y={0} stroke="#475569" strokeDasharray="3 3" />
              <ReferenceLine yAxisId="right" y={0} stroke="#475569" strokeDasharray="3 3" />

              {/* Threshold lines for Climate Index Significant Phases */}
              <ReferenceLine
                yAxisId="right"
                y={selectedIndexMeta.significanceThreshold}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                opacity={0.4}
              />
              <ReferenceLine
                yAxisId="right"
                y={-selectedIndexMeta.significanceThreshold}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                opacity={0.4}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="anomaly"
                name={`Regional Anomaly (${variable.shortCode})`}
                stroke="#00b4d8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="indexValue"
                name={`${selectedIndexMeta.name} (${selectedIndexMeta.unit})`}
                stroke="#f59e0b"
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-slate-600 mt-2 text-center">
          {selectedIndexMeta.description}
        </p>
      </div>
    </div>
  );
};
