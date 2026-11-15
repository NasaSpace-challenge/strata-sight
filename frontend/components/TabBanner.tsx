import React from 'react';
import { Activity, BarChart3, Flame, GitCompare, Layers, Map as MapIcon, Waves } from 'lucide-react';
import type { TabId } from './Header';
import { BannerVariant, PageBanner } from './PageBanner';

interface BannerSpec {
  variant: BannerVariant;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  accent: string;
  subtitle: string;
}

/** Banners for the tabs whose views have no header of their own (Start, Compare, Water & SAR and Methods draw theirs). */
const BANNERS: Partial<Record<TabId, BannerSpec>> = {
  explorer: {
    variant: 'blue',
    icon: BarChart3,
    kicker: 'Analyze',
    title: 'Is it changing, and is it',
    accent: 'real?',
    subtitle: 'The real monthly record for one place, its trend, and a plain-language verdict you can check.'
  },
  map: {
    variant: 'sky',
    icon: MapIcon,
    kicker: 'Map',
    title: 'See where the change is, and what it',
    accent: 'looks like',
    subtitle: 'Trend maps with significance, NASA satellite imagery, time-lapses and natural events for any place on Earth.'
  },
  teleconnections: {
    variant: 'indigo',
    icon: Waves,
    kicker: 'Teleconnections',
    title: 'Is it linked to',
    accent: 'El Niño and friends?',
    subtitle: 'Tests whether ENSO, NAO or PDO move together with your series, with honest corrections for short records.'
  },
  bivariate: {
    variant: 'violet',
    icon: GitCompare,
    kicker: 'Lead–lag correlation',
    title: 'Does one variable',
    accent: 'lead another?',
    subtitle: 'Compare two real records and find out which one moves first, and by how many months.'
  },
  decomposition: {
    variant: 'emerald',
    icon: Layers,
    kicker: 'Trend, season, noise',
    title: 'Separate the signal from the',
    accent: 'noise',
    subtitle: 'Splits the record into a long-term trend, the seasonal cycle and what is left over.'
  },
  heatwave: {
    variant: 'rose',
    icon: Flame,
    kicker: 'Extreme months',
    title: 'How often is it',
    accent: 'unusually hot?',
    subtitle: 'Finds months above the 90th percentile for their calendar month and how long each episode lasted.'
  },
  compound: {
    variant: 'amber',
    icon: Flame,
    kicker: 'Compound hot + dry',
    title: 'When heat and drought',
    accent: 'arrive together',
    subtitle: 'Looks for months that are hot, dry and short on soil moisture at the same time.'
  },
  spectral: {
    variant: 'indigo',
    icon: Activity,
    kicker: 'Cycles',
    title: 'Which rhythms hide in the',
    accent: 'record?',
    subtitle: 'Spectral and wavelet analysis shows the cycles in the series and when they were strong.'
  }
};

export const TabBanner: React.FC<{ tab: TabId }> = ({ tab }) => {
  const spec = BANNERS[tab];
  return spec ? <PageBanner {...spec} /> : null;
};
