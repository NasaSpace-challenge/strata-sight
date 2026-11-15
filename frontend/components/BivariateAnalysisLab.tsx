import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { EarthVariable, RegionHotspot, BivariateCorrelationResult } from '../types';
import { NASA_VARIABLES } from '../services/earthScienceData';
import { GitCompare, Clock, Zap, ArrowRight, HelpCircle } from 'lucide-react';

interface BivariateAnalysisLabProps {
  primaryVariable: EarthVariable;
  secondaryVariable: EarthVariable;
  onSecondaryVariableChange: (v: EarthVariable) => void;
  /** Variables that can currently be loaded (defaults to the full catalog). */
  variables?: EarthVariable[];
  region: RegionHotspot;
  correlation: BivariateCorrelationResult;
}

export const BivariateAnalysisLab: React.FC<BivariateAnalysisLabProps> = ({
  primaryVariable,
  secondaryVariable,
  onSecondaryVariableChange,
  variables,
  region,
  correlation
}) => {
  const choices = (variables ?? NASA_VARIABLES).filter(v => v.id !== primaryVariable.id);
  const {
    pearsonR,
    pearsonPValue,
    spearmanRho,
    spearmanPValue,
    rSquared,
    optimalLagMonths,
    optimalLagCorrelation,
    leadLagSeries,
    scatterData,
    relationshipNarrative
  } = correlation;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header and Secondary Variable Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-sky-700 uppercase tracking-wider font-semibold">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Bivariate Climate Coupling & Lead-Lag Diagnostic</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Cross-Correlation: {primaryVariable.shortCode} vs. {secondaryVariable.shortCode} in {region.name}
          </h3>
        </div>

        {/* Secondary Variable Selector */}
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <span className="text-xs font-mono text-slate-600 flex-shrink-0">Pair Variable:</span>
          <select
            value={secondaryVariable.id}
            onChange={e => {
              const match = choices.find(v => v.id === e.target.value);
              if (match) onSecondaryVariableChange(match);
            }}
            className="min-w-0 flex-1 max-w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-sky-700 font-semibold focus:outline-none focus:border-blue-500"
          >
            {choices.map(v => (
              <option key={v.id} value={v.id} disabled={v.id === primaryVariable.id}>
                {v.name} ({v.shortCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Narrative Synthesis Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start space-x-3">
        <Zap className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-800 leading-relaxed">
          <span className="font-bold text-sky-700 block mb-0.5">Physical Coupling Insight:</span>
          <span>{relationshipNarrative}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Pearson r (Lag 0)</div>
          <div className="text-lg font-mono font-bold text-sky-700 mt-1">
            {pearsonR > 0 ? `+${pearsonR}` : pearsonR}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">p = {pearsonPValue}</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Spearman Rank ρ</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">
            {spearmanRho > 0 ? `+${spearmanRho}` : spearmanRho}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">p = {spearmanPValue}</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Optimal Lag</div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            {optimalLagMonths === 0
              ? 'Synchronous (0 mo)'
              : optimalLagMonths < 0
              ? `${Math.abs(optimalLagMonths)} mo Lead`
              : `${optimalLagMonths} mo Lag`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Peak r = {optimalLagCorrelation}</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Shared Variance (R²)</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">
            {(rSquared * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Linear covariance</div>
        </div>
      </div>

      {/* Visualizations: Bivariate Scatter and Lead-Lag Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scatter Plot */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-900">
              Bivariate Anomaly Scatter ({primaryVariable.shortCode} vs {secondaryVariable.shortCode})
            </span>
            <span className="text-[11px] font-mono text-sky-700">R² = {rSquared}</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="xAnomaly"
                  name={primaryVariable.shortCode}
                  unit={` ${primaryVariable.unit}`}
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="yAnomaly"
                  name={secondaryVariable.shortCode}
                  unit={` ${secondaryVariable.unit}`}
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }}
                />
                <Scatter data={scatterData} fill="#00b4d8" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <span className="text-[10px] text-slate-600 block text-center mt-1">
            Each point represents one month's deseasonalized anomalies.
          </span>
        </div>

        {/* Lead-Lag Cross-Correlation Curve */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-900">
              Lead-Lag Cross-Correlation Curve (Lag -12 to +12 Months)
            </span>
            <span className="text-[11px] font-mono text-amber-700">
              Peak: {optimalLagMonths} mo
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadLagSeries} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="lagMonths"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Lag (Months): Negative = Primary Leads', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis
                  domain={[-1, 1]}
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  unit=" r"
                />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <ReferenceLine x={0} stroke="#475569" strokeDasharray="3 3" />
                <ReferenceLine x={optimalLagMonths} stroke="#f59e0b" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="correlation" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <span className="text-[10px] text-slate-600 block text-center mt-1">
            Peaks indicate optimal response delay (e.g. rain anomalies preceding soil moisture or vegetation growth).
          </span>
        </div>
      </div>
    </div>
  );
};
