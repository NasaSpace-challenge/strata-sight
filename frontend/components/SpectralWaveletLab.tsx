import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { EarthVariable, RegionHotspot, SpectralAnalysisResult } from '../types';
import { Radio, Activity, Sparkles, Waves, BarChart2 } from 'lucide-react';

interface SpectralWaveletLabProps {
  variable: EarthVariable;
  region: RegionHotspot;
  spectral: SpectralAnalysisResult;
}

export const SpectralWaveletLab: React.FC<SpectralWaveletLabProps> = ({
  variable,
  region,
  spectral
}) => {
  const {
    dominantPeriodYears,
    dominantPeriodMonths,
    dominantBandName,
    psdSeries,
    waveletTimeline,
    ensoBandPowerPercent,
    qboBandPowerPercent,
    annualBandPowerPercent,
    decadalBandPowerPercent,
    scientificNarrative
  } = spectral;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-violet-700 uppercase tracking-wider font-semibold">
            <Radio className="w-3.5 h-3.5 text-violet-700" />
            <span>Fourier Power Spectral Density & Continuous Wavelet Transform</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Dominant Periodic Cycles & Atmospheric Oscillations in {region.name}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Separating non-seasonal multi-year recurrence modes (ENSO 3–7 yr, QBO 2–2.5 yr, Decadal) for {variable.name}.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 font-mono text-xs font-bold">
          <Activity className="w-4 h-4 text-violet-700" />
          <span>Peak Cycle: {dominantPeriodYears} yrs ({dominantBandName})</span>
        </div>
      </div>

      {/* Synthesis Narrative Banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start space-x-3">
        <Sparkles className="w-4 h-4 text-violet-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-800 leading-relaxed">
          <span className="font-bold text-violet-700 block mb-0.5">Spectral Periodicity Diagnostic:</span>
          <span>{scientificNarrative}</span>
        </div>
      </div>

      {/* Cycle Power Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">ENSO Band (3–7 yr)</div>
          <div className="text-lg font-mono font-bold text-sky-700 mt-1">
            {ensoBandPowerPercent}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pacific teleconnection</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Quasi-Biennial QBO (~2.2 yr)</div>
          <div className="text-lg font-mono font-bold text-violet-700 mt-1">
            {qboBandPowerPercent}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Stratospheric wind reversal</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Decadal Band (8–15 yr)</div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            {decadalBandPowerPercent}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pacific/Atlantic multidecadal</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Annual Harmonic (~1 yr)</div>
          <div className="text-lg font-mono font-bold text-emerald-700 mt-1">
            {annualBandPowerPercent}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Seasonal residual leakage</div>
        </div>
      </div>

      {/* Visualizations: Fourier PSD Spectrum & Wavelet Time Evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Fourier Power Spectral Density vs Period */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-900">
              Fourier Power Spectral Density (PSD) vs. Recurrence Period (Years)
            </span>
            <span className="text-[11px] font-mono text-violet-700">
              Dashed = 95% Red-Noise Null
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={psdSeries} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="periodYears"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Period (Years)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" P" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '10px' }} />

                {/* 95% Red-Noise Significance Limit */}
                <Line
                  type="monotone"
                  dataKey="significance95"
                  name="95% Markov Red-Noise Limit"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />

                {/* Fourier Power */}
                <Line
                  type="monotone"
                  dataKey="power"
                  name="Spectral Density Power"
                  stroke="#a855f7"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-1">
            Peaks rising above the red dashed line reflect statistically significant periodicities beyond red-noise persistence.
          </p>
        </div>

        {/* Wavelet Time Evolution of Power Bands */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-900">
              Wavelet Scalogram Band Power Evolution (full record)
            </span>
            <span className="text-[11px] font-mono text-sky-700">
              Tracking Non-Stationary Modes
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={waveletTimeline} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => (v.endsWith('-01') ? v.substring(0, 4) : '')}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '10px' }} />

                <Area type="monotone" dataKey="ensoPower" name="ENSO Band (3–7 yr)" stroke="#00b4d8" fill="#00b4d8" fillOpacity={0.3} />
                <Area type="monotone" dataKey="qboPower" name="QBO Band (~2.2 yr)" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
                <Area type="monotone" dataKey="decadalPower" name="Decadal Band" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-1">
            Shows how dominant atmospheric teleconnection frequencies wax and wane across climate regimes.
          </p>
        </div>
      </div>
    </div>
  );
};
