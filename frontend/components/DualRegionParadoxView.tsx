import React, { useMemo, useState } from 'react';
import { bannerClass } from './PageBanner';
import { NASA_VARIABLES, PLANETARY_HOTSPOTS, DEMO_CASE_STUDIES } from '../services/earthScienceData';
import { processMonthlyTimeSeries } from '../services/statisticsEngine';
import { useRealSeries } from '../hooks/useRealSeries';
import { TimeSeriesChart } from './TimeSeriesChart';
import { StatisticalSummaryCard } from './StatisticalSummaryCard';
import { VariableCard } from './VariableCard';
import { VerdictCard } from './VerdictCard';
import { useAiAssistant, useRegisterAiContext } from './ai/AiAssistantContext';
import { ProvenanceStrip, SeriesErrorCard, SeriesLoading } from './DataStatus';
import { Sparkles, Split } from 'lucide-react';

const PARADOX_CASES = DEMO_CASE_STUDIES.filter(cs => cs.secondaryRegionId);

interface ParadoxProps {
  initialCaseId?: string;
  plainEnglish: boolean;
  onTogglePlain: (plain: boolean) => void;
}

export const DualRegionParadoxView: React.FC<ParadoxProps> = ({ initialCaseId, plainEnglish, onTogglePlain }) => {
  const [activeCaseStudy, setActiveCaseStudy] = useState(
    PARADOX_CASES.find(c => c.id === initialCaseId) || PARADOX_CASES[0]
  );

  const selectedVariable = NASA_VARIABLES.find(v => v.id === activeCaseStudy.variableId) || NASA_VARIABLES[0];
  const regionA = PLANETARY_HOTSPOTS.find(r => r.id === activeCaseStudy.primaryRegionId) || PLANETARY_HOTSPOTS[0];
  const regionB = PLANETARY_HOTSPOTS.find(r => r.id === activeCaseStudy.secondaryRegionId) || PLANETARY_HOTSPOTS[1];

  // Two REAL series, fetched in parallel (cached server-side and client-side)
  const seriesA = useRealSeries(selectedVariable.id, regionA.coordinates.lat, regionA.coordinates.lon);
  const seriesB = useRealSeries(selectedVariable.id, regionB.coordinates.lat, regionB.coordinates.lon);

  const resultA = useMemo(
    () => (seriesA.data ? processMonthlyTimeSeries(seriesA.data.dates, seriesA.data.values, selectedVariable.unit) : null),
    [seriesA.data, selectedVariable.unit]
  );
  const resultB = useMemo(
    () => (seriesB.data ? processMonthlyTimeSeries(seriesB.data.dates, seriesB.data.values, selectedVariable.unit) : null),
    [seriesB.data, selectedVariable.unit]
  );

  const ai = useAiAssistant();
  const aiContext = useMemo(
    () =>
      resultA && resultB
        ? { variable: selectedVariable, region: regionA, stats: resultA.stats, comparisonRegion: regionB, comparisonStats: resultB.stats }
        : null,
    [resultA, resultB, selectedVariable, regionA, regionB]
  );
  useRegisterAiContext('compare', aiContext);

  return (
    <div className="space-y-6 py-2">
      {/* Banner */}
      <div className={`${bannerClass('violet')} rounded-2xl p-6`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/85 border border-violet-200 text-violet-800 text-xs font-mono mb-2 font-semibold shadow-sm">
              <Split className="w-3.5 h-3.5 text-violet-600" />
              <span>Dual-Region Paradox Mode</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {activeCaseStudy.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
              {activeCaseStudy.paradoxLesson}
            </p>
            {aiContext && (
              <button
                onClick={() => ai.ask()}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
              >
                <Sparkles className="w-4 h-4" /> Ask AI why these two differ
              </button>
            )}
          </div>

          {/* Quick presets switch */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
              Select Paradox Case:
            </span>
            <div className="flex flex-wrap gap-2">
              {PARADOX_CASES.map(cs => (
                <button
                  key={cs.id}
                  onClick={() => setActiveCaseStudy(cs)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    activeCaseStudy.id === cs.id
                      ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cs.title.split(':')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Variable Profile */}
      <VariableCard variable={selectedVariable} compact={false} />

      {(seriesA.status === 'loading' || seriesB.status === 'loading') && <SeriesLoading />}
      {seriesA.status === 'error' && <SeriesErrorCard message={`${regionA.name}: ${seriesA.error}`} onRetry={seriesA.retry} />}
      {seriesB.status === 'error' && <SeriesErrorCard message={`${regionB.name}: ${seriesB.error}`} onRetry={seriesB.retry} />}

      {resultA && resultB && seriesA.data && (
        <>
          <ProvenanceStrip
            provenance={seriesA.data.provenance}
            lat={regionA.coordinates.lat}
            lon={regionA.coordinates.lon}
            global={selectedVariable.scope === 'global'}
          />
          {/* Answer first: one verdict per region */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { r: regionA, res: resultA, ser: seriesA, color: 'bg-blue-600', text: 'text-blue-700', tag: 'Region A' },
              { r: regionB, res: resultB, ser: seriesB, color: 'bg-amber-500', text: 'text-amber-700', tag: 'Region B' }
            ].map(({ r, res, ser, color, text, tag }) => (
              <div key={tag} className="space-y-2">
                <div className={`flex items-center space-x-2 text-xs font-mono ${text} font-bold px-1`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
                  <span>
                    {tag}: {r.name}
                  </span>
                </div>
                <VerdictCard
                  compact
                  stats={res.stats}
                  variable={selectedVariable}
                  regionLabel={r.name}
                  points={res.points}
                  provenance={ser.data?.provenance}
                  isGlobal={selectedVariable.scope === 'global'}
                  plainEnglish={plainEnglish}
                  onTogglePlain={onTogglePlain}
                />
              </div>
            ))}
          </div>

          {/* Dual Comparative Chart */}
          <TimeSeriesChart
            points={resultA.points}
            unit={selectedVariable.unit}
            variableName={selectedVariable.name}
            regionName={regionA.name}
            baseline="1991-2020"
            onBaselineChange={() => {}}
            anomalyMode="PHYSICAL"
            onAnomalyModeChange={() => {}}
            secondaryPoints={resultB.points}
            secondaryRegionName={regionB.name}
          />

          {/* Side-By-Side Statistical Comparisons */}
          {!plainEnglish && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-blue-700 font-bold px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Region A: {regionA.name}</span>
              </div>
              <StatisticalSummaryCard
                stats={resultA.stats}
                regionName={regionA.name}
                variableName={selectedVariable.name}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-amber-700 font-bold px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Region B: {regionB.name}</span>
              </div>
              <StatisticalSummaryCard
                stats={resultB.stats}
                regionName={regionB.name}
                variableName={selectedVariable.name}
              />
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
};
