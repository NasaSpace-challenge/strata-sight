import React, { useState } from 'react';
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
import { TimeSeriesPoint, BaselinePeriod, AnomalyDisplayMode, ChangepointAnalysis } from '../types';
import { AlertTriangle, Clock, Layers, Sparkles, Filter } from 'lucide-react';

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  unit: string;
  variableName: string;
  regionName: string;
  baseline: BaselinePeriod;
  onBaselineChange: (base: BaselinePeriod) => void;
  anomalyMode: AnomalyDisplayMode;
  onAnomalyModeChange: (mode: AnomalyDisplayMode) => void;
  changepoint?: ChangepointAnalysis;
  secondaryPoints?: TimeSeriesPoint[];
  secondaryRegionName?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  points,
  unit,
  variableName,
  regionName,
  baseline,
  onBaselineChange,
  anomalyMode,
  onAnomalyModeChange,
  changepoint,
  secondaryPoints,
  secondaryRegionName
}) => {
  const [showRaw, setShowRaw] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [highlightExtremes, setHighlightExtremes] = useState(true);
  const [selectedDecade, setSelectedDecade] = useState<'ALL' | 'LAST20' | 'LAST10'>('ALL');

  const isZScore = anomalyMode === 'STANDARDIZED_ZSCORE';
  const effectiveUnit = isZScore ? 'σ (Std. Dev.)' : unit;

  // Period zoom, relative to the actual record (works for any variable / record length)
  const firstYear = points[0]?.year ?? 0;
  const lastYear = points[points.length - 1]?.year ?? 0;
  const spanYears = lastYear - firstYear + 1;
  const filteredPoints = points.filter(p => {
    if (selectedDecade === 'LAST20') return p.year > lastYear - 20;
    if (selectedDecade === 'LAST10') return p.year > lastYear - 10;
    return true;
  });

  const chartData = filteredPoints.map((p, idx) => {
    const origIdx = points.findIndex(orig => orig.date === p.date);
    const sec = secondaryPoints && secondaryPoints[origIdx];
    const anomVal = isZScore ? p.zScore : p.anomaly;
    const secAnomVal = sec ? (isZScore ? sec.zScore : sec.anomaly) : undefined;

    return {
      date: p.date,
      raw: p.raw,
      anomaly: anomVal,
      trend: isZScore ? Number((p.trend / (unit === '°C' ? 1.2 : 5)).toFixed(2)) : p.trend,
      ciUpper: isZScore ? undefined : p.ciUpper,
      ciLower: isZScore ? undefined : p.ciLower,
      isExtremeHigh: highlightExtremes && p.isExtremeWarmOrHigh ? anomVal : null,
      isExtremeLow: highlightExtremes && p.isExtremeColdOrDry ? anomVal : null,
      ...(sec && {
        secAnomaly: secAnomVal,
        secTrend: isZScore ? Number((sec.trend / 2).toFixed(2)) : sec.trend
      })
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card">
      {/* Top Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-blue-600 uppercase tracking-wider font-semibold">
              Observation Time Series ({firstYear} – {lastYear})
            </span>
            {changepoint?.hasChangepoint && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                Shift: {changepoint.date}
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            {variableName} <span className="text-slate-500 font-normal">({effectiveUnit})</span>
          </h3>
        </div>

        {/* Baseline, Anomaly Mode & Decade Zoom Configuration */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Decade Scrubber */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
            <Filter className="w-3 h-3 text-slate-500 ml-1" />
            <button
              onClick={() => setSelectedDecade('ALL')}
              className={`px-2 py-0.5 rounded-lg ${selectedDecade === 'ALL' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All {spanYears} yr
            </button>
            {spanYears > 20 && (
            <button
              onClick={() => setSelectedDecade('LAST20')}
              className={`px-2 py-0.5 rounded-lg ${selectedDecade === 'LAST20' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Last 20 yr
            </button>
            )}
            {spanYears > 10 && (
            <button
              onClick={() => setSelectedDecade('LAST10')}
              className={`px-2 py-0.5 rounded-lg ${selectedDecade === 'LAST10' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Last 10 yr
            </button>
            )}
          </div>

          {/* Baseline Picker */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500 font-medium">Climatology:</span>
            <select
              value={baseline}
              onChange={e => onBaselineChange(e.target.value as BaselinePeriod)}
              className="bg-transparent text-slate-900 font-mono font-semibold focus:outline-none cursor-pointer"
            >
              <option value="1961-1990">1961-1990 (Classic WMO)</option>
              <option value="1981-2010">1981-2010 (Pre-Modern)</option>
              <option value="1991-2020">1991-2020 (Modern WMO)</option>
              <option value="2001-2020">2001-2020 (Satellite Era)</option>
              <option value="FULL_PERIOD">Full Record Baseline</option>
            </select>
          </div>

          {/* Anomaly Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              onClick={() => onAnomalyModeChange('PHYSICAL')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                anomalyMode === 'PHYSICAL'
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Physical Unit
            </button>
            <button
              onClick={() => onAnomalyModeChange('STANDARDIZED_ZSCORE')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                anomalyMode === 'STANDARDIZED_ZSCORE'
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Z-Score (σ)
            </button>
          </div>
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowAnomaly(!showAnomaly)}
            className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
              showAnomaly
                ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ● {isZScore ? 'Z-Score Anomaly (σ)' : 'Deseasonalized Anomaly'}
          </button>

          <button
            onClick={() => setShowTrend(!showTrend)}
            className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
              showTrend
                ? 'bg-rose-50 text-rose-700 border-rose-200 font-semibold'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Linear trendline
          </button>

          {!isZScore && (
            <button
              onClick={() => setShowRaw(!showRaw)}
              className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
                showRaw
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ~ Raw Signal (With Seasons)
            </button>
          )}

          {!isZScore && (
            <button
              onClick={() => setShowConfidence(!showConfidence)}
              className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
                showConfidence
                  ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ░ 95% Confidence Band
            </button>
          )}

          <button
            onClick={() => setHighlightExtremes(!highlightExtremes)}
            className={`px-3 py-1 rounded-lg font-medium border transition-colors ${
              highlightExtremes
                ? 'bg-amber-50 text-amber-700 border-amber-200 font-semibold'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ▲ Extreme Departures (±2σ)
          </button>
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#64748B"
              tick={{ fontSize: 11 }}
              tickFormatter={(val: string) => (val.endsWith('-01') ? val.substring(0, 4) : '')}
            />

            <YAxis
              stroke="#64748B"
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
              unit={` ${effectiveUnit}`}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#0F172A',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              labelFormatter={label => `Month: ${label}`}
              formatter={(value: any, name: any) => [
                `${Number(value).toFixed(2)} ${effectiveUnit}`,
                String(name)
              ]}
            />

            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#64748B' }} />

            <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" />

            {/* Standard Deviation Reference Lines if in Z-Score mode */}
            {isZScore && (
              <>
                <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '+2σ Extreme High', fill: '#d97706', fontSize: 10 }} />
                <ReferenceLine y={-2} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '-2σ Extreme Low', fill: '#2563eb', fontSize: 10 }} />
              </>
            )}

            {/* Pettitt Changepoint Vertical Marker */}
            {changepoint?.hasChangepoint && (
              <ReferenceLine
                x={changepoint.date}
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="4 2"
                label={{
                  value: `Regime Shift: ${changepoint.date}`,
                  fill: '#d97706',
                  fontSize: 11,
                  position: 'top'
                }}
              />
            )}

            {/* Confidence Envelope */}
            {showConfidence && !isZScore && (
              <>
                <Line
                  type="monotone"
                  dataKey="ciUpper"
                  name="95% CI Upper"
                  stroke="#a855f7"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  opacity={0.4}
                />
                <Line
                  type="monotone"
                  dataKey="ciLower"
                  name="95% CI Lower"
                  stroke="#a855f7"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  opacity={0.4}
                />
              </>
            )}

            {/* Raw Monthly Observations */}
            {showRaw && !isZScore && (
              <Line
                type="monotone"
                dataKey="raw"
                name={`Raw Observations (${regionName})`}
                stroke="#059669"
                strokeWidth={1.2}
                dot={false}
                opacity={0.65}
              />
            )}

            {/* Primary Anomaly Line */}
            {showAnomaly && (
              <Line
                type="monotone"
                dataKey="anomaly"
                name={isZScore ? `Z-Score Anomaly: ${regionName}` : `Anomaly: ${regionName}`}
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
              />
            )}

            {/* OLS Trendline */}
            {showTrend && (
              <Line
                type="linear"
                dataKey="trend"
                name={`Trendline (${regionName})`}
                stroke="#e11d48"
                strokeWidth={2.2}
                dot={false}
                strokeDasharray="4 2"
              />
            )}

            {/* Extreme Departure Dots */}
            {highlightExtremes && (
              <Line
                type="monotone"
                dataKey="isExtremeHigh"
                name="Extreme Departure (> +2σ)"
                stroke="#d97706"
                strokeWidth={0}
                dot={{ r: 4, fill: '#d97706' }}
              />
            )}

            {/* Secondary Dual-Region Comparison Line */}
            {secondaryPoints && (
              <>
                <Line
                  type="monotone"
                  dataKey="secAnomaly"
                  name={`Anomaly: ${secondaryRegionName}`}
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="secTrend"
                  name={`Trendline (${secondaryRegionName})`}
                  stroke="#ea580c"
                  strokeWidth={2.2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 mt-2 px-1 gap-2 border-t border-slate-100 pt-3">
        <span>
          *Reference Climatology Baseline: <strong className="text-slate-800 font-mono">{baseline}</strong>. Extreme departures mark anomalies exceeding ±2 standard deviations.
        </span>
        <span className="font-mono text-blue-600 font-medium">NASA Earth Observing System Missions & Reanalysis</span>
      </div>
    </div>
  );
};
