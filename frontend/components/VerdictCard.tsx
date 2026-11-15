import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, MapPin, Ruler, ShieldCheck, Sparkles } from 'lucide-react';
import { DataProvenanceInfo, EarthVariable, StatisticalAnalysisResult, TimeSeriesPoint } from '../types';
import { buildVerdict, Confidence } from '../services/verdict';

interface VerdictCardProps {
  stats: StatisticalAnalysisResult;
  variable: EarthVariable;
  regionLabel: string;
  points: TimeSeriesPoint[];
  provenance?: DataProvenanceInfo | null;
  isGlobal?: boolean;
  plainEnglish: boolean;
  onTogglePlain: (plain: boolean) => void;
  /** Smaller layout for side-by-side comparisons */
  compact?: boolean;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
}

const CONFIDENCE_STYLE: Record<Confidence, { label: string; bar: string; chip: string; filled: number }> = {
  VERY_HIGH: { label: 'Very likely real', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', filled: 4 },
  HIGH: { label: 'Probably real', bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-800 border-blue-200', filled: 3 },
  LOW: { label: 'Not convincing', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', filled: 2 },
  NONE: { label: 'No evidence of a trend', bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 border-slate-200', filled: 1 }
};

export const VerdictCard: React.FC<VerdictCardProps> = ({
  stats,
  variable,
  regionLabel,
  points,
  provenance,
  isGlobal,
  plainEnglish,
  onTogglePlain,
  compact,
  actions
}) => {
  const v = useMemo(
    () => buildVerdict(stats, variable, regionLabel, points, provenance, isGlobal),
    [stats, variable, regionLabel, points, provenance, isGlobal]
  );
  const style = CONFIDENCE_STYLE[v.confidence];
  const Arrow = v.direction === 'UP' ? ArrowUpRight : v.direction === 'DOWN' ? ArrowDownRight : ArrowRight;
  const arrowColor =
    v.direction === 'FLAT' ? 'text-slate-500 bg-slate-100' : v.direction === 'UP' ? 'text-orange-600 bg-orange-50' : 'text-sky-600 bg-sky-50';

  return (
    <section
      aria-label="Verdict"
      className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden"
    >
      <div className={`p-5 ${compact ? 'sm:p-5' : 'sm:p-6'} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${arrowColor}`}>
              <Arrow className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">The answer</div>
              <h3 className={`${compact ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-slate-900 leading-snug`}>{v.headline}</h3>
            </div>
          </div>

          <div className="flex-shrink-0 self-start inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold" role="group" aria-label="Explanation level">
            <button
              onClick={() => onTogglePlain(true)}
              aria-pressed={plainEnglish}
              className={`px-2.5 py-1 rounded-md ${plainEnglish ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Plain English
            </button>
            <button
              onClick={() => onTogglePlain(false)}
              aria-pressed={!plainEnglish}
              className={`px-2.5 py-1 rounded-md ${!plainEnglish ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Technical
            </button>
          </div>
        </div>

        {/* Confidence meter */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map(i => (
              <span key={i} className={`h-2 w-8 rounded-full ${i <= style.filled ? style.bar : 'bg-slate-200'}`} />
            ))}
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${style.chip}`}>{style.label}</span>
        </div>

        <dl className={`grid ${compact ? 'grid-cols-1' : 'md:grid-cols-2'} gap-3`}>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              <Info className="w-3.5 h-3.5" /> What is changing
            </dt>
            <dd className="text-sm text-slate-800 mt-1 leading-relaxed">{v.what}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              <MapPin className="w-3.5 h-3.5" /> Where
            </dt>
            <dd className="text-sm text-slate-800 mt-1 leading-relaxed">{v.where}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              <Ruler className="w-3.5 h-3.5" /> How much
            </dt>
            <dd className="text-sm text-slate-800 mt-1 leading-relaxed">{v.howMuch}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Is it real?
            </dt>
            <dd className="text-sm text-slate-800 mt-1 leading-relaxed">{v.isItReal}</dd>
          </div>
        </dl>

        {!plainEnglish && (
          <p className="text-[11px] font-mono text-slate-600 bg-slate-900/[0.03] border border-slate-200 rounded-lg p-3 leading-relaxed">
            {v.technical}
          </p>
        )}

        {v.caution.length > 0 && (
          <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
            {v.caution.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                className={
                  a.primary
                    ? 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50'
                }
              >
                {a.primary && <Sparkles className="w-3.5 h-3.5" />}
                {a.label}
                {!a.primary && ' →'}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
