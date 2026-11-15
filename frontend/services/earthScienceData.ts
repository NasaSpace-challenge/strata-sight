import { EarthVariable, RegionHotspot, CaseStudyPreset } from '../types';

/**
 * StrataSight variable catalog.
 *
 * EVERY entry is backed by a real NASA / NOAA product served through backend/seriesService.js.
 * There is no synthetic or simulated data anywhere in this catalog. Names state the actual
 * product (e.g. "MERRA-2 …" or "GPM IMERG …") so nothing is mislabeled.
 */

const POWER_RES = '0.5° × 0.625°';

export const NASA_VARIABLES: EarthVariable[] = [
  // ───────────────────────── Climate & Energy (NASA POWER / MERRA-2 / CERES) ─────────────────────────
  {
    id: 't2m',
    name: 'Near-Surface Air Temperature',
    shortCode: 'MERRA-2 T2M',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: '°C',
    definition: 'Air temperature 2 meters above the surface, from the MERRA-2 reanalysis that blends satellite and ground observations into a consistent global record.',
    whyItMatters: 'The most direct measure of regional warming. Trends here drive heat waves, snowmelt timing and crop stress.',
    typicalSeasonality: 'Strong yearly cycle: warm summers, cold winters (reversed in the Southern Hemisphere).',
    iconName: 'Thermometer',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is it getting warmer here?',
    higherMeans: 'warmer'
  },
  {
    id: 't2m_max',
    name: 'Daytime Maximum Temperature',
    shortCode: 'MERRA-2 T2M_MAX',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: '°C',
    definition: 'The monthly average of each day\'s highest 2-meter air temperature.',
    whyItMatters: 'Hot afternoons, not averages, cause heat illness and crop damage. Compare with the nightly minimum to see which is warming faster.',
    typicalSeasonality: 'Peaks in local summer.',
    iconName: 'Flame',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Are the hottest hours of the day getting hotter?',
    higherMeans: 'hotter afternoons'
  },
  {
    id: 't2m_min',
    name: 'Nighttime Minimum Temperature',
    shortCode: 'MERRA-2 T2M_MIN',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: '°C',
    definition: 'The monthly average of each day\'s lowest 2-meter air temperature.',
    whyItMatters: 'Warm nights give people and ecosystems less time to recover from heat, and often warm faster than days.',
    typicalSeasonality: 'Lowest in local winter.',
    iconName: 'Thermometer',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Are nights getting warmer?',
    higherMeans: 'warmer nights'
  },
  {
    id: 'ts_skin',
    name: 'Land & Sea Skin Temperature',
    shortCode: 'MERRA-2 TS',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: '°C',
    definition: 'Temperature of the actual surface (ground, canopy, ice or sea surface) rather than the air above it.',
    whyItMatters: 'Surface temperature responds to vegetation, snow and cities and is what satellites "see" from orbit.',
    typicalSeasonality: 'Larger swings than air temperature over dry land.',
    iconName: 'Flame',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is the ground surface heating up?',
    higherMeans: 'a hotter surface'
  },
  {
    id: 'sw_down',
    name: 'Sunlight Reaching the Surface',
    shortCode: 'CERES SW↓',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'CERES SYN1deg all-sky (via NASA POWER)',
    agency: 'NASA LaRC',
    unit: 'kWh/m²/day',
    definition: 'All-sky shortwave solar energy arriving at the ground each day, after clouds and aerosols have removed some of it.',
    whyItMatters: '"Dimming" from pollution or clouds and "brightening" after clean-air policy change both crops and solar power.',
    typicalSeasonality: 'Strongest in summer, weakest in winter; larger swings at high latitude.',
    iconName: 'Flame',
    provider: 'power',
    startYear: 1981,
    resolution: '1° × 1°',
    liveApiSupported: true,
    question: 'Is more or less sunlight reaching the ground?',
    higherMeans: 'brighter surface'
  },

  // ───────────────────────── Atmosphere ─────────────────────────
  {
    id: 'cloud_amt',
    name: 'Cloud Cover',
    shortCode: 'MERRA-2 CLOUD_AMT',
    sphere: 'Atmosphere',
    instrumentOrModel: 'MERRA-2 / CERES (via NASA POWER)',
    agency: 'NASA GMAO / LaRC',
    unit: '%',
    definition: 'Fraction of the sky covered by cloud, averaged over the month.',
    whyItMatters: 'Clouds both cool (reflecting sunlight) and warm (trapping heat). Shifting cloud is one of the largest uncertainties in climate projections.',
    typicalSeasonality: 'Varies with monsoons and storm seasons.',
    iconName: 'CloudRain',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is it getting cloudier or clearer?',
    higherMeans: 'cloudier skies'
  },
  {
    id: 'rh2m',
    name: 'Relative Humidity',
    shortCode: 'MERRA-2 RH2M',
    sphere: 'Atmosphere',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: '%',
    definition: 'How close the air near the ground is to being saturated with water vapor.',
    whyItMatters: 'Dry air raises wildfire risk and evaporative demand; humid heat is harder on the human body.',
    typicalSeasonality: 'Follows monsoon and rainy seasons.',
    iconName: 'Droplets',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is the air getting drier or more humid?',
    higherMeans: 'more humid air'
  },
  {
    id: 'ws10m',
    name: 'Near-Surface Wind Speed',
    shortCode: 'MERRA-2 WS10M',
    sphere: 'Atmosphere',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: 'm/s',
    definition: 'Wind speed 10 meters above the surface.',
    whyItMatters: 'Wind controls dust transport, evaporation, ocean mixing and wind-energy potential.',
    typicalSeasonality: 'Stronger in winter storm seasons in mid-latitudes.',
    iconName: 'Wind',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is it getting windier?',
    higherMeans: 'windier'
  },
  {
    id: 'aod550',
    name: 'Aerosol Optical Depth (550 nm)',
    shortCode: 'MERRA-2 AOD',
    sphere: 'Atmosphere',
    instrumentOrModel: 'MERRA-2 aerosol reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: 'τ (550 nm)',
    definition: 'How much sunlight smoke, dust, sulfate and other particles block in the whole air column (0 = perfectly clear).',
    whyItMatters: 'Aerosols harm lungs, dim the surface and seed clouds. Rising and falling AOD tracks pollution control and fires.',
    typicalSeasonality: 'Peaks with dust storms, crop burning or wildfire seasons.',
    iconName: 'Wind',
    provider: 'power',
    startYear: 2001,
    resolution: POWER_RES,
    liveApiSupported: true,
    caveat: 'A reanalysis product that assimilates MODIS aerosol observations; the record begins in 2001.',
    question: 'Is the air getting more or less polluted with particles?',
    higherMeans: 'a hazier atmosphere'
  },
  {
    id: 'ozone_col',
    name: 'Total Column Ozone',
    shortCode: 'MERRA-2 TO3',
    sphere: 'Atmosphere',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: 'DU',
    definition: 'Total ozone in the air column above a point, in Dobson Units. About 300 DU is the typical global value.',
    whyItMatters: 'The ozone layer shields life from UV radiation; its recovery after the Montreal Protocol is a policy success story.',
    typicalSeasonality: 'Highest at high latitudes in late winter and spring.',
    iconName: 'Wind',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is the ozone layer recovering above this region?',
    higherMeans: 'more ozone'
  },
  {
    id: 'omi_no2',
    name: 'Tropospheric Nitrogen Dioxide (NO₂)',
    shortCode: 'OMI NO₂',
    sphere: 'Atmosphere',
    instrumentOrModel: 'OMI on NASA Aura (via GES DISC)',
    agency: 'NASA GSFC / KNMI',
    unit: '×10¹⁵ molec/cm²',
    definition: 'Amount of NO₂ gas in the lowest layers of the atmosphere, mostly from vehicles, power plants and industry. Measured from orbit.',
    whyItMatters: 'A satellite fingerprint of urban air pollution and the effect of clean-air policy.',
    typicalSeasonality: 'Higher in winter, when NO₂ lasts longer and heating emissions rise.',
    iconName: 'Wind',
    provider: 'giovanni',
    startYear: 2004,
    resolution: '0.25° × 0.25°',
    liveApiSupported: true,
    caveat: 'Monthly means need at least 5 clear-sky days; the OMI "row anomaly" affects some swaths from 2007 onward.',
    question: 'Is air pollution from traffic and industry rising or falling?',
    higherMeans: 'more NO₂ pollution'
  },
  {
    id: 'co2_mlo',
    name: 'Atmospheric CO₂ (Mauna Loa Reference)',
    shortCode: 'NOAA GML CO₂',
    sphere: 'Atmosphere',
    instrumentOrModel: 'NOAA Mauna Loa Observatory',
    agency: 'NOAA GML',
    unit: 'ppm',
    definition: 'Monthly average carbon dioxide concentration measured at Mauna Loa, Hawaii, the longest continuous record of atmospheric CO₂.',
    whyItMatters: 'The "Keeling Curve": the clearest single signal of human influence on the atmosphere.',
    typicalSeasonality: 'Dips each northern summer as plants absorb CO₂ and rises in winter.',
    iconName: 'Activity',
    provider: 'noaa-gml',
    scope: 'global',
    startYear: 1958,
    resolution: 'single station',
    liveApiSupported: true,
    caveat: 'A single worldwide reference series: it is the same for every region you pick. It is not a satellite column retrieval.',
    question: 'How fast is atmospheric CO₂ rising?',
    higherMeans: 'more CO₂'
  },
  {
    id: 'ch4_global',
    name: 'Atmospheric Methane (Global Mean)',
    shortCode: 'NOAA GML CH₄',
    sphere: 'Atmosphere',
    instrumentOrModel: 'NOAA global marine surface network',
    agency: 'NOAA GML',
    unit: 'ppb',
    definition: 'Globally averaged methane concentration at the marine surface.',
    whyItMatters: 'Methane traps far more heat than CO₂ per molecule and has been accelerating since about 2007.',
    typicalSeasonality: 'Small seasonal cycle; dominated by the long-term rise.',
    iconName: 'Flame',
    provider: 'noaa-gml',
    scope: 'global',
    startYear: 1984,
    resolution: 'global mean',
    liveApiSupported: true,
    caveat: 'A single worldwide reference series: it is the same for every region you pick.',
    question: 'How fast is atmospheric methane rising?',
    higherMeans: 'more methane'
  },

  // ───────────────────────── Land & Hydrosphere ─────────────────────────
  {
    id: 'precip_merra2',
    name: 'Precipitation (Reanalysis, Gauge-Corrected)',
    shortCode: 'MERRA-2 PRECTOTCORR',
    sphere: 'Land & Hydrosphere',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: 'mm/month',
    definition: 'Monthly total precipitation from MERRA-2, bias-corrected against rain-gauge analyses.',
    whyItMatters: 'A 40+ year, token-free rainfall record that works anywhere on Earth; use it for long-term trends and compare with the satellite-only GPM series.',
    typicalSeasonality: 'Monsoon pulses, storm tracks or an ITCZ shift set the cycle.',
    iconName: 'CloudRain',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    caveat: 'A reanalysis (model + assimilated data), smoother than direct satellite or gauge rainfall.',
    question: 'Has rainfall changed over the last 40 years?',
    higherMeans: 'more rain'
  },
  {
    id: 'gpm_precip',
    name: 'Monthly Precipitation',
    shortCode: 'GPM IMERG V07',
    sphere: 'Land & Hydrosphere',
    instrumentOrModel: 'GPM constellation (IMERG Final, via GES DISC)',
    agency: 'NASA / JAXA',
    unit: 'mm/month',
    definition: 'Total rain and snow for the month, estimated by merging microwave and infrared data from many satellites and calibrating to rain gauges.',
    whyItMatters: 'Rainfall changes decide floods, droughts, crop yields and reservoir levels.',
    typicalSeasonality: 'Monsoon pulses, storm tracks or an ITCZ shift set the cycle.',
    iconName: 'CloudRain',
    provider: 'giovanni',
    startYear: 2000,
    resolution: '0.1° × 0.1°',
    liveApiSupported: true,
    caveat: 'A ~25-year record: long enough for a signal in wet regions, short for noisy rainfall.',
    question: 'Is rainfall increasing or decreasing?',
    higherMeans: 'more rain'
  },
  {
    id: 'gldas_soil_moist',
    name: 'Root-Zone Soil Moisture',
    shortCode: 'GLDAS Noah 0–100 cm',
    sphere: 'Land & Hydrosphere',
    instrumentOrModel: 'GLDAS-2.1 Noah land-surface model (via GES DISC)',
    agency: 'NASA GSFC',
    unit: 'kg/m²',
    definition: 'Water stored in the top meter of soil, from a land model driven by satellite and ground observations.',
    whyItMatters: 'Early warning for agricultural drought, wildfire danger and groundwater stress.',
    typicalSeasonality: 'Recharges in rainy or snowmelt seasons, dries in summer.',
    iconName: 'Droplets',
    provider: 'giovanni',
    startYear: 2000,
    resolution: '0.25° × 0.25° (land only)',
    liveApiSupported: true,
    caveat: 'A model product, not a direct satellite measurement. It has no data over open ocean. Over frozen ground it can reflect model behavior as well as climate.',
    question: 'Are soils getting drier or wetter?',
    higherMeans: 'wetter soil'
  },
  {
    id: 'soil_wetness',
    name: 'Root-Zone Soil Wetness',
    shortCode: 'MERRA-2 GWETROOT',
    sphere: 'Land & Hydrosphere',
    instrumentOrModel: 'MERRA-2 reanalysis (via NASA POWER)',
    agency: 'NASA GMAO',
    unit: 'fraction (0–1)',
    definition: 'How full of water the root zone is, from 0 (bone dry) to 1 (saturated).',
    whyItMatters: 'A fast, token-free drought indicator that works anywhere on land.',
    typicalSeasonality: 'Follows wet and dry seasons.',
    iconName: 'Droplets',
    provider: 'power',
    startYear: 1981,
    resolution: POWER_RES,
    liveApiSupported: true,
    question: 'Is the land drying out or getting wetter?',
    higherMeans: 'wetter soil'
  },
  {
    id: 'airs_skin_temp',
    name: 'Satellite Land & Sea Skin Temperature',
    shortCode: 'AIRS Skin Temp',
    sphere: 'Climate & Energy',
    instrumentOrModel: 'AIRS on NASA Aqua (via GES DISC)',
    agency: 'NASA JPL',
    unit: '°C',
    definition: 'Infrared surface temperature measured by the AIRS sounder on the Aqua satellite (daytime pass).',
    whyItMatters: 'An independent, directly observed check on reanalysis temperature trends.',
    typicalSeasonality: 'Large yearly swings over dry continental interiors.',
    iconName: 'Flame',
    provider: 'giovanni',
    startYear: 2002,
    resolution: '1° × 1°',
    liveApiSupported: true,
    caveat: 'Daytime overpass only (~1:30 pm), so it reads warmer than the daily mean; the record begins in September 2002.',
    question: 'What does a satellite say about surface warming here?',
    higherMeans: 'a warmer surface'
  },
  {
    id: 'modis_ndvi',
    name: 'Vegetation Greenness (NDVI)',
    shortCode: 'MODIS NDVI',
    sphere: 'Land & Hydrosphere',
    instrumentOrModel: 'MODIS on NASA Terra (via Google Earth Engine)',
    agency: 'NASA LP DAAC',
    unit: 'NDVI (−1…1)',
    definition: 'A satellite index of how much green, photosynthesizing vegetation covers the land. 0 is bare ground, 0.8 is dense forest.',
    whyItMatters: 'Tracks Arctic greening, drought impacts, deforestation and crop health.',
    typicalSeasonality: 'Peaks in the growing season.',
    iconName: 'Leaf',
    provider: 'earthengine',
    startYear: 2001,
    resolution: '250 m',
    liveApiSupported: true,
    caveat: 'Needs Google Earth Engine on the server. It is hidden automatically when Earth Engine is not available.',
    question: 'Is the land getting greener or browner?',
    higherMeans: 'greener vegetation'
  }
];

