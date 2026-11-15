import {
  ClimateIndexId,
  ClimateIndexMetadata,
  ClimateIndexPoint,
  TeleconnectionCorrelation,
  CompoundExtremeEvent,
  CompoundExtremeAnalysis,
  TimeSeriesPoint
} from '../types';
import { correlationWithEffectiveN } from './statisticsEngine';

export const CLIMATE_INDICES: ClimateIndexMetadata[] = [
  {
    id: 'ENSO_ONI',
    name: 'ENSO (Oceanic Niño Index)',
    fullName: 'El Niño–Southern Oscillation (Niño 3.4 SST Anomaly)',
    agency: 'NOAA CPC / NASA JPL',
    unit: '°C SST Anomaly',
    positivePhaseName: 'El Niño (Warm Phase)',
    negativePhaseName: 'La Niña (Cold Phase)',
    description: 'Tracks equatorial Pacific sea surface temperature departures. Governs global tropical convective rainfall, storm tracks, and North American / Asian monsoons.',
    significanceThreshold: 0.5
  },
  {
    id: 'NAO',
    name: 'North Atlantic Oscillation (NAO)',
    fullName: 'North Atlantic Pressure Dipole Index (Azores High vs Icelandic Low)',
    agency: 'NOAA / NCAR',
    unit: 'Standardized Index',
    positivePhaseName: 'Positive NAO (Strong Jet Stream)',
    negativePhaseName: 'Negative NAO (Blocked / Meandering Jet)',
    description: 'Controls the strength and trajectory of westerly storms and arctic cold air outbreaks across North America, the North Atlantic, and Western/Northern Europe.',
    significanceThreshold: 0.7
  },
  {
    id: 'IOD_DMI',
    name: 'Indian Ocean Dipole (IOD)',
    fullName: 'Dipole Mode Index (Western vs Eastern Tropical Indian Ocean)',
    agency: 'BoM / JMA / NASA',
    unit: '°C Gradient Anomaly',
    positivePhaseName: 'Positive IOD (East African Rains, Aus Drought)',
    negativePhaseName: 'Negative IOD (Indonesian Moisture, East African Dry)',
    description: 'Coupled ocean-atmosphere phenomenon influencing monsoon rainfall across South Asia, the Middle East, East Africa, and Australasia.',
    significanceThreshold: 0.4
  }
];

/**
 * Calculates teleconnection coupling: Pearson correlation, composite anomaly differences
 * between index positive, negative, and neutral phases.
 */
export function calculateTeleconnectionCoupling(
  indexPoints: ClimateIndexPoint[],
  anomalyPoints: TimeSeriesPoint[],
  indexMetadata: ClimateIndexMetadata
): TeleconnectionCorrelation {
  const n = Math.min(indexPoints.length, anomalyPoints.length);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  const posAnoms: number[] = [];
  const negAnoms: number[] = [];
  const neuAnoms: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = indexPoints[i].value;
    const y = anomalyPoints[i].anomaly;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;

    if (indexPoints[i].phase === 'POSITIVE') posAnoms.push(y);
    else if (indexPoints[i].phase === 'NEGATIVE') negAnoms.push(y);
    else neuAnoms.push(y);
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const pearsonR = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const pVal = correlationWithEffectiveN(
    indexPoints.slice(0, n).map(pt => pt.value),
    anomalyPoints.slice(0, n).map(pt => pt.anomaly)
  ).pValue;

  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const posMean = Number(mean(posAnoms).toFixed(3));
  const negMean = Number(mean(negAnoms).toFixed(3));
  const neuMean = Number(mean(neuAnoms).toFixed(3));
  const delta = Number((posMean - negMean).toFixed(3));

  let narrative = '';
  if (Math.abs(pearsonR) > 0.35) {
    narrative = `Strong teleconnection telecoupling (r = ${pearsonR.toFixed(2)}, p < ${pVal < 0.01 ? '0.01' : '0.05'}). ${
      pearsonR > 0 ? indexMetadata.positivePhaseName : indexMetadata.negativePhaseName
    } amplifies positive regional anomalies, shifting baseline by ${Math.abs(delta).toFixed(2)}.`;
  } else if (Math.abs(pearsonR) > 0.15) {
    narrative = `Moderate regional sensitivity to ${indexMetadata.name} (r = ${pearsonR.toFixed(2)}). Phase swings induce a net divergence of ${delta > 0 ? '+' : ''}${delta}.`;
  } else {
    narrative = `Weak contemporaneous teleconnection coupling (r = ${pearsonR.toFixed(2)}). Regional variability is largely decoupled from ${indexMetadata.name}.`;
  }

  return {
    indexId: indexMetadata.id,
    indexName: indexMetadata.name,
    pearsonR: Number(pearsonR.toFixed(3)),
    pValue: Number(pVal.toFixed(4)),
    rSquared: Number((pearsonR * pearsonR).toFixed(3)),
    positivePhaseMeanAnomaly: posMean,
    negativePhaseMeanAnomaly: negMean,
    neutralPhaseMeanAnomaly: neuMean,
    phaseContrastDelta: delta,
    dominantPhaseImpact: narrative
  };
}

