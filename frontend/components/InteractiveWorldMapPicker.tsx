import React, { useState } from 'react';
import { RegionHotspot } from '../types';
import { PLANETARY_HOTSPOTS } from '../services/earthScienceData';
import { Globe, MapPin, Compass, Check, Crosshair } from 'lucide-react';

interface InteractiveWorldMapPickerProps {
  selectedRegion: RegionHotspot;
  onSelectRegion: (region: RegionHotspot) => void;
  customCoordinates: { lat: number; lon: number };
  onCustomCoordinatesChange: (coords: { lat: number; lon: number }) => void;
}

export const InteractiveWorldMapPicker: React.FC<InteractiveWorldMapPickerProps> = ({
  selectedRegion,
  onSelectRegion,
  customCoordinates,
  onCustomCoordinatesChange
}) => {
  const [inputLat, setInputLat] = useState(customCoordinates.lat.toString());
  const [inputLon, setInputLon] = useState(customCoordinates.lon.toString());

  // Converts Lat (-90 to +90) and Lon (-180 to +180) to SVG viewbox (0 to 800, 0 to 400) Equirectangular projection
  const latLonToSvg = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 800;
    const y = ((90 - lat) / 180) * 400;
    return { x, y };
  };

  const svgToLatLon = (svgX: number, svgY: number) => {
    const lon = Number((((svgX / 800) * 360) - 180).toFixed(2));
    const lat = Number((90 - ((svgY / 400) * 180)).toFixed(2));
    return { lat, lon };
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = 800 / rect.width;
    const scaleY = 400 / rect.height;

    const coords = svgToLatLon(clickX * scaleX, clickY * scaleY);
    onCustomCoordinatesChange(coords);
    setInputLat(coords.lat.toString());
    setInputLon(coords.lon.toString());

    // Create dynamic custom hotspot
    onSelectRegion({
      id: `custom_${coords.lat}_${coords.lon}`,
      name: `Custom Location (${coords.lat >= 0 ? coords.lat + '°N' : Math.abs(coords.lat) + '°S'}, ${coords.lon >= 0 ? coords.lon + '°E' : Math.abs(coords.lon) + '°W'})`,
      coordinates: coords,
      biome: Math.abs(coords.lat) > 66 ? 'Polar / Tundra' : Math.abs(coords.lat) < 23 ? 'Tropical / Equatorial' : 'Temperate Continental',
      description: 'Custom location. All values come from the real observation or reanalysis grid cell containing this point.',
      continent: coords.lon < -30 ? 'Americas' : coords.lon > 60 ? 'Asia / Oceania' : 'Europe / Africa'
    });
  };

  const handleApplyCoordinates = () => {
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      const coords = { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
      onCustomCoordinatesChange(coords);
      onSelectRegion({
        id: `custom_${coords.lat}_${coords.lon}`,
        name: `Custom Point (${coords.lat >= 0 ? coords.lat + '°N' : Math.abs(coords.lat) + '°S'}, ${coords.lon >= 0 ? coords.lon + '°E' : Math.abs(coords.lon) + '°W'})`,
        coordinates: coords,
        biome: Math.abs(coords.lat) > 66 ? 'Polar / Cryosphere' : Math.abs(coords.lat) < 23 ? 'Tropical' : 'Temperate',
        description: 'Custom location. All values come from the real observation or reanalysis grid cell containing this point.',
        continent: 'Global Grid'
      });
    }
  };

  const activePos = latLonToSvg(customCoordinates.lat, customCoordinates.lon);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-card space-y-5">
      {/* Title and Coordinates Form */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-blue-700 uppercase tracking-wider font-semibold">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive Geographic Coordinate Picker</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Click Anywhere on Earth or Enter Exact Latitude / Longitude
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Current Target: <span className="text-blue-700 font-mono font-semibold">{selectedRegion.name}</span>
          </p>
        </div>

        {/* Lat/Lon Inputs */}
        <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 font-mono">Lat:</span>
            <input
              type="number"
              step="0.1"
              min="-90"
              max="90"
              value={inputLat}
              onChange={e => setInputLat(e.target.value)}
              className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 font-mono">Lon:</span>
            <input
              type="number"
              step="0.1"
              min="-180"
              max="180"
              value={inputLon}
              onChange={e => setInputLon(e.target.value)}
              className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <button
            onClick={handleApplyCoordinates}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors text-xs shadow-sm"
          >
            Apply Point
          </button>
        </div>
      </div>

      {/* SVG Interactive World Map */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
        <svg
          viewBox="0 0 800 400"
          className="w-full h-auto cursor-crosshair block select-none"
          onClick={handleMapClick}
        >
          {/* Latitude / Longitude Grids */}
          <line x1="0" y1="200" x2="800" y2="200" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="400" y1="0" x2="400" y2="400" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2="800" y2="100" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="0" y1="300" x2="800" y2="300" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="200" y1="0" x2="200" y2="400" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="600" y1="0" x2="600" y2="400" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* Continents Outlines */}
          <path d="M 120 70 Q 180 50 250 80 L 220 180 Q 180 190 140 140 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 230 190 Q 280 220 270 310 L 220 330 Q 200 240 230 190 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 380 70 Q 450 60 470 120 L 400 140 Q 370 110 380 70 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 380 140 Q 480 140 470 270 L 430 300 Q 360 210 380 140 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 470 60 Q 680 50 670 180 L 530 190 Q 460 140 470 60 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 640 250 Q 720 240 710 310 L 630 300 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M 280 30 Q 340 30 330 70 L 270 60 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.2" />

          {/* Preset Hotspot Markers */}
          {PLANETARY_HOTSPOTS.map(spot => {
            const pos = latLonToSvg(spot.coordinates.lat, spot.coordinates.lon);
            const isSelected = selectedRegion.id === spot.id;
            return (
              <g
                key={spot.id}
                className="cursor-pointer group"
                onClick={e => {
                  e.stopPropagation();
                  onSelectRegion(spot);
                  onCustomCoordinatesChange(spot.coordinates);
                  setInputLat(spot.coordinates.lat.toString());
                  setInputLon(spot.coordinates.lon.toString());
                }}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? '#2563eb' : '#64748b'}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-all hover:scale-125"
                />
                <text
                  x={pos.x + 8}
                  y={pos.y + 4}
                  fill={isSelected ? '#1d4ed8' : '#64748b'}
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {spot.name.split('(')[0].trim()}
                </text>
              </g>
            );
          })}

          {/* Active Custom Target Crosshair */}
          <g>
            <circle
              cx={activePos.x}
              cy={activePos.y}
              r={10}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="3 3"
              className="animate-spin origin-center"
            />
            <circle cx={activePos.x} cy={activePos.y} r={3} fill="#f59e0b" />
          </g>
        </svg>

        <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500 bg-white/90 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
          Equirectangular Grid • Lat [-90°, +90°], Lon [-180°, +180°]
        </div>
      </div>

      {/* Preset Hotspots Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-mono text-slate-500 font-medium">Jump to NASA Hotspot:</span>
        {PLANETARY_HOTSPOTS.map(spot => (
          <button
            key={spot.id}
            onClick={() => {
              onSelectRegion(spot);
              onCustomCoordinatesChange(spot.coordinates);
              setInputLat(spot.coordinates.lat.toString());
              setInputLon(spot.coordinates.lon.toString());
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              selectedRegion.id === spot.id
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {spot.name.split('(')[0]}
          </button>
        ))}
      </div>
    </div>
  );
};
