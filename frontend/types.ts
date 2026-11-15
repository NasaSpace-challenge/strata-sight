export type EarthSphere = 'Atmosphere' | 'Land & Hydrosphere' | 'Cryosphere' | 'Climate & Energy';

export type SignificanceLevel = 'HIGHLY_SIGNIFICANT' | 'SIGNIFICANT' | 'EMERGING' | 'NOT_SIGNIFICANT';

export type BaselinePeriod = '1961-1990' | '1981-2010' | '1991-2020' | '2001-2020' | 'FULL_PERIOD';

export type AnomalyDisplayMode = 'PHYSICAL' | 'STANDARDIZED_ZSCORE';

export type ClimateIndexId = 'ENSO_ONI' | 'NAO' | 'IOD_DMI';

export interface ClimateIndexMetadata {
  id: ClimateIndexId;
  name: string;
  fullName: string;
  agency: string;
  unit: string;
  positivePhaseName: string;
  negativePhaseName: string;
  description: string;
  significanceThreshold: number;
}

export interface ClimateIndexPoint {
  date: string;
  year: number;
  month: number;
  value: number;
  phase: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface TeleconnectionCorrelation {
  indexId: ClimateIndexId;
  indexName: string;
  pearsonR: number;
  pValue: number;
  rSquared: number;
  positivePhaseMeanAnomaly: number;
  negativePhaseMeanAnomaly: number;
  neutralPhaseMeanAnomaly: number;
  phaseContrastDelta: number;
  dominantPhaseImpact: string;
}

export interface CompoundExtremeEvent {
  date: string;
  year: number;
  month: number;
  tempZScore: number;
  soilMoistZScore: number;
  precipZScore: number;
  severityScore: number;
  category: 'SEVERE_HOT_DRY' | 'EXTREME_HOT_DRY' | 'MODERATE_HOT_DRY';
  estimatedReturnPeriodYears: number;
}

export interface CompoundExtremeAnalysis {
  totalCompoundMonths: number;
  compoundFrequencyPercent: number;
  meanReturnPeriodYears: number;
  worstEvent: CompoundExtremeEvent | null;
  decadalCounts: { decade: string; count: number }[];
  events: CompoundExtremeEvent[];
  jointProbability: number;
  bivariateQuadrantDistribution: {
    hotAndDry: number;
    hotAndWet: number;
    coldAndDry: number;
    coldAndWet: number;
    normal: number;
  };
}

export type ProjectionScenario = 'SSP2_45' | 'SSP5_85';

export interface FutureProjectionPoint {
  date: string;
  year: number;
  month: number;
  isHistorical: boolean;
  observedAnomaly?: number;
  ssp245Median: number;
  ssp245Upper: number;
  ssp245Lower: number;
  ssp585Median: number;
  ssp585Upper: number;
  ssp585Lower: number;
}

export interface ScenarioComparison {
  historicalSlopePerDecade: number;
  ssp245SlopePerDecade: number;
  ssp585SlopePerDecade: number;
  ssp245TotalProjectedChange2050: number;
  ssp585TotalProjectedChange2050: number;
  accelerationFactorSSP585: number;
  summaryNarrative: string;
}

// NOAA Marine Heatwave Severity Tiers (Hobday et al. 2018 framework)
export type HeatwaveCategory = 'CAT_I_MODERATE' | 'CAT_II_STRONG' | 'CAT_III_SEVERE' | 'CAT_IV_EXTREME';

export interface MarineHeatwaveEvent {
  id: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  peakDate: string;
  peakValue: number;
  peakAnomaly: number;
  peakThresholdMultiple: number;
  category: HeatwaveCategory;
  cumulativeIntensityDegreeMonths: number;
  impactDescription: string;
}

export interface MarineHeatwaveTimeSeriesPoint {
  date: string;
  year: number;
  month: number;
  raw: number;
  climatology: number;
  threshold90th: number;
  anomaly: number;
  isExceedance: boolean;
  activeCategory?: HeatwaveCategory;
  tierColor?: string;
}

export interface MarineHeatwaveAnalysis {
  totalEvents: number;
  totalMhwMonths: number;
  longestEventDuration: number;
  meanEventDuration: number;
  maxIntensityAnomaly: number;
  categoryBreakdown: {
    moderate: number;
    strong: number;
    severe: number;
    extreme: number;
  };
  events: MarineHeatwaveEvent[];
  points: MarineHeatwaveTimeSeriesPoint[];
  narrative: string;
}

// Fourier PSD & Wavelet Analysis
export interface SpectralDensityPoint {
  frequency: number;
  periodYears: number;
  periodMonths: number;
  power: number;
  significance95: number;
  isSignificant: boolean;
  bandLabel?: string;
}

export interface WaveletTimeSlice {
  date: string;
  year: number;
  annualPower: number;
  qboPower: number;
  ensoPower: number;
  decadalPower: number;
  dominantCycle: string;
}

export interface SpectralAnalysisResult {
  dominantPeriodYears: number;
  dominantPeriodMonths: number;
  dominantBandName: string;
  psdSeries: SpectralDensityPoint[];
  waveletTimeline: WaveletTimeSlice[];
  ensoBandPowerPercent: number;
  qboBandPowerPercent: number;
  annualBandPowerPercent: number;
  decadalBandPowerPercent: number;
  scientificNarrative: string;
}

// Earth System Tipping Point Early Warning (Critical Slowing Down)
export interface TippingEarlyWarningPoint {
  date: string;
  year: number;
  month: number;
  rawResidual: number;
  rollingLag1Autocorrelation: number;
  rollingVariance: number;
  criticalSlowingScore: number;
  riskLevel: 'LOW_RESILIENT' | 'MODERATE_SLOWING' | 'ELEVATED_RISK' | 'CRITICAL_BIFURCATION';
}

export interface TippingPointDiagnostic {
  currentRiskLevel: 'LOW_RESILIENT' | 'MODERATE_SLOWING' | 'ELEVATED_RISK' | 'CRITICAL_BIFURCATION';
  kendallTauAutocorrelation: number;
  kendallTauVariance: number;
  pValAutocorrelation: number;
  pValVariance: number;
  resilienceLossPercent: number;
  criticalSlowingDetected: boolean;
  points: TippingEarlyWarningPoint[];
  biomeSystemVulnerability: string;
  diagnosticVerdict: string;
}

// Fire Weather Index (FWI)
export type FireDangerClass = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';

export interface FireWeatherMonthPoint {
  date: string;
  year: number;
  month: number;
  fwiScore: number;
  tempThermalStress: number;
  soilDroughtStress: number;
  fuelCuringStress: number;
  dangerClass: FireDangerClass;
  isFireSeasonMonth: boolean;
}

export interface FireWeatherAnalysis {
  meanHistoricalFWI: number;
  currentDecadeMeanFWI: number;
  fwiDecadalTrend: number;
  annualFireSeasonLengthDays: number;
  fireSeasonLengthExpansionDaysPerDecade: number;
  cumulativeHighDangerMonths: number;
  biomeBurnVulnerabilityScore: number;
  dominantFuelType: string;
  ignitionVulnerabilityVerdict: string;
  points: FireWeatherMonthPoint[];
  decadalAverages: { decade: string; avgFWI: number; fireSeasonDays: number }[];
}

// MODIS Vegetative Phenology Tracker
export interface PhenologyYearCycle {
  year: number;
  startOfSeasonDOY: number;
  startOfSeasonDate: string;
  peakOfSeasonDOY: number;
  peakOfSeasonDate: string;
  endOfSeasonDOY: number;
  endOfSeasonDate: string;
  growingSeasonLengthDays: number;
  maxNDVI: number;
  annualIntegratedNDVI: number;
}

export interface PhenologyAnalysis {
  baselineGreenUpDOY: number;
  currentGreenUpDOY: number;
  greenUpAdvancementDaysPerDecade: number;
  growingSeasonExpansionDaysPerDecade: number;
  meanGrowingSeasonLengthDays: number;
  productivityTrendPercentPerDecade: number;
  phenologicalShiftVerdict: string;
  annualCycles: PhenologyYearCycle[];
}

// Urban Heat Island (UHI) Microclimate Diagnostic
export interface UrbanHeatIslandMonthPoint {
  date: string;
  year: number;
  month: number;
  urbanCoreTemp: number;
  ruralBaselineTemp: number;
  uhiDelta: number;
  diurnalNighttimeDelta: number;
  canopyCoolingDeficit: number;
  heatVulnerabilityIndex: number;
}

export interface UrbanHeatIslandDiagnostic {
  meanAnnualUhiDelta: number;
  summerPeakUhiDelta: number;
  uhiAmplificationTrendPerDecade: number;
  nighttimeThermalTrapDelta: number;
  canopyVegetationCoverUrbanPercent: number;
  canopyVegetationCoverRuralPercent: number;
  heatVulnerabilityLevel: 'LOW_BUFFERED' | 'MODERATE' | 'SEVERE_TRAP' | 'EXTREME_HAZARD';
  mitigationCoolingPotential: string;
  diagnosticNarrative: string;
  points: UrbanHeatIslandMonthPoint[];
  seasonalProfile: { season: string; delta: number }[];
}

// Cryosphere Mass Point
export interface CryosphereMassPoint {
  date: string;
  year: number;
  month: number;
  cumulativeMassLossGt: number;
  annualRateGtPerYear: number;
  seaLevelRiseContributionMm: number;
  accelerationGtPerYear2: number;
  snowAccumulationPulse: number;
}

export interface GraceIcesatAnalysis {
  totalMassLossGt: number;
  meanDecadalLossRateGtPerDecade: number;
  seaLevelRiseEquivalentMm: number;
  thinningAccelerationGtPerYear2: number;
  isGlaciatedRegion: boolean;
  regionalBasinName: string;
  gravimetrySensor: string;
  cryosphereStabilityClass: 'STABLE_OR_ACCUMULATING' | 'MODERATE_RETREAT' | 'RAPID_DISCHARGE' | 'CASCADING_COLLAPSE';
  diagnosticNarrative: string;
  points: CryosphereMassPoint[];
  decadalLossTotals: { decade: string; lossGt: number; seaLevelMm: number }[];
}

// Aerosol Optical Depth
export type AerosolPlumeType = 'CLEAN_BACKGROUND' | 'WILDFIRE_SMOKE' | 'SAHARAN_DUST' | 'URBAN_SMOG' | 'VOLCANIC_SULFATE';

export interface AerosolTimePoint {
  date: string;
  year: number;
  month: number;
  aod550nm: number;
  aodAnomaly: number;
  solarDimmingWattsM2: number;
  ccnAnomalyPercent: number;
  dominantPlumeType: AerosolPlumeType;
  plumeSeverityTier: 'MODERATE' | 'HEAVY' | 'EXTREME' | 'NORMAL';
}

export interface CalipsoVerticalLayer {
  altitudeKm: number;
  backscatterCoeff: number;
  depolarizationRatio: number;
  classifiedAerosolSubtype: string;
}

export interface AerosolAodAnalysis {
  meanHistoricalAOD: number;
  peakAODObservation: number;
  aodDecadalTrendPerDecade: number;
  meanSurfaceDimmingWattsM2: number;
  plumeIntrusionEventsCount: number;
  dominantPlumeOrigin: string;
  cloudMicrophysicsFeedback: string;
  points: AerosolTimePoint[];
  calipsoProfile: CalipsoVerticalLayer[];
  narrative: string;
}

// OCO-2 Carbon Cycle
export interface CarbonCyclePoint {
  date: string;
  year: number;
  month: number;
  xco2Ppm: number;
  xco2AnomalyPpm: number;
  netEcosystemExchangeGCM2Month: number;
  photosyntheticDrawdownGpp: number;
  ecosystemRespirationReco: number;
  isNetCarbonSink: boolean;
}

export interface CarbonCycleAnalysis {
  currentXCO2Ppm: number;
  xco2GrowthRatePpmPerYear: number;
  meanAnnualNeeGCM2Yr: number;
  seasonalDrawdownAmplitudePpm: number;
  sinkToSourceStatus: 'VIGOROUS_CARBON_SINK' | 'WEAKENING_CARBON_SINK' | 'NEUTRAL_BUFFER' | 'ACTIVE_NET_CARBON_SOURCE';
  biomeCarbonStorageVulnerability: string;
  annualBalanceMtC: number;
  narrative: string;
  points: CarbonCyclePoint[];
  decadalDrawdownShifts: { decade: string; drawdownPpm: number; annualNee: number }[];
}

// Ocean Acidification & Aragonite Saturation
export interface OceanAcidificationPoint {
  date: string;
  year: number;
  month: number;
  oceanPh: number;
  phAnomaly: number;
  aragoniteSaturationOmega: number;
  carbonateIonConcentrationUmol: number;
  calcificationStressIndex: number;
  isUndersaturatedCorrosive: boolean;
}

export interface OceanAcidificationAnalysis {
  currentPh: number;
  phDecadalDrop: number;
  currentOmegaAragonite: number;
  omegaDecadalTrend: number;
  undersaturationHorizonYear: number;
  calcifyingEcosystemVulnerability: 'LOW' | 'VULNERABLE' | 'SEVERE_CORROSIVE' | 'LETHAL_DISSOLUTION';
  ecosystemAtRisk: string;
  oceanBasinName: string;
  narrative: string;
  points: OceanAcidificationPoint[];
  decadalPhProfile: { decade: string; meanPh: number; meanOmega: number }[];
}

// TROPOMI Methane Degassing
export interface MethaneFluxPoint {
  date: string;
  year: number;
  month: number;
  ch4ColumnPpb: number;
  ch4AnomalyPpb: number;
  ebullitionFluxMgM2Day: number;
  thawDepthActiveLayerCm: number;
  warmingPotentialGwp20Factor: number;
}

export interface MethaneDegassingAnalysis {
  meanCH4Ppb: number;
  ch4DecadalGrowthRatePpb: number;
  meanAnnualEbullitionTgYr: number;
  activeLayerThawDeepeningCmPerDecade: number;
  wetlandBiomeType: string;
  gwp20EquivalentMultiplier: number;
  ebullitionPulseSeasonality: string;
  degassingStatus: 'STABLE_BACKGROUND' | 'MODERATE_THAW' | 'ACCELERATED_VENTING' | 'RUNAWAY_EBULLITION';
  narrative: string;
  points: MethaneFluxPoint[];
  seasonalEbullitionCurve: { month: string; flux: number }[];
}

// Coastal Inundation
export interface InundationScenarioResult {
  seaLevelRiseMeters: number;
  inundatedAreaKm2: number;
  highTideNuisanceFloodDaysPerYear: number;
  displacedPopulationEstimate: number;
  criticalInfrastructureSitesAtRisk: number;
  economicExposureBillionUsd: number;
}

export interface CoastalInundationAnalysis {
  currentSeaLevelAnomalyMm: number;
  localSeaLevelRiseTrendMmPerYear: number;
  projected2050RiseMeters: number;
  nuisanceFloodFrequencyMultiplier: number;
  coastalZoneName: string;
  elevationBufferMeters: number;
  stormSurge100YrWaterLevelMeters: number;
  scenarios: InundationScenarioResult[];
  historicalFloodDaysTimeline: { year: number; floodDays: number }[];
  narrative: string;
}

// GRACE Aquifer Depletion
export interface AquiferStoragePoint {
  date: string;
  year: number;
  month: number;
  twsAnomalyCm: number;
  groundwaterDeficitKm3: number;
  depletionRateKm3PerYear: number;
  rechargeStressRatio: number;
  isChronicDepletion: boolean;
}

export interface AquiferDepletionAnalysis {
  aquiferBasinName: string;
  totalVolumetricLossKm3: number;
  annualDepletionRateKm3PerYear: number;
  depletionTrendCategory: 'SUSTAINABLE_RECHARGE' | 'MODERATE_OVERDRAFT' | 'SEVERE_CHRONIC_DEPLETION' | 'CRITICAL_AQUIFER_COLLAPSE';
  yearsUntilUsableStorageDepleted: number;
  agriculturalExtractionFractionPercent: number;
  narrative: string;
  points: AquiferStoragePoint[];
  decadalDeficitTotals: { decade: string; lostKm3: number }[];
}

// Crop Heat Stress
export interface CropHeatStressPoint {
  date: string;
  year: number;
  month: number;
  extremeDegreeDaysWheat30C: number;
  extremeDegreeDaysMaize32C: number;
  canopyTempAnomaly: number;
  soilMoistureDeficitIndex: number;
  heatDroughtCompoundedPenalty: number;
  isCriticalGrainFillingMonth: boolean;
}

export interface CropHeatStressAnalysis {
  agriculturalBasinName: string;
  stapleCropsMonitored: string[];
  annualExtremeDegreeDaysTrendPerDecade: number;
  estimatedWheatYieldLossPercent: number;
  estimatedMaizeYieldLossPercent: number;
  cropYieldVulnerabilityClass: 'LOW_CLIMATE_RISK' | 'MODERATE_YIELD_ATTRITION' | 'SEVERE_HEAT_STERILITY' | 'CATASTROPHIC_CROP_FAILURE';
  criticalGrainFillingMonths: string;
  narrative: string;
  points: CropHeatStressPoint[];
  annualEddHistory: { year: number; eddWheat: number; eddMaize: number }[];
}

// Argo Ocean Heat Content (OHC)
export interface OceanHeatDepthPoint {
  depthMeters: number;
  baselineTempCelsius: number;
  currentTempCelsius: number;
  thermalAnomalyDeltaC: number;
  heatContentZJPerLayer: number;
  stericExpansionMmPerLayer: number;
}

export interface OceanHeatTimePoint {
  date: string;
  year: number;
  month: number;
  ohc0_700mZJ: number;
  ohc0_2000mZJ: number;
  thermostericSeaLevelMm: number;
  surfaceWarmingRateC: number;
  deepPenetrationRateC: number;
}

export interface OceanHeatContentAnalysis {
  currentOhc2000mZJ: number;
  ohcDecadalRateZJPerDecade: number;
  stericSeaLevelRiseTotalMm: number;
  energyImbalanceWattsM2: number;
  basinStratificationIndex: number;
  oceanBasinName: string;
  narrative: string;
  points: OceanHeatTimePoint[];
  verticalProfile: OceanHeatDepthPoint[];
}

// MERRA-2 Jet Stream & Rossby Waves
export interface JetStreamTimePoint {
  date: string;
  year: number;
  month: number;
  meanJetLatitudeNorth: number;
  jetLatitudeAnomalyDeg: number;
  rossbyWaveAmplitudeMs: number;
  blockingFrequencyDaysPerMonth: number;
  coldAirOutbreakProbabilityPercent: number;
  jetStreamSpeedMs: number;
}

export interface JetStreamRossbyAnalysis {
  meanJetLatitudeDegN: number;
  jetLatitudeShiftTrendDegPerDecade: number;
  rossbyWavinessIncreasePercent: number;
  annualBlockingDaysTotal: number;
  coldAirOutbreakRiskTier: 'LOW_ZONAL' | 'MODERATE_WAVY' | 'SEVERE_MEANDER' | 'EXTREME_POLAR_VORTEX_DISRUPTION';
  blockingHotspots: string;
  narrative: string;
  points: JetStreamTimePoint[];
  seasonalWavinessProfile: { season: string; wavinessMs: number; blockingDays: number }[];
}

// Glacier Velocity & Calving Flux
export interface GlacierVelocityPoint {
  date: string;
  year: number;
  month: number;
  surfaceVelocityMetersPerYear: number;
  groundingLineRetreatMeters: number;
  iceCalvingDischargeFluxGtYr: number;
  shearMarginStrainRatePerYear: number;
  isSurgeEpisode: boolean;
}

export interface GlacierFlowVector {
  segmentDistanceKm: number;
  elevationMeters: number;
  iceVelocityMetersPerYear: number;
  iceThicknessMeters: number;
  basalMeltRateMetersPerYear: number;
}

export interface GlacierVelocityAnalysis {
  glacierBasinName: string;
  currentTerminusVelocityMYr: number;
  velocityAccelerationTrendPercentPerDecade: number;
  groundingLineTotalRetreatKm: number;
  annualCalvingDischargeGtYr: number;
  structuralDestabilizationClass: 'STEADY_FLOW' | 'MODERATE_ACCELERATION' | 'UNGROUNDING_SURGE' | 'RUNAWAY_DYNAMIC_DISCHARGE';
  narrative: string;
  points: GlacierVelocityPoint[];
  flowlineProfile: GlacierFlowVector[];
}

// -------------------------------------------------------------
// NEW: CYCLONE ACE, PERMAFROST THAW & SRM GEOENGINEERING TYPES
// -------------------------------------------------------------

// 1. Accumulated Cyclone Energy (ACE) & Tropical Cyclone Intensification
export interface CycloneYearStat {
  year: number;
  annualAceIndex: number;         // 10^4 knots^2
  namedStormCount: number;
  hurricaneCount: number;
  majorHurricaneCat45Count: number;
  rapidIntensificationEvents: number;
  meanSstCelsius: number;
  verticalWindShearKnots: number;
}

export interface CycloneAceAnalysis {
  cycloneBasinName: string;
  meanAnnualAceIndex: number;     // e.g. 128 (10^4 kt^2)
  aceDecadalTrend: number;        // ACE increase per decade
  majorHurricaneSharePercent: number; // Share of Cat 4/5 storms
  rapidIntensificationSurgePercent: number; // +% RI events
  criticalSstThresholdCrossed: boolean; // SST > 26.5°C threshold
  cycloneEscalationTier: 'NORMAL_CYCLONIC_BASELINE' | 'ELEVATED_INTENSITY' | 'SEVERE_CATEGORY_ESCALATION' | 'HYPER_INTENSE_REGIME';
  narrative: string;
  historicalYears: CycloneYearStat[];
  sstWindShearMatrix: { sst: number; shear: number; potentialIntensityKts: number }[];
}

// 2. Permafrost Thaw & Microbial Carbon Decomposition
export interface PermafrostThawYearPoint {
  year: number;
  activeLayerDepthMeters: number;     // Summer thaw depth (m)
  organicCarbonPoolExposedPg: number; // Petagrams (Gt C) thawed
  microbialCo2ReleaseTgYr: number;    // Aerobic decomposition CO2 (Tg/yr)
  microbialCh4ReleaseTgYr: number;    // Anaerobic methanogenesis CH4 (Tg/yr)
  ch4ToCo2RatioPercent: number;
  radiativeForcingWm2: number;        // Top-of-atmosphere radiative forcing (W/m²)
  soilTemperature1mDepthC: number;
}

export interface PermafrostThawAnalysis {
  tundraBasinName: string;
  currentActiveLayerDepthMeters: number;
  thawDeepeningRateCmPerDecade: number;
  cumulativeThawedCarbonPg: number;   // Total Pg C mobilized
  annualTotalCarbonEquivalentEmissionTgYr: number;
  methanogenesisFractionPercent: number;
  permafrostVulnerabilityClass: 'CONTINUOUS_STABLE' | 'DISCONTINUOUS_VULNERABLE' | 'DEEP_ACTIVE_THERMOKARST' | 'CASCADING_PERMAFROST_COLLAPSE';
  narrative: string;
  yearlyProgression: PermafrostThawYearPoint[];
  seasonalGasReleaseProfile: { month: string; co2: number; ch4: number }[];
}

// 3. Solar Radiation Management (SRM) & Stratospheric Aerosol Injection (SAI)
export interface SrmSimulationScenario {
  sulfateAodOffset: number;           // Stratospheric aerosol optical depth (0.0 to 0.4)
  surfaceAlbedoAdjustment: number;    // Regional albedo modifier (0.00 to +0.08)
  projectedSurfaceCoolingDeltaC: number; // Net cooling achieved (-0.2°C to -2.4°C)
  precipitationDisruptionPenaltyPercent: number; // Hydrological cycle attenuation (% drop in rain)
  terminationShockWarmingRateCPerDecade: number; // Catastrophic rebound rate upon abrupt cessation
  ozoneDepletionFactorPercent: number; // Catalytic halogen destruction on sulfate droplets (%)
  sunlightDimmingPercent: number;     // Direct solar irradiance dimming (%)
  feasibilityAssessment: 'OPTIMAL_MICRO_DOSE' | 'MODERATE_INTERVENTION' | 'HIGH_PRECIP_RISK' | 'EXTREME_TERMINATION_HAZARD';
}

export interface SrmGeoengineeringAnalysis {
  regionalBiomeName: string;
  baselineTemperatureC: number;
  activeScenario: SrmSimulationScenario;
  preconfiguredScenarios: SrmSimulationScenario[];
  coolingVsPrecipCurve: { sulfateTg: number; coolingC: number; precipDropPct: number }[];
  narrative: string;
}

// Base Earth Variable & Hotspots
export interface EarthVariable {
  id: string;
  name: string;
  shortCode: string;
  sphere: EarthSphere;
  instrumentOrModel: string;
  agency: string;
  unit: string;
  definition: string;
  whyItMatters: string;
  typicalSeasonality: string;
  iconName: string;
  isNonUsGov?: boolean;
  licenseNote?: string;
  liveApiSupported?: boolean;
  /** Which backend provider serves this variable (see backend/seriesService.js) */
  provider?: 'power' | 'giovanni' | 'noaa-gml' | 'earthengine';
  /** 'global' = a single worldwide reference series (region-independent) */
  scope?: 'point' | 'global';
  /** First year of the satellite / reanalysis record */
  startYear?: number;
  /** Native grid resolution of the product */
  resolution?: string;
  /** Plain-language limitation shown next to results */
  caveat?: string;
  /** Short plain-English question this variable helps answer (used by the guided wizard) */
  question?: string;
  /** Which direction counts as "more": drives plain-language wording */
  higherMeans?: string;
}

export interface RegionHotspot {
  id: string;
  name: string;
  coordinates: { lat: number; lon: number };
  biome: string;
  description: string;
  continent: string;
  swotReachId?: string;
  canadaHydrometricId?: string;
  noaaStationId?: string;
}

export interface TimeSeriesPoint {
  date: string;
  year: number;
  month: number;
  raw: number;
  climatology: number;
  anomaly: number;
  zScore: number;
  trend: number;
  ciUpper: number;
  ciLower: number;
  isExtremeWarmOrHigh?: boolean;
  isExtremeColdOrDry?: boolean;
  climateIndexVal?: number;
  climateIndexPhase?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface ChangepointAnalysis {
  hasChangepoint: boolean;
  date: string;
  year: number;
  month: number;
  index: number;
  kStatistic: number;
  /** Autocorrelation-corrected p-value (authoritative) */
  pValue: number;
  /** Classic Pettitt p-value assuming independent observations (for comparison only) */
  naivePValue?: number;
  effectiveN?: number;
  significance: 'SIGNIFICANT_SHIFT' | 'POSSIBLE_SHIFT' | 'NO_SHIFT';
  preMean: number;
  postMean: number;
  preSlopePerDecade: number;
  postSlopePerDecade: number;
  deltaMean: number;
  interpretation: string;
}

export interface DecompositionPoint {
  date: string;
  raw: number;
  trend: number;
  seasonal: number;
  residual: number;
}

export interface TimeSeriesDecomposition {
  points: DecompositionPoint[];
  peakMonthName: string;
  peakMonthNumber: number;
  troughMonthName: string;
  troughMonthNumber: number;
  annualAmplitude: number;
  seasonalVariancePercent: number;
  trendVariancePercent: number;
  residualVariancePercent: number;
}

export interface BivariateScatterPoint {
  date: string;
  xValue: number;
  yValue: number;
  xAnomaly: number;
  yAnomaly: number;
}

export interface LeadLagPoint {
  lagMonths: number;
  correlation: number;
}

export interface BivariateCorrelationResult {
  pearsonR: number;
  pearsonPValue: number;
  spearmanRho: number;
  spearmanPValue: number;
  rSquared: number;
  optimalLagMonths: number;
  optimalLagCorrelation: number;
  leadLagSeries: LeadLagPoint[];
  scatterData: BivariateScatterPoint[];
  relationshipNarrative: string;
}

export interface StatisticalAnalysisResult {
  sampleSize: number;
  timeRangeYears: number;
  startDate: string;
  endDate: string;
  baselineUsed: BaselinePeriod;
  slopePerYear: number;
  slopePerDecade: number;
  totalChange: number;
  unit: string;
  rSquared: number;
  pearsonR: number;
  tStatistic: number;
  pValueTTest: number;
  mkSScore: number;
  mkZScore: number;
  mkPValue: number;
  sensSlope: number;
  sensSlopePerDecade: number;
  sensCiLowerPerDecade: number;
  sensCiUpperPerDecade: number;
  lag1Autocorrelation: number;
  effectiveSampleSize: number;
  hamedRaoMkZ: number;
  hamedRaoMkPValue: number;
  adjustedTStat: number;
  adjustedPValueTTest: number;
  seasonalMkS: number;
  seasonalMkZ: number;
  seasonalMkPValue: number;
  seasonalSensSlopePerDecade: number;
  adfStatistic: number;
  adfCriticalValue5Pct: number;
  isTrendStationary: boolean;
  stationarityVerdict: string;
  statisticalPowerPercent: number;
  timeOfEmergenceYears: number;
  isAutocorrelationDeflated: boolean;
  direction: 'INCREASING' | 'DECREASING' | 'STABLE';
  significanceCategory: SignificanceLevel;
  verdictText: string;
  changepoint: ChangepointAnalysis;
}

export interface CaseStudyPreset {
  id: string;
  title: string;
  subtitle: string;
  paradoxLesson: string;
  variableId: string;
  secondaryVariableId?: string;
  primaryRegionId: string;
  secondaryRegionId?: string;
  badge: string;
  targetLabTab?: string;
}

export interface DataProvenanceInfo {
  /**
   * LIVE_AGENCY_API : fetched from the agency just now (or served from a fresh cache of a live fetch)
   * CACHED_REAL     : agency was unreachable; serving an earlier REAL fetch of this exact request
   * EMPIRICAL_BENCHMARK : published reference values (not a time series we computed from raw data)
   */
  mode: 'LIVE_AGENCY_API' | 'CACHED_REAL' | 'EMPIRICAL_BENCHMARK';
  sourceAgency: string;
  endpointOrArchive: string;
  license: string;
  isNonUsGov: boolean;
  latencyMs?: number;
  cached?: boolean;
  elevationMeters?: number;
  product?: string;
  doi?: string | null;
  nativeResolution?: string;
  fetchedAt?: string;
  recordStart?: string;
  recordEnd?: string;
  months?: number;
  interpolatedMonths?: number;
  caveat?: string;
  staleReason?: string;
}

export interface FdrHypothesisResult {
  id: string;
  regionName: string;
  variableName: string;
  slopePerDecade: number;
  unit: string;
  naiveMkPValue: number;
  hamedRaoPValue: number;
  bhAdjustedQValue: number;
  survivesFdr05: boolean;
  falsePositiveCaught: boolean;
}

export interface SwotObservation {
  timestamp: string;
  date: string;
  wse: number;
  width: number | null;
  areaKm2: number | null;
  dischargeM3s: number | null;
  slopeMmPerKm: number | null;
  wseUncertainty: number;
}

export interface SwotTargetPreset {
  id: string;
  name: string;
  country: 'Canada' | 'USA' | 'Brazil' | 'Global';
  featureType: 'Reach' | 'PriorLake';
  featureId: string;
  canadaHydrometricStation?: string;
  coordinates: { lat: number; lon: number };
  scientificContext: string;
}

export interface RiverPlumeSite {
  id: string;
  riverName: string;
  countryOrOcean: string;
  bounds: { south: number; north: number; west: number; east: number };
  distanceOffshoreKm: number;
  meanDischargeM3s: number;
  sedimentLoadMtYr: number;
  humanImpactTier: 'LOW_PRISTINE' | 'HIGH_DAMMED_REGULATED' | 'INTENSE_NUTRIENT_SURGE' | 'MARINE_UPWELLING_DOMINATED';
  ackerObservedSlopeMgM3Yr: number;
  ackerR2: number;
  ackerSignificant: boolean;
  baselineChlAMgM3: number;
  seasonalPeakMonth: number;
  seasonalAmpMgM3: number;
  detectiveTwist: string;
  watershedDrivers: string;
}