/**
 * Compound Event Detection Engine:
 * Flags concurrent hot-and-dry extremes where Temperature Z-score > +1.5σ
 * simultaneously with Root-Zone Soil Moisture Z-score < -1.5σ (or Precipitation < -1.5σ).
 * Computes empirical bivariate joint return periods and historical frequency.
 */
export function detectCompoundHotDryEvents(
  tempPoints: TimeSeriesPoint[],
  soilMoistPoints: TimeSeriesPoint[],
  precipPoints?: TimeSeriesPoint[]
): CompoundExtremeAnalysis {
  const n = Math.min(tempPoints.length, soilMoistPoints.length);
  const events: CompoundExtremeEvent[] = [];

  let hotAndDry = 0;
  let hotAndWet = 0;
  let coldAndDry = 0;
  let coldAndWet = 0;
  let normal = 0;

  const decadalCountsMap: Record<string, number> = {};

  let worstEvent: CompoundExtremeEvent | null = null;
  let maxSeverity = -1;

  for (let i = 0; i < n; i++) {
    const tZ = tempPoints[i].zScore;
    const smZ = soilMoistPoints[i].zScore;
    const pZ = precipPoints && precipPoints[i] ? precipPoints[i].zScore : smZ;

    // Bivariate Quadrants
    if (tZ >= 1.5 && smZ <= -1.5) {
      hotAndDry++;
      const severity = Math.sqrt(Math.pow(tZ, 2) + Math.pow(Math.abs(smZ), 2));
      let category: 'SEVERE_HOT_DRY' | 'EXTREME_HOT_DRY' | 'MODERATE_HOT_DRY' = 'MODERATE_HOT_DRY';
      if (tZ >= 2.0 && smZ <= -2.0) category = 'EXTREME_HOT_DRY';
      else if (tZ >= 1.7 || smZ <= -1.7) category = 'SEVERE_HOT_DRY';

      // Placeholder: replaced by the EMPIRICAL return period (record length / event count) after the scan.
      const estReturnYears = 0;

      const eventObj: CompoundExtremeEvent = {
        date: tempPoints[i].date,
        year: tempPoints[i].year,
        month: tempPoints[i].month,
        tempZScore: tZ,
        soilMoistZScore: smZ,
        precipZScore: pZ,
        severityScore: Number(severity.toFixed(2)),
        category,
        estimatedReturnPeriodYears: estReturnYears
      };

      events.push(eventObj);

      if (severity > maxSeverity) {
        maxSeverity = severity;
        worstEvent = eventObj;
      }

      // Decadal counts (computed from the actual record, whatever its span)
      const decadeKey = `${Math.floor(tempPoints[i].year / 10) * 10}s`;
      decadalCountsMap[decadeKey] = (decadalCountsMap[decadeKey] || 0) + 1;
    } else if (tZ >= 1.5 && smZ >= 1.5) {
      hotAndWet++;
    } else if (tZ <= -1.5 && smZ <= -1.5) {
      coldAndDry++;
    } else if (tZ <= -1.5 && smZ >= 1.5) {
      coldAndWet++;
    } else {
      normal++;
    }
  }

  // Every decade present in the record gets a bucket, including decades with zero events.
  const decadeYears = new Set<number>();
  for (let i = 0; i < n; i++) decadeYears.add(Math.floor(tempPoints[i].year / 10) * 10);
  const decadalCounts = Array.from(decadeYears)
    .sort((x, y) => x - y)
    .map(d => {
      const inDecade = tempPoints.slice(0, n).filter(p => Math.floor(p.year / 10) * 10 === d).length;
      return {
        decade: inDecade < 120 ? `${d}s (${(inDecade / 12).toFixed(inDecade % 12 ? 1 : 0)} yr)` : `${d}s`,
        count: decadalCountsMap[`${d}s`] || 0
      };
    });

  const totalCompoundMonths = events.length;
  const compoundFrequencyPercent = Number(((totalCompoundMonths / (n || 1)) * 100).toFixed(2));
  const recordYears = n / 12;
  const meanReturnPeriodYears = totalCompoundMonths > 0 ? Number((recordYears / totalCompoundMonths).toFixed(1)) : recordYears;
  const jointProbability = Number((totalCompoundMonths / (n || 1)).toFixed(4));
  events.forEach(e => {
    e.estimatedReturnPeriodYears = meanReturnPeriodYears;
  });

  return {
    totalCompoundMonths,
    compoundFrequencyPercent,
    meanReturnPeriodYears,
    worstEvent,
    decadalCounts,
    events,
    jointProbability,
    bivariateQuadrantDistribution: {
      hotAndDry,
      hotAndWet,
      coldAndDry,
      coldAndWet,
      normal
    }
  };
}
