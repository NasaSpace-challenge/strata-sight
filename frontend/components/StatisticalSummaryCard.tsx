import React from 'react';
import { StatisticalAnalysisResult } from '../types';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertTriangle,
  ShieldCheck,
  Gauge,
  Activity
} from 'lucide-react';

interface StatisticalSummaryCardProps {
  stats: StatisticalAnalysisResult;
  regionName: string;
  variableName: string;
}

export const StatisticalSummaryCard: React.FC<StatisticalSummaryCardProps> = ({
  stats,
  regionName,
  variableName
}) => {
  const getBadgeStyle = () => {
    switch (stats.significanceCategory) {
      case 'HIGHLY_SIGNIFICANT':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          label: 'Highly Significant (Hamed-Rao p* < 0.01)',
          confidence: '> 99% Serial-Correlation-Verified Confidence'
        };
      case 'SIGNIFICANT':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />,
          label: 'Statistically Significant (p* < 0.05)',
          confidence: '> 95% NASA / KNMI Climate Confidence'
        };
      case 'EMERGING':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
          label: stats.isAutocorrelationDeflated
            ? 'Red-Noise Deflated (Naive p < 0.05 → p* ≥ 0.05)'
            : 'Emerging Trend (Underpowered / Developing)',
          confidence: `Power: ${stats.statisticalPowerPercent}% • Emergence ~${stats.timeOfEmergenceYears} yrs`
        };
      case 'NOT_SIGNIFICANT':
      default:
        return {
          bg: 'bg-slate-100 border-slate-200 text-slate-700',
          icon: <HelpCircle className="w-5 h-5 text-slate-500" />,
          label: 'No Significant Trend (p* ≥ 0.15)',
          confidence: 'Consistent with Natural Climate Variability'
        };
    }
  };

  const badge = getBadgeStyle();
  const cp = stats.changepoint;
  const fmtP = (p: number) => (p <= 0.0001 ? '< 0.0001' : p.toFixed(4));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-4">
      {/* Top Banner with Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
            Multi-Method NASA / KNMI / KRISS Trend & Significance Diagnostic
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2 mt-0.5">
            <span>{regionName}</span>
            <span className="text-slate-400 text-sm font-normal">• {variableName}</span>
          </h3>
        </div>

        <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border ${badge.bg}`}>
          {badge.icon}
          <div>
            <div className="text-xs font-bold leading-tight">{badge.label}</div>
            <div className="text-[10px] opacity-80">{badge.confidence}</div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Rate of Change + Sen's 95% CI */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
            {stats.direction === 'INCREASING' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
            {stats.direction === 'DECREASING' && <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
            {stats.direction === 'STABLE' && <Minus className="w-3.5 h-3.5 text-slate-400" />}
            <span>OLS & Theil–Sen Slope</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold mt-1 text-slate-900">
            {stats.slopePerDecade > 0 ? `+${stats.slopePerDecade}` : stats.slopePerDecade}{' '}
            <span className="text-xs font-normal text-slate-500">{stats.unit}/dec</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Sen: {stats.sensSlopePerDecade > 0 ? `+${stats.sensSlopePerDecade}` : stats.sensSlopePerDecade} [
            {stats.sensCiLowerPerDecade}, {stats.sensCiUpperPerDecade}]
          </div>
        </div>

        {/* Hamed-Rao Autocorrelation-Adjusted Mann-Kendall */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Hamed–Rao MK (p*)</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold mt-1 text-slate-900">
            {fmtP(stats.hamedRaoMkPValue)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Z* = {stats.hamedRaoMkZ} • Naive p = {fmtP(stats.mkPValue)}
          </div>
        </div>

        {/* Hirsch Seasonal Mann-Kendall */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Seasonal MK (Hirsch)</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold mt-1 text-indigo-700">
            {fmtP(stats.seasonalMkPValue)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Z_seas = {stats.seasonalMkZ} • Slope {stats.seasonalSensSlopePerDecade > 0 ? `+${stats.seasonalSensSlopePerDecade}` : stats.seasonalSensSlopePerDecade}/dec
          </div>
        </div>

        {/* Statistical Power & Time of Emergence (Weatherhead / Statsig) */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            <span>Power (1−β) & Emergence</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold mt-1 text-slate-900">
            {stats.statisticalPowerPercent}%{' '}
            <span className="text-xs font-normal text-slate-500">power</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            ToE: ~{stats.timeOfEmergenceYears} yrs (Record: {stats.timeRangeYears} yrs)
          </div>
        </div>
      </div>

      {/* Secondary Rigor Strip: Santer Effective Sample Size, OLS R², and ADF Unit-Root Test */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 block">
              Santer Serial Memory (AR1)
            </span>
            <span className="font-semibold text-slate-800">
              Lag-1 r₁ = {stats.lag1Autocorrelation} → N_eff = {stats.effectiveSampleSize} / {stats.sampleSize}
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            t* = {stats.adjustedTStat}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 block">
              Parametric Regression & Net Δ
            </span>
            <span className="font-semibold text-slate-800">
              R² = {(stats.rSquared * 100).toFixed(1)}% • Δ = {stats.totalChange > 0 ? `+${stats.totalChange}` : stats.totalChange} {stats.unit}
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            p* = {fmtP(stats.adjustedPValueTTest)}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 block">
              ADF Unit-Root Test (KRISS)
            </span>
            <span className="font-semibold text-slate-800">
              τ = {stats.adfStatistic} (5% Crit: {stats.adfCriticalValue5Pct})
            </span>
          </div>
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
              stats.isTrendStationary
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {stats.isTrendStationary ? 'Trend-Stationary' : 'Stochastic Memory'}
          </span>
        </div>
      </div>

      {/* Pettitt Changepoint & Regime Shift Panel */}
      {cp && cp.hasChangepoint && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-slate-700">
          <div className="flex items-center space-x-2 text-amber-800 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Pettitt Structural Break Detected: Regime Shift in {cp.date}</span>
          </div>
          <p className="text-slate-600 text-xs leading-relaxed">{cp.interpretation}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2 border-t border-amber-200/60 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Pre-Shift Mean</span>
              <span className="text-slate-900 font-bold">
                {cp.preMean} {stats.unit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Post-Shift Mean</span>
              <span className="text-slate-900 font-bold">
                {cp.postMean} {stats.unit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Pre-Shift Slope</span>
              <span className="text-slate-900 font-bold">{cp.preSlopePerDecade}/dec</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Post-Shift Slope</span>
              <span className="text-slate-900 font-bold">{cp.postSlopePerDecade}/dec</span>
            </div>
          </div>
        </div>
      )}

      {/* Explanatory Detective Note */}
      <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-3.5 text-xs text-slate-700 flex items-start space-x-2.5">
        <Award className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-900">Detective Conclusion: </span>
          <span>{stats.verdictText}</span>
          <span className="block mt-1 text-[11px] text-slate-500">
            *{stats.stationarityVerdict} Deseasonalized against {stats.baselineUsed} climatology prior to Hamed–Rao (1998) & Santer (2000) serial-correlation adjustment.
          </span>
        </div>
      </div>
    </div>
  );
};
