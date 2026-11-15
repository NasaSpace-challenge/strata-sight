import React from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck, History } from 'lucide-react';
import { DataProvenanceInfo } from '../types';
import { bannerClass } from './PageBanner';

/** Skeleton shown while a real series is being fetched. */
export const SeriesLoading: React.FC<{ label?: string }> = ({ label = 'Fetching real satellite & reanalysis data…' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-slate-600 text-sm">
      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      <span>{label}</span>
    </div>
    <div className="mt-5 space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-56 rounded-xl bg-slate-100" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 rounded-xl bg-slate-100" />
        <div className="h-16 rounded-xl bg-slate-100" />
        <div className="h-16 rounded-xl bg-slate-100" />
      </div>
    </div>
  </div>
);

/** Honest error card. StrataSight never substitutes synthetic data for a failed request. */
export const SeriesErrorCard: React.FC<{ message: string; onRetry?: () => void; hint?: string }> = ({
  message,
  onRetry,
  hint
}) => (
  <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm" role="alert">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">This data could not be retrieved</h3>
        <p className="text-sm text-slate-700">{message}</p>
        <p className="text-xs text-slate-500">
          {hint || 'No substitute or simulated values are shown. Try another variable or location, or retry.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

/** One-line provenance badge: where this series came from and how fresh it is. */
export const ProvenanceStrip: React.FC<{
  provenance: DataProvenanceInfo;
  lat: number;
  lon: number;
  global?: boolean;
}> = ({ provenance, lat, lon, global }) => {
  const cached = provenance.mode === 'CACHED_REAL';
  const fetched = provenance.fetchedAt ? new Date(provenance.fetchedAt).toLocaleDateString() : null;
  const latLabel = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonLabel = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  return (
    <div className={`${bannerClass(cached ? 'amber' : 'emerald')} rounded-2xl p-4 space-y-2`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${
            cached
              ? 'bg-white/90 text-amber-800 border-amber-300'
              : 'bg-white/90 text-emerald-800 border-emerald-300'
          }`}
        >
          {cached ? <History className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
          {cached ? 'SAVED REAL DATA' : 'REAL AGENCY DATA'}
        </span>
        <span className="text-slate-900 font-semibold">{provenance.product || provenance.sourceAgency}</span>
      </div>
      <p className="text-[11px] text-slate-700 leading-relaxed">
        {provenance.sourceAgency}
        {provenance.nativeResolution ? ` · native grid ${provenance.nativeResolution}` : ''}
        {provenance.recordStart && provenance.recordEnd ? ` · ${provenance.recordStart} → ${provenance.recordEnd}` : ''}
        {provenance.months ? ` (${provenance.months} months)` : ''}
        {global ? ' · global reference value (not location specific)' : ` · ${latLabel}, ${lonLabel}`}
      </p>
      <p className="text-[11px] text-slate-600 leading-relaxed">
        {provenance.interpolatedMonths
          ? `${provenance.interpolatedMonths} missing month(s) were linearly interpolated.`
          : 'No months were interpolated.'}
        {cached && provenance.staleReason ? ` Live service unavailable (${provenance.staleReason}); showing the last real download${fetched ? ` from ${fetched}` : ''}.` : ''}
        {!cached && fetched ? ` Retrieved ${fetched}.` : ''}
        {provenance.doi ? ` DOI: ${provenance.doi}.` : ''}
        {provenance.license ? ` License: ${provenance.license}.` : ''}
      </p>
      {provenance.caveat && <p className="text-[11px] text-amber-800">Note: {provenance.caveat}</p>}
    </div>
  );
};