export const PLANETARY_HOTSPOTS: RegionHotspot[] = [
  {
    id: 'southwest_us',
    name: 'Southwestern United States (Colorado River Basin)',
    coordinates: { lat: 36.1, lon: -112.1 },
    biome: 'Arid / Semi-Arid Shrubland',
    description: 'A megadrought region where reservoirs and groundwater are under long-term stress.',
    continent: 'North America'
  },
  {
    id: 'scandinavia_neurope',
    name: 'Northern Europe & Scandinavia',
    coordinates: { lat: 60.5, lon: 15.2 },
    biome: 'Boreal Taiga & Mixed Forest',
    description: 'A high-latitude region at the poleward edge of mid-latitude storm tracks.',
    continent: 'Europe'
  },
  {
    id: 'los_angeles_basin',
    name: 'Los Angeles Basin (California, USA)',
    coordinates: { lat: 34.05, lon: -118.24 },
    biome: 'Mediterranean Urban Coastal',
    description: 'Decades of strict emission rules have produced one of the best-documented urban clean-air recoveries.',
    continent: 'North America'
  },
  {
    id: 'south_asia_indo_gangetic',
    name: 'Indo-Gangetic Plain (South Asia)',
    coordinates: { lat: 28.61, lon: 77.2 },
    biome: 'Dense Megacity / Agricultural Plain',
    description: 'A densely populated, heavily irrigated plain with some of the world\'s highest aerosol loads.',
    continent: 'Asia'
  },
  {
    id: 'arctic_siberia_tundra',
    name: 'Siberian Arctic Coastal Tundra (Sakha Republic)',
    coordinates: { lat: 70.8, lon: 128.5 },
    biome: 'Arctic Permafrost Tundra',
    description: 'The Arctic is warming faster than the global average ("Arctic amplification").',
    continent: 'Asia / Arctic'
  },
  {
    id: 'amazon_arc_deforestation',
    name: 'Amazon Rainforest (Arc of Deforestation)',
    coordinates: { lat: -9.5, lon: -54.8 },
    biome: 'Tropical Evergreen Rainforest',
    description: 'The southern Amazon edge, where forest loss and longer dry seasons interact.',
    continent: 'South America'
  },
  {
    id: 'aral_sea_basin',
    name: 'Aral Sea Ecological Basin (Central Asia)',
    coordinates: { lat: 45.0, lon: 59.8 },
    biome: 'Arid Desertified Basin',
    description: 'One of the 20th century\'s largest human-driven environmental changes: a sea that largely disappeared.',
    continent: 'Asia'
  },
  {
    id: 'sahel_belt',
    name: 'African Sahel Transition Zone',
    coordinates: { lat: 14.5, lon: 1.2 },
    biome: 'Semi-Arid Savanna & Grassland',
    description: 'Famous for decades of drought followed by partial rainfall recovery.',
    continent: 'Africa'
  },
  {
    id: 'bc_fraser_wildfire',
    name: 'British Columbia Interior & Fraser Basin (Canada)',
    coordinates: { lat: 50.7, lon: -121.3 },
    biome: 'Cordilleran Montane Forest & River Corridor',
    description: 'A snowmelt-fed river basin and a recent wildfire region; the Fraser River at Hope has a 100-year gauge record.',
    continent: 'North America',
    swotReachId: '78220000051',
    canadaHydrometricId: '08MF005'
  },
  {
    id: 'canada_winnipeg_arctic',
    name: 'Lake Winnipeg & Boreal Shield Corridor (Canada)',
    coordinates: { lat: 50.32, lon: -95.98 },
    biome: 'Boreal Shield Freshwater & Wetland Network',
    description: 'A lake-and-river corridor used for SWOT satellite hydrology calibration.',
    continent: 'North America',
    swotReachId: '71224100221',
    canadaHydrometricId: '05PF069'
  }
];

