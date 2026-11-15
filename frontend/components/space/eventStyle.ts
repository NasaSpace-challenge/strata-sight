import { Activity, CloudFog, Droplets, Flame, Mountain, Snowflake, Sun, Tornado, Waves, Wheat, Factory, Shapes, type LucideIcon } from 'lucide-react';

interface EventStyle {
  color: string;
  icon: LucideIcon;
  label: string;
}

const STYLES: Record<string, EventStyle> = {
  wildfires: { color: '#ea580c', icon: Flame, label: 'Wildfire' },
  severeStorms: { color: '#7c3aed', icon: Tornado, label: 'Severe storm' },
  volcanoes: { color: '#dc2626', icon: Mountain, label: 'Volcano' },
  floods: { color: '#2563eb', icon: Droplets, label: 'Flood' },
  seaLakeIce: { color: '#0891b2', icon: Snowflake, label: 'Sea & lake ice' },
  snow: { color: '#0ea5e9', icon: Snowflake, label: 'Snow' },
  dustHaze: { color: '#a16207', icon: CloudFog, label: 'Dust & haze' },
  drought: { color: '#b45309', icon: Wheat, label: 'Drought' },
  tempExtremes: { color: '#e11d48', icon: Sun, label: 'Temperature extreme' },
  earthquakes: { color: '#475569', icon: Activity, label: 'Earthquake' },
  landslides: { color: '#78716c', icon: Mountain, label: 'Landslide' },
  waterColor: { color: '#0d9488', icon: Waves, label: 'Water colour' },
  manmade: { color: '#64748b', icon: Factory, label: 'Human-made event' }
};

const FALLBACK: EventStyle = { color: '#475569', icon: Shapes, label: 'Event' };

export const eventStyle = (categoryId: string): EventStyle => STYLES[categoryId] ?? FALLBACK;
