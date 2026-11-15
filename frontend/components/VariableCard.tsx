import React from 'react';
import { EarthVariable } from '../types';
import { Thermometer, Leaf, Droplets, CloudRain, Wind, Flame, Satellite, Activity } from 'lucide-react';

interface VariableCardProps {
  variable: EarthVariable;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export const VariableCard: React.FC<VariableCardProps> = ({
  variable,
  isSelected = false,
  onSelect,
  compact = false
}) => {
  const getIcon = () => {
    switch (variable.iconName) {
      case 'Thermometer':
        return <Thermometer className="w-5 h-5 text-rose-500" />;
      case 'Leaf':
        return <Leaf className="w-5 h-5 text-emerald-500" />;
      case 'Droplets':
        return <Droplets className="w-5 h-5 text-sky-500" />;
      case 'CloudRain':
        return <CloudRain className="w-5 h-5 text-blue-500" />;
      case 'Wind':
        return <Wind className="w-5 h-5 text-purple-500" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-amber-500" />;
      default:
        return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  const sphereColorBadge = () => {
    switch (variable.sphere) {
      case 'Climate & Energy':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Land & Hydrosphere':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Atmosphere':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all ${
        onSelect ? 'cursor-pointer hover:border-blue-400 hover:shadow-card-hover' : ''
      } ${
        isSelected
          ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
          : 'bg-white border-slate-200 shadow-card'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 shadow-sm">
            {getIcon()}
          </div>
          <div>
            <h4 className="font-semibold text-sm sm:text-base text-slate-900 leading-snug">
              {variable.name}
            </h4>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
              <span className="font-mono text-blue-600 font-semibold">{variable.shortCode}</span>
              <span>•</span>
              <span className="text-slate-600 font-medium">{variable.unit}</span>
            </div>
          </div>
        </div>

        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${sphereColorBadge()}`}>
          {variable.sphere}
        </span>
      </div>

      {!compact && (
        <>
          <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2">
            {variable.definition}
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Satellite className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-medium text-slate-700">{variable.instrumentOrModel}</span>
            </div>
            <div className="font-mono text-slate-400 font-medium">
              {variable.agency}
            </div>
          </div>

          <div className="mt-2.5 bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-[11px]">
            <span className="text-blue-700 font-semibold">Why it matters: </span>
            <span className="text-slate-600">{variable.whyItMatters}</span>
          </div>
        </>
      )}
    </div>
  );
};
