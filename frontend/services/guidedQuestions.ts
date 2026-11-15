/**
 * Plain-language questions that start every analysis. Each one maps to a REAL variable
 * (see earthScienceData.NASA_VARIABLES) and to places where the answer is interesting.
 */
export type QuestionKind = 'analyze' | 'map' | 'compare';
export type QuestionIcon = 'heat' | 'rain' | 'soil' | 'air' | 'city' | 'co2' | 'map' | 'compare';

export interface GuidedQuestion {
  id: string;
  kind: QuestionKind;
  /** The question as a curious person would ask it. */
  text: string;
  /** One line on how it will be answered. */
  how: string;
  variableId: string;
  /** Region ids worth looking at first (in order). */
  suggestedRegionIds: string[];
  icon: QuestionIcon;
}

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'heat',
    kind: 'analyze',
    text: 'Is it getting hotter?',
    how: 'Air temperature since 1981 (NASA MERRA-2)',
    variableId: 't2m',
    suggestedRegionIds: ['southwest_us', 'arctic_siberia_tundra', 'scandinavia_neurope', 'south_asia_indo_gangetic'],
    icon: 'heat'
  },
  {
    id: 'rain',
    kind: 'analyze',
    text: 'Is rainfall changing?',
    how: 'Satellite rain estimates (NASA GPM IMERG)',
    variableId: 'gpm_precip',
    suggestedRegionIds: ['amazon_arc_deforestation', 'aral_sea_basin', 'sahel_belt', 'south_asia_indo_gangetic'],
    icon: 'rain'
  },
  {
    id: 'soil',
    kind: 'analyze',
    text: 'Are soils drying out?',
    how: 'Root-zone soil wetness (NASA MERRA-2)',
    variableId: 'soil_wetness',
    suggestedRegionIds: ['southwest_us', 'sahel_belt', 'amazon_arc_deforestation', 'aral_sea_basin'],
    icon: 'soil'
  },
  {
    id: 'air',
    kind: 'analyze',
    text: 'Is the air getting dirtier or cleaner?',
    how: 'Particle pollution seen from space (aerosol optical depth)',
    variableId: 'aod550',
    suggestedRegionIds: ['south_asia_indo_gangetic', 'scandinavia_neurope', 'los_angeles_basin', 'sahel_belt'],
    icon: 'air'
  },
  {
    id: 'city',
    kind: 'analyze',
    text: 'Did clean-air rules work in cities?',
    how: 'Nitrogen dioxide from NASA OMI (needs Earthdata)',
    variableId: 'omi_no2',
    suggestedRegionIds: ['los_angeles_basin', 'south_asia_indo_gangetic', 'southwest_us'],
    icon: 'city'
  },
  {
    id: 'co2',
    kind: 'analyze',
    text: 'How fast is CO₂ rising?',
    how: "Mauna Loa, the world's longest CO₂ record (NOAA)",
    variableId: 'co2_mlo',
    suggestedRegionIds: [],
    icon: 'co2'
  },
  {
    id: 'where',
    kind: 'map',
    text: 'Where is it changing the most?',
    how: 'A world map of trends with significance dots',
    variableId: 't2m',
    suggestedRegionIds: [],
    icon: 'map'
  },
  {
    id: 'compare',
    kind: 'compare',
    text: 'Do two places change differently?',
    how: 'Side-by-side verdicts for two regions',
    variableId: 'aod550',
    suggestedRegionIds: [],
    icon: 'compare'
  }
];