/**
 * Demo investigations. Every one was checked against the real data before being written:
 * the two regions genuinely show opposite signs (or a clear significant vs. non-significant contrast).
 * The app recomputes the statistics live; the text below only frames the question.
 */
export const DEMO_CASE_STUDIES: CaseStudyPreset[] = [
  {
    id: 'case_cloud_divergence',
    title: 'Same Warming, Opposite Cloud Trends',
    subtitle: 'Cloud cover falls over the US Southwest and rises over Scandinavia',
    paradoxLesson:
      'A warming atmosphere does not change every place the same way. Shifting storm tracks and circulation can dry out some regions while clouding over others. Compare the two trends below: they have opposite signs, and the tests tell you whether each one is real.',
    variableId: 'cloud_amt',
    secondaryVariableId: 't2m',
    primaryRegionId: 'southwest_us',
    secondaryRegionId: 'scandinavia_neurope',
    badge: 'MERRA-2 • Opposite Trends'
  },
  {
    id: 'case_aerosol_divergence',
    title: 'Two Paths for Air Pollution',
    subtitle: 'Aerosols climb over South Asia while falling over Northern Europe',
    paradoxLesson:
      'Clean-air policy, industrial growth and crop burning push particle pollution in different directions. Over South Asia aerosol optical depth is rising; over Scandinavia it is falling. Aerosols also dim the surface, so check the sunlight variable next.',
    variableId: 'aod550',
    secondaryVariableId: 'sw_down',
    primaryRegionId: 'south_asia_indo_gangetic',
    secondaryRegionId: 'scandinavia_neurope',
    badge: 'Air Quality • Opposite Trends'
  },
  {
    id: 'case_clean_air_la',
    title: 'Los Angeles: A Clean-Air Success Seen from Space',
    subtitle: 'OMI satellite NO₂ collapses over LA while the rural Southwest barely changes',
    paradoxLesson:
      'Catalytic converters and emission rules show up in orbit. NASA\'s OMI instrument sees tropospheric NO₂ over Los Angeles fall sharply, while a rural region nearby shows only a small change in the opposite direction.',
    variableId: 'omi_no2',
    secondaryVariableId: 't2m',
    primaryRegionId: 'los_angeles_basin',
    secondaryRegionId: 'southwest_us',
    badge: 'NASA OMI • Policy Signal'
  },
  {
    id: 'case_humidity_divergence',
    title: 'Two Tropics, Two Humidity Fates',
    subtitle: 'The air over the Indo-Gangetic Plain gets more humid; over the Amazon it dries',
    paradoxLesson:
      'Heavy irrigation can add moisture to the air over South Asia, while forest loss and drought reduce evaporation over the southern Amazon. The same planetary warming, two very different local humidity trends.',
    variableId: 'rh2m',
    secondaryVariableId: 't2m',
    primaryRegionId: 'south_asia_indo_gangetic',
    secondaryRegionId: 'amazon_arc_deforestation',
    badge: 'Hydrology • Opposite Trends'
  },
  {
    id: 'case_precip_gpm',
    title: 'Satellite Rain: Amazon Drying, Aral Basin Wetting',
    subtitle: 'GPM IMERG precipitation trends in opposite directions',
    paradoxLesson:
      'Direct satellite rainfall estimates show the southern Amazon edge getting drier while the Aral Sea basin gets wetter over the same 25 years. Use the significance tests to separate real change from natural year-to-year rainfall noise.',
    variableId: 'gpm_precip',
    secondaryVariableId: 'soil_wetness',
    primaryRegionId: 'amazon_arc_deforestation',
    secondaryRegionId: 'aral_sea_basin',
    badge: 'NASA GPM • Opposite Trends'
  },
  {
    id: 'case_swot_csa_live',
    title: 'LIVE: NASA/CSA SWOT Rivers & Canadian Gauges',
    subtitle: 'Real PO.DAAC Hydrocron river altimetry plus 100-year ECCC stream gauges',
    paradoxLesson:
      'SWOT\'s radar sees water height across rivers and lakes. Pair it with Canada\'s century-long gauge record to see how a satellite record connects to a long ground record.',
    variableId: 't2m',
    primaryRegionId: 'bc_fraser_wildfire',
    badge: 'Live NASA + CSA',
    targetLabTab: 'multiagency'
  }
];


/** "36.10°N, 112.10°W": hemisphere letters derived from the sign (never prints a negative longitude as °E). */
export function formatCoords(lat: number, lon: number, digits = 2): string {
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? 'E' : 'W'}`;
}

/** A user-chosen point on the map, described honestly: the real grid cell that contains it. */
export function makeCustomRegion(lat: number, lon: number, label?: string): RegionHotspot {
  const la = Number(lat.toFixed(2));
  const lo = Number(lon.toFixed(2));
  return {
    id: `custom_${la}_${lo}`,
    name: label ?? `Custom location (${formatCoords(la, lo, 1)})`,
    coordinates: { lat: la, lon: lo },
    biome: Math.abs(la) > 66 ? 'Polar' : Math.abs(la) < 23 ? 'Tropical' : 'Temperate',
    description: 'Custom location. All values come from the real observation or reanalysis grid cell containing this point.',
    continent: 'Custom'
  };
}
