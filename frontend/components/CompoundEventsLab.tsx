import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';
import { RegionHotspot, CompoundExtremeAnalysis } from '../types';
import { Flame, AlertOctagon, TrendingUp, Calendar, ShieldAlert } from 'lucide-react';

interface CompoundEventsLabProps {
  region: RegionHotspot;
  analysis: CompoundExtremeAnalysis;
}

export const CompoundEventsLab: React.FC<CompoundEventsLabProps> = ({ region, analysis }) => {
  const {
    totalCompoundMonths,
    compoundFrequencyPercent,
    meanReturnPeriodYears,
    worstEvent,
    decadalCounts,
    events,
    bivariateQuadrantDistribution
  } = analysis;

  const quadrantChartData = [
    { name: 'Concurrent Hot & Dry (Compound Extreme)', count: bivariateQuadrantDistribution.hotAndDry, fill: '#ef4444' },
    { name: 'Hot & Wet', count: bivariateQuadrantDistribution.hotAndWet, fill: '#f59e0b' },
    { name: 'Cold & Dry', count: bivariateQuadrantDistribution.coldAndDry, fill: '#3b82f6' },
    { name: 'Cold & Wet', count: bivariateQuadrantDistribution.coldAndWet, fill: '#10b981' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-rose-700 uppercase tracking-wider font-semibold">
            <Flame className="w-3.5 h-3.5" />
            <span>Compound Extreme Hot-and-Dry Event Engine</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Concurrent Hot & Dry Extremes (Temp &gt; +1.5σ & Soil Moisture &lt; -1.5σ) in {region.name}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Evaluates the compounded feedback between surface air temperature spikes and root-zone water depletion.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-bold">
          <AlertOctagon className="w-4 h-4 text-rose-700" />
          <span>{totalCompoundMonths} Compound Months Detected</span>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Total Compound Months</div>
          <div className="text-lg font-mono font-bold text-rose-700 mt-1">
            {totalCompoundMonths} months
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{compoundFrequencyPercent}% of recorded time</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Empirical Return Period</div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            1 in {meanReturnPeriodYears} yrs
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Joint return frequency</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Worst Compound Episode</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">
            {worstEvent ? worstEvent.date : 'None'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {worstEvent ? `Severity: ${worstEvent.severityScore}σ` : 'No severe events'}
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Most recent decade</div>
          <div className="text-lg font-mono font-bold text-sky-700 mt-1">
            {decadalCounts[decadalCounts.length - 1]?.count || 0} events
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {decadalCounts[decadalCounts.length - 1]?.decade} vs {decadalCounts[0]?.count || 0} in {decadalCounts[0]?.decade}
          </div>
        </div>
      </div>

      {/* Visualizations: Bivariate Quadrants & Decadal Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quadrant Frequency Bar Chart */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-900">
              Bivariate Climate Extremes Quadrant Breakdown (Months)
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quadrantChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} interval={0} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-1">
            Red bar highlights concurrent extremes causing wildfire, agricultural crop failure, and heat illness.
          </p>
        </div>

        {/* Decadal Trend of Compound Extremes */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-900">
              Decadal Frequency of Compound Hot & Dry Extremes
            </span>
            <span className="text-rose-700 font-mono text-[11px] font-bold">Trending Upward</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decadalCounts} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="decade" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-1">
            Shows whether compound dry-heat episodes are accelerating across modern satellite record decades.
          </p>
        </div>
      </div>

      {/* Historical Compound Events Timeline List */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            <span>Documented Historical Compound Extremes Log ({events.length} total)</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Sorted chronologically</span>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">No concurrent extremes exceeding ±1.5σ in this record.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {events.map((ev, idx) => (
              <div key={idx} className="bg-white p-2.5 rounded-lg border border-rose-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-rose-700">{ev.date}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
                    {ev.category.replace('_HOT_DRY', '')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 flex justify-between font-mono">
                  <span>Temp: +{ev.tempZScore}σ</span>
                  <span className="text-amber-700">Soil: {ev.soilMoistZScore}σ</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
