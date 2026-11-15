import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { EarthVariable, RegionHotspot } from '../types';
import { TrendMapView } from './TrendMapView';
import { InteractiveWorldMapPicker } from './InteractiveWorldMapPicker';
import { makeCustomRegion } from '../services/earthScienceData';

// Leaflet and the NASA imagery views are only downloaded when someone opens this mode.
const PlaceExplorer = lazy(() => import('./space/PlaceExplorer').then(m => ({ default: m.PlaceExplorer })));

export type MapMode = 'trend' | 'pick' | 'space';

interface MapWorkspaceProps {
  variable: EarthVariable;
  selectedRegion: RegionHotspot;
  onSelectRegion: (r: RegionHotspot) => void;
  customCoordinates: { lat: number; lon: number };
  onCustomCoordinatesChange: (c: { lat: number; lon: number }) => void;
  onAnalyzePoint: (lat: number, lon: number, label?: string) => void;
  mode: MapMode;
  onModeChange: (m: MapMode) => void;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  variable,
  selectedRegion,
  onSelectRegion,
  customCoordinates,
  onCustomCoordinatesChange,
  onAnalyzePoint,
  mode,
  onModeChange
}) => {
  const tab = (id: MapMode, label: string, short: string) => (
    <button
      onClick={() => onModeChange(id)}
      aria-pressed={mode === id}
      className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
        mode === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 border border-slate-200 p-1" role="group" aria-label="Map mode">
        {tab('trend', 'Where is it changing?', 'Trends')}
        {tab('space', 'See it from space', 'From space')}
        {tab('pick', 'Pick any coordinate', 'Pick a point')}
      </div>
      {mode === 'trend' && <TrendMapView variable={variable} onAnalyzePoint={onAnalyzePoint} onSeeFromSpace={(la, lo) => {
            const r = makeCustomRegion(la, lo);
            onSelectRegion(r);
            onCustomCoordinatesChange(r.coordinates);
            onModeChange('space');
          }} />}
      {mode === 'pick' && (
        <InteractiveWorldMapPicker
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
          customCoordinates={customCoordinates}
          onCustomCoordinatesChange={onCustomCoordinatesChange}
        />
      )}
      {mode === 'space' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading satellite views…
            </div>
          }
        >
          <PlaceExplorer variable={variable} selectedRegion={selectedRegion} onAnalyze={onAnalyzePoint} />
        </Suspense>
      )}
    </div>
  );
};
