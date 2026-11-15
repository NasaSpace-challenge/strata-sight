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
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';
import {
  EarthVariable,
  RegionHotspot,
  MarineHeatwaveAnalysis,
  HeatwaveCategory
} from '../types';
import {
  ThermometerSnowflake,
  Flame,
  AlertTriangle,
  Calendar,
  Layers,
  Award,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

interface MarineHeatwaveLabProps {
  variable: EarthVariable;
  region: RegionHotspot;
  analysis: MarineHeatwaveAnalysis;
}

export const MarineHeatwaveLab: React.FC<MarineHeatwaveLabProps> = ({
  variable,
  region,
  analysis
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const {
    totalEvents,
    totalMhwMonths,
    longestEventDuration,
    meanEventDuration,
    maxIntensityAnomaly,
    categoryBreakdown,
    events,
    points,
    narrative
  } = analysis;

  const categoryBarData = [
    { name: 'Cat I Moderate', count: categoryBreakdown.moderate, fill: '#eab308' },
    { name: 'Cat II Strong', count: categoryBreakdown.strong, fill: '#f97316' },
    { name: 'Cat III Severe', count: categoryBreakdown.severe, fill: '#ef4444' },
    { name: 'Cat IV Extreme', count: categoryBreakdown.extreme, fill: '#7f1d1d' }
  ];

  const filteredEvents = events.filter(ev => {
    if (selectedCategoryFilter === 'ALL') return true;
    return ev.category === selectedCategoryFilter;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-amber-700 uppercase tracking-wider font-semibold">
            <Flame className="w-3.5 h-3.5 text-amber-700" />
            <span>Extreme-Month Detection (monthly 90th-percentile exceedance)</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Thermal Heatwaves: 90th-Percentile Climatology Exceedances in {region.name}
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Tracking duration, peak temperature departure, and Category I–IV severity tiers for {variable.name} ({variable.unit}).
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-mono text-xs font-bold">
          <ThermometerSnowflake className="w-4 h-4 text-amber-700" />
          <span>{totalEvents} Discrete Heatwave Events</span>
        </div>
      </div>

      {/* Narrative Synthesis Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
        <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-800 leading-relaxed">
          <span className="font-bold text-amber-700 block mb-0.5">Extreme-Month Diagnostic:</span>
          <span>{narrative}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Total Heatwave Months</div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">
            {totalMhwMonths} months
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across {totalEvents} events</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Longest Event Duration</div>
          <div className="text-lg font-mono font-bold text-rose-700 mt-1">
            {longestEventDuration} months
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Mean: {meanEventDuration} months</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Peak Thermal Departure</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-1">
            +{maxIntensityAnomaly} {variable.unit}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Maximum intensity</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] text-slate-600">Severe / Extreme Events</div>
          <div className="text-lg font-mono font-bold text-rose-700 mt-1">
            {categoryBreakdown.severe + categoryBreakdown.extreme} events
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Cat III & Cat IV tiers</div>
        </div>
      </div>

      {/* Main Heatwave Chart: Raw Temperature, Climatology Mean, and 90th Percentile Threshold */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-bold text-slate-900">
            Observed Temperature vs. 90th-Percentile Baseline Threshold (2000–2024)
          </span>
          <span className="text-[11px] font-mono text-amber-700">
            Yellow/Orange/Red = Active Heatwave Exceedance
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => (v.endsWith('-01') ? v.substring(0, 4) : '')}
              />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} unit={` ${variable.unit}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '11px',
                  borderRadius: '8px'
                }}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />

              {/* Climatology Mean */}
              <Line
                type="monotone"
                dataKey="climatology"
                name="Climatology Mean Baseline"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />

              {/* 90th Percentile Threshold */}
              <Line
                type="monotone"
                dataKey="threshold90th"
                name="90th-Percentile MHW Threshold"
                stroke="#38bdf8"
                strokeWidth={1.8}
                dot={false}
              />

              {/* Raw Temperature */}
              <Line
                type="monotone"
                dataKey="raw"
                name={`Observed ${variable.shortCode}`}
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-600 text-center mt-2">
          Points above the blue line exceed the 90th percentile of that calendar month across the record. This adapts the Hobday et al. (2016) threshold idea to monthly data, so it detects extreme MONTHS, not multi-day heatwaves.
        </p>
      </div>

      {/* Severity Tiers & Historical Events Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Breakdown Bar Chart */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-bold text-slate-900">
              Severity Tier Distribution (multiples of the 90th-percentile excess)
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: '11px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Events Log */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Cataloged Heatwave Episodes ({filteredEvents.length})</span>
            </span>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="CAT_I_MODERATE">Cat I Moderate</option>
              <option value="CAT_II_STRONG">Cat II Strong</option>
              <option value="CAT_III_SEVERE">Cat III Severe</option>
              <option value="CAT_IV_EXTREME">Cat IV Extreme</option>
            </select>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No events match filter.</p>
            ) : (
              filteredEvents.map(ev => (
                <div key={ev.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-slate-900">
                      {ev.startDate} to {ev.endDate} ({ev.durationMonths} mo)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                        ev.category === 'CAT_IV_EXTREME'
                          ? 'bg-red-950 text-red-200 border border-red-800'
                          : ev.category === 'CAT_III_SEVERE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : ev.category === 'CAT_II_STRONG'
                          ? 'bg-orange-50 text-orange-800 border border-orange-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {ev.category.replace('CAT_', 'Cat ').replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between font-mono">
                    <span>Peak: +{ev.peakAnomaly} {variable.unit} ({ev.peakThresholdMultiple}x threshold)</span>
                    <span>Cumul: {ev.cumulativeIntensityDegreeMonths}°C·mo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{ev.impactDescription}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
