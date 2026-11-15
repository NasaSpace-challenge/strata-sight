import { DataProvenanceInfo, EarthVariable, StatisticalAnalysisResult, TimeSeriesPoint } from '../types';

export type Confidence = 'VERY_HIGH' | 'HIGH' | 'LOW' | 'NONE';

export interface Verdict {
  direction: 'UP' | 'DOWN' | 'FLAT';
  confidence: Confidence;
  /** One-line answer, e.g. "Cloud cover is falling here, and it is very unlikely to be chance." */
  headline: string;
  what: string;
  where: string;
  howMuch: string;
  isItReal: string;
  caution: string[];
  /** Technical one-liner for the expert view */
  technical: string;
  /** Percent change over the record, only when it is meaningful (strictly positive, non-temperature quantities) */
  percentChange: number | null;
}

const TEMPERATURE_UNIT = /°C|°F|\bK\b/;

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return '0';
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  return Number(n.toPrecision(2)).toString();
}

function pText(p: number): string {
  return p <= 0.0001 ? '< 0.0001' : String(p);
}

function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
}

export function confidenceFrom(stats: StatisticalAnalysisResult): Confidence {
  switch (stats.significanceCategory) {
    case 'HIGHLY_SIGNIFICANT':
      return 'VERY_HIGH';
    case 'SIGNIFICANT':
      return 'HIGH';
    case 'EMERGING':
      return 'LOW';
    default:
      return 'NONE';
  }
}

/**
 * Turns the statistics into the four questions the challenge asks:
 * what is changing, where, how much, and is it statistically meaningful.
 * Pure function of real inputs: no randomness, no canned numbers.
 */
export function buildVerdict(
  stats: StatisticalAnalysisResult,
  variable: EarthVariable,
  regionLabel: string,
  points: TimeSeriesPoint[],
  provenance?: DataProvenanceInfo | null,
  isGlobal = false
): Verdict {
  const confidence = confidenceFrom(stats);
  const direction: Verdict['direction'] =
    confidence === 'NONE' || stats.direction === 'STABLE' ? 'FLAT' : stats.sensSlopePerDecade > 0 ? 'UP' : 'DOWN';

  const years = stats.timeRangeYears;
  const first = stats.startDate.slice(0, 4);
  const last = stats.endDate.slice(0, 4);
  const name = variable.name;
  const higher = variable.higherMeans ? ` (higher means ${variable.higherMeans})` : '';

  // Magnitude: Sen's slope is the robust estimate; fall back to OLS if it is degenerate.
  const perDecade = stats.sensSlopePerDecade !== 0 ? stats.sensSlopePerDecade : stats.slopePerDecade;
  const total = perDecade * (years / 10);
  const lo = stats.sensCiLowerPerDecade;
  const hi = stats.sensCiUpperPerDecade;

  // Relative change only where a percentage means something
  const raws = points.map(p => p.raw);
  const mean = raws.length ? raws.reduce((a, b) => a + b, 0) / raws.length : 0;
  const strictlyPositive = raws.length > 0 && raws.every(v => v > 0);
  const percentChange =
    strictlyPositive && !TEMPERATURE_UNIT.test(variable.unit) && mean > 0 ? (total / mean) * 100 : null;

  const dirWord = direction === 'UP' ? 'rising' : direction === 'DOWN' ? 'falling' : 'not changing clearly';

  let isItReal: string;
  let chance: string;
  switch (confidence) {
    case 'VERY_HIGH':
      chance = 'is very unlikely to be chance';
      isItReal = `Very likely real. After accounting for month-to-month memory in the data, the chance of seeing a trend this strong from random variation alone is under 1 in 100 (p* ${pText(stats.hamedRaoMkPValue).startsWith('<') ? pText(stats.hamedRaoMkPValue) : '= ' + pText(stats.hamedRaoMkPValue)}).`;
      break;
    case 'HIGH':
      chance = 'is unlikely to be chance';
      isItReal = `Probably real. The chance of a trend this strong from random variation alone is under 1 in 20 (p* = ${pText(stats.hamedRaoMkPValue)}), but it is not overwhelming evidence.`;
      break;
    case 'LOW':
      chance = 'could still be chance';
      isItReal = stats.isAutocorrelationDeflated
        ? `Not convincing. A simple test says "significant", but the data have strong month-to-month memory, which makes simple tests overconfident. Once that is corrected (p* = ${pText(stats.hamedRaoMkPValue)}) the trend could easily be natural variability.`
        : `Suggestive, not proven. The trend points one way (p* = ${pText(stats.hamedRaoMkPValue)}) but the record is too noisy or too short to rule out chance.`;
      break;
    default:
      chance = 'is indistinguishable from natural variation';
      isItReal = `No evidence of a trend. The small slope we see is the kind of wobble expected from natural variability alone (p* = ${pText(stats.hamedRaoMkPValue)}). Not finding a trend is a valid scientific result.`;
  }

  const where = isGlobal
    ? 'A single worldwide reference series (not tied to a place).'
    : `${regionLabel}${
        provenance?.nativeResolution ? `, measured on a ${provenance.nativeResolution} grid cell` : ''
      }.`;

  const what =
    direction === 'FLAT'
      ? `${name}${higher} shows no clear long-term change from ${first} to ${last}.`
      : `${name}${higher} is ${dirWord} from ${first} to ${last}.`;

  const howMuch =
    direction === 'FLAT'
      ? `The best-fit change is ${signed(perDecade)} ${stats.unit} per decade, with a plausible range of ${signed(lo)} to ${signed(hi)}, which includes zero.`
      : `About ${signed(perDecade)} ${stats.unit} per decade (plausible range ${signed(lo)} to ${signed(hi)}), roughly ${signed(total)} ${stats.unit} over ${years.toFixed(0)} years${
          percentChange !== null ? `, or ${percentChange > 0 ? '+' : '−'}${Math.abs(percentChange).toFixed(Math.abs(percentChange) < 10 ? 1 : 0)}% of the average level` : ''
        }.`;

  const headline =
    direction === 'FLAT'
      ? `${name}: no clear trend here (the change ${chance}).`
      : `${name} is ${dirWord} here, and the change ${chance}.`;

  const caution: string[] = [];
  if (years < 20) caution.push(`Only ${years.toFixed(0)} years of data: short records give weak evidence.`);
  if (stats.changepoint?.hasChangepoint && direction !== 'FLAT') {
    caution.push(
      `The record has a step change around ${stats.changepoint.date}, so "steady trend" may be too simple a description.`
    );
  }
  if (provenance?.interpolatedMonths) {
    caution.push(`${provenance.interpolatedMonths} missing month(s) were filled by interpolation.`);
  }
  if (provenance?.caveat) caution.push(provenance.caveat);
  if (confidence !== 'NONE') {
    caution.push('A real trend is not automatically caused by humans: this tool detects change, it does not attribute it.');
  }

  const technical =
    `Sen's slope ${signed(perDecade)} ${stats.unit}/dec [${signed(lo)}, ${signed(hi)}] • ` +
    `Mann–Kendall Z = ${stats.mkZScore} (naive p = ${stats.mkPValue}) • ` +
    `Hamed–Rao p* = ${pText(stats.hamedRaoMkPValue)} (lag-1 r = ${stats.lag1Autocorrelation}, N_eff ≈ ${Math.round(stats.effectiveSampleSize)}) • ` +
    `Seasonal MK p = ${stats.seasonalMkPValue} • n = ${stats.sampleSize} months`;

  return { direction, confidence, headline, what, where, howMuch, isItReal, caution, technical, percentChange };
}
