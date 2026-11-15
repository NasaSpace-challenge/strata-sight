import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { TimeSeriesDecomposition } from '../types';
import { Layers, Calendar, Activity, BarChart2 } from 'lucide-react';

interface DecompositionViewProps {
  decomposition: TimeSeriesDecomposition;
  variableName: string;
  unit: string;
  regionName: string;
}

export const DecompositionView: React.FC<DecompositionViewProps> = ({
  decomposition,
  variableName,
  unit,
  regionName
}) => {
  const {
    points,
    peakMonthName,
    troughMonthName,
    annualAmplitude,
    seasonalVariancePercent,
    trendVariancePercent,
    residualVariancePercent
  } = decomposition;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-sky-700 uppercase tracking-wider font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Additive Time Series Decomposition (STL Analysis)</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Signal Separation: Raw = Long-Term Trend + Seasonal Wave + Residual Noise
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Region: <span className="text-slate-800">{regionName}</span> • Variable: <span className="text-slate-800">{variableName} ({unit})</span>
          </p>
        </div>

        {/* Seasonality Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] text-slate-600 block font-mono uppercase">Peak / Trough</span>
            <span className="text-xs font-bold text-emerald-700 font-mono">{peakMonthName} / {troughMonthName}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] text-slate-600 block font-mono uppercase">Annual Amplitude</span>
            <span className="text-xs font-bold text-sky-700 font-mono">{annualAmplitude} {unit}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-600 block font-mono uppercase">Seasonal Variance</span>
            <span className="text-xs font-bold text-amber-700 font-mono">{seasonalVariancePercent}%</span>
          </div>
        </div>
      </div>

      {/* Variance Distribution Bar */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-700 mb-2 font-mono">
          <span>Signal Variance Breakdown:</span>
          <span>Trend: {trendVariancePercent}% • Season: {seasonalVariancePercent}% • Residual: {residualVariancePercent}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
          <div style={{ width: `${trendVariancePercent}%` }} className="bg-red-500" title={`Trend: ${trendVariancePercent}%`} />
          <div style={{ width: `${seasonalVariancePercent}%` }} className="bg-cyan-500" title={`Seasonal: ${seasonalVariancePercent}%`} />
          <div style={{ width: `${residualVariancePercent}%` }} className="bg-slate-500" title={`Residual Noise: ${residualVariancePercent}%`} />
        </div>
      </div>

      {/* Subplots: Trend, Seasonal, Residual */}
      <div className="space-y-5">
        {/* 1. Long-Term Trend Subplot */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-rose-700 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span>1. Long-Term Trend Component (12-Month Centered Moving Average)</span>
            </span>
            <span className="text-slate-600 text-[11px] font-mono">{trendVariancePercent}% of variance</span>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => (v.endsWith('-01') ? v.substring(0, 4) : '')} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit={` ${unit}`} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Line type="monotone" dataKey="trend" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Seasonal Harmonic Subplot */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-sky-700 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>2. Astronomical Seasonal Cycle (Climatological Sine Wave)</span>
            </span>
            <span className="text-slate-600 text-[11px] font-mono">{seasonalVariancePercent}% of variance</span>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => (v.endsWith('-01') ? v.substring(0, 4) : '')} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit={` ${unit}`} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Line type="monotone" dataKey="seasonal" stroke="#00b4d8" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Residual Noise Subplot */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>3. Residual Noise & Weather Anomalies (Irregular Component)</span>
            </span>
            <span className="text-slate-600 text-[11px] font-mono">{residualVariancePercent}% of variance</span>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => (v.endsWith('-01') ? v.substring(0, 4) : '')} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit={` ${unit}`} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Line type="monotone" dataKey="residual" stroke="#94a3b8" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
