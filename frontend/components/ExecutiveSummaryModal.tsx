import React from 'react';
import {
  EarthVariable,
  RegionHotspot,
  StatisticalAnalysisResult,
  TimeSeriesPoint,
  MarineHeatwaveAnalysis,
  CompoundExtremeAnalysis
} from '../types';
import { formatCoords } from '../services/earthScienceData';
import { useBestSnapshot } from '../hooks/useBestSnapshot';
import { formatDay } from '../services/earthView';
import { Download, Printer, X, ShieldCheck, Award, FileText, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';

interface ExecutiveSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  variable: EarthVariable;
  region: RegionHotspot;
  stats: StatisticalAnalysisResult;
  points: TimeSeriesPoint[];
  heatwaveAnalysis: MarineHeatwaveAnalysis | null;
  compoundAnalysis: CompoundExtremeAnalysis | null;
  provenanceLine?: string;
  /** Embed a recent NASA satellite picture of the region (not meaningful for global series) */
  showSatellite?: boolean;
}

const SatelliteFigure: React.FC<{ lat: number; lon: number; name: string }> = ({ lat, lon, name }) => {
  const snap = useBestSnapshot(lat, lon, true, 100, 640);
  if (snap.status === 'error' || snap.status === 'idle') return null;
  return (
    <figure className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 break-inside-avoid">
      {snap.url && snap.best ? (
        <img src={snap.url} alt={`NASA Terra satellite picture of ${name}`} className="w-full max-h-72 object-cover" />
      ) : (
        <div className="h-40 flex items-center justify-center text-xs text-slate-400">Loading satellite picture…</div>
      )}
      {snap.best && snap.layer && (
        <figcaption className="px-4 py-2 text-[11px] text-slate-500">
          {name} from space: NASA {snap.layer.sensor}, {snap.layer.resolution} per pixel, {formatDay(snap.best.date)} (about {snap.best.cloudPct}% cloud, estimated). Shows the place on that day; it is not evidence of a trend.
        </figcaption>
      )}
    </figure>
  );
};

export const ExecutiveSummaryModal: React.FC<ExecutiveSummaryModalProps> = ({
  isOpen,
  onClose,
  variable,
  region,
  stats,
  points,
  heatwaveAnalysis,
  compoundAnalysis,
  provenanceLine,
  showSatellite
}) => {
  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const headers = ['Date', 'Year', 'Month', 'Raw_Value', 'Climatology_Mean', 'Anomaly', 'Z_Score', 'Trendline', 'Unit'];
    const rows = points.map(p => [
      p.date,
      p.year,
      p.month,
      p.raw,
      p.climatology,
      p.anomaly,
      p.zScore,
      p.trend,
      variable.unit
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StrataSight_${variable.shortCode.replace(/\s+/g, '_')}_${region.id}_${stats.startDate}_${stats.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-elevated overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900">NASA Earth Science Technical Briefing</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  OFFICIAL SYNTHESIS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Synthesis Report for {region.name} • {variable.name} ({stats.startDate} to {stats.endDate})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-sm transition-colors"
              title="Download full monthly CSV time series"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-sm transition-colors"
              title="Print formatted briefing dossier"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm">
          {/* Header Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">MISSION / SENSOR</span>
              <span className="text-slate-900 font-bold">{variable.instrumentOrModel}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">GEOGRAPHIC BIOME</span>
              <span className="text-blue-700 font-bold">{region.biome}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">COORDINATES</span>
              <span className="text-slate-700">{formatCoords(region.coordinates.lat, region.coordinates.lon)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">RECORD DURATION</span>
              <span className="text-amber-700 font-bold">{stats.timeRangeYears} Years ({stats.sampleSize} mo)</span>
            </div>
          </div>

          {showSatellite && <SatelliteFigure lat={region.coordinates.lat} lon={region.coordinates.lon} name={region.name} />}

          {/* Section 1: Trend & Statistical Significance */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-blue-700 font-bold flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-blue-600" />
              <span>1. Long-Term Multi-Decadal Trend & Significance</span>
            </h4>
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-2">
              <p className="text-slate-700 leading-relaxed">
                Linear Ordinary Least Squares (OLS) regression indicates a decadal rate of{' '}
                <strong className="text-slate-900 font-mono">{stats.slopePerDecade > 0 ? `+${stats.slopePerDecade}` : stats.slopePerDecade} {stats.unit}/decade</strong>{' '}
                (Sen's slope: {stats.sensSlope > 0 ? `+${stats.sensSlope}` : stats.sensSlope}/yr), resulting in an accumulated shift of{' '}
                <strong className="text-blue-700 font-mono">{stats.totalChange > 0 ? `+${stats.totalChange}` : stats.totalChange} {stats.unit}</strong>{' '}
                relative to the {stats.baselineUsed} reference climatology baseline.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Mann-Kendall p</span>
                  <span className="text-emerald-600 font-bold">{stats.mkPValue < 0.0001 ? '< 0.0001' : stats.mkPValue}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">MK Z-Score</span>
                  <span className="text-slate-900 font-bold">{stats.mkZScore}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Regression R²</span>
                  <span className="text-slate-900 font-bold">{(stats.rSquared * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Confidence Level</span>
                  <span className="text-blue-700 font-bold">{stats.significanceCategory.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pettitt Structural Break */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-amber-700 font-bold flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>2. Abrupt Regime Shifts (Pettitt Changepoint Test)</span>
            </h4>
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200">
              <p className="text-slate-700 leading-relaxed">
                {stats.changepoint.interpretation}
              </p>
            </div>
          </div>

          {/* Section 3: Extreme months (above the 90th percentile of each calendar month) */}
          {heatwaveAnalysis && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-rose-700 font-bold flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-rose-600" />
              <span>3. Extreme Months (above the 90th percentile of each calendar month)</span>
            </h4>
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-2">
              <p className="text-slate-700 leading-relaxed">
                {heatwaveAnalysis.narrative}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Events</span>
                  <span className="text-slate-900 font-bold">{heatwaveAnalysis.totalEvents} episodes</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Max Duration</span>
                  <span className="text-amber-700 font-bold">{heatwaveAnalysis.longestEventDuration} months</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Peak Intensity</span>
                  <span className="text-rose-700 font-bold">+{heatwaveAnalysis.maxIntensityAnomaly} {variable.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Cat III/IV Tiers</span>
                  <span className="text-rose-700 font-bold">{heatwaveAnalysis.categoryBreakdown.severe + heatwaveAnalysis.categoryBreakdown.extreme} events</span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Section 5: data provenance (replaces the removed projection section; StrataSight makes no forecasts) */}
          {provenanceLine && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>4. Data Provenance</span>
              </h4>
              <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-700 leading-relaxed">{provenanceLine}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Generated by StrataSight • 2026 NASA Space Apps Challenge Official Entry</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors"
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  );
};
