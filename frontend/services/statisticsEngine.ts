import {
  TimeSeriesPoint,
  StatisticalAnalysisResult,
  SignificanceLevel,
  BaselinePeriod,
  ChangepointAnalysis,
  TimeSeriesDecomposition,
  DecompositionPoint,
  BivariateCorrelationResult,
  LeadLagPoint,
  BivariateScatterPoint,
  FdrHypothesisResult
} from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Normal Cumulative Distribution Function approximation (Abramowitz and Stegun)
 */
function normalCDF(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const isNegative = z < 0;
  const x = Math.abs(z);
  const p = 0.2316419;
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const t = 1.0 / (1.0 + p * x);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1.0 - pdf * poly;

  return isNegative ? 1.0 - cdf : cdf;
}


// ---------------------------------------------------------------------------
// Student-t machinery and autocorrelation-aware correlation significance
// ---------------------------------------------------------------------------

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(a, b, x)) / a
    : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value of a Student-t statistic with `df` degrees of freedom. */
export function studentTTwoSidedP(t: number, df: number): number {
  if (!isFinite(t)) return 0;
  if (df <= 0) return 1;
  return regularizedIncompleteBeta(df / 2, 0.5, df / (df + t * t));
}

function lag1Autocorrelation(v: number[]): number {
  const n = v.length;
  if (n < 3) return 0;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (v[i] - mean) ** 2;
    if (i > 0) num += (v[i] - mean) * (v[i - 1] - mean);
  }
  return den > 0 ? num / den : 0;
}

/**
 * Pearson correlation with an autocorrelation-corrected effective sample size
 * (Bretherton et al. 1999: N_eff = N (1 - r1x r1y) / (1 + r1x r1y)) and a Student-t p-value.
 * Using the raw N for monthly climate series overstates significance.
 */
export function correlationWithEffectiveN(
  x: number[],
  y: number[]
): { r: number; n: number; nEff: number; pValue: number } {
  const n = Math.min(x.length, y.length);
  if (n < 4) return { r: 0, n, nEff: n, pValue: 1 };
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const rr = Math.max(0, lag1Autocorrelation(xs) * lag1Autocorrelation(ys));
  const nEff = Math.max(4, Math.min(n, (n * (1 - rr)) / (1 + rr)));
  const t = Math.abs(r) * Math.sqrt((nEff - 2) / Math.max(1e-12, 1 - r * r));
  return { r, n, nEff, pValue: Math.max(1e-6, studentTTwoSidedP(t, nEff - 2)) };
}

/**
 * Computes tie-adjustment term sum_g t_g * (t_g - 1) * (2 * t_g + 5) for Mann-Kendall Var(S)
 */
function computeTieVarianceAdjustment(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  let tieTerm = 0;
  let run = 1;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && Math.abs(sorted[i] - sorted[i - 1]) < 1e-9) {
      run++;
    } else {
      if (run > 1) {
        tieTerm += run * (run - 1) * (2 * run + 5);
      }
      run = 1;
    }
  }
  return tieTerm;
}

/**
 * Performs Non-Parametric Mann-Kendall Trend Test (with exact tie correction)
 */
export function calculateMannKendall(values: number[]): { s: number; z: number; pValue: number; varS: number } {
  const n = values.length;
  if (n < 4) {
    return { s: 0, z: 0, pValue: 1, varS: 1 };
  }

  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = values[j] - values[i];
      if (diff > 1e-9) s += 1;
      else if (diff < -1e-9) s -= 1;
    }
  }

  const tieCorrection = computeTieVarianceAdjustment(values);
  const varS = Math.max(1e-6, (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18);

  let z = 0;
  if (s > 0) {
    z = (s - 1) / Math.sqrt(varS);
  } else if (s < 0) {
    z = (s + 1) / Math.sqrt(varS);
  }

  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { s, z, pValue: Math.max(0.0001, Math.min(1, pValue)), varS };
}

/**
 * Calculates Sen's Slope (median of all pairwise slopes) and Gilbert (1987) 95% confidence bounds
 */
export function calculateSensSlope(values: number[]): number {
  return calculateSensSlopeWithCI(values).slope;
}

export function calculateSensSlopeWithCI(
  values: number[],
  varS?: number
): { slope: number; ciLower: number; ciUpper: number } {
  const n = values.length;
  const slopes: number[] = [];
  const step = n > 360 ? 2 : 1;
  for (let i = 0; i < n - 1; i += step) {
    for (let j = i + 1; j < n; j += step) {
      slopes.push((values[j] - values[i]) / (j - i));
    }
  }
  if (slopes.length === 0) return { slope: 0, ciLower: 0, ciUpper: 0 };
  slopes.sort((a, b) => a - b);
  const N = slopes.length;
  const mid = Math.floor(N / 2);
  const slope = N % 2 !== 0 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;

  const effectiveVarS = varS ?? Math.max(1, (n * (n - 1) * (2 * n + 5)) / 18);
  const cAlpha = 1.96 * Math.sqrt(effectiveVarS);
  const scaleFactor = N / Math.max(1, (n * (n - 1)) / 2);
  const m1 = Math.max(0, Math.floor((N - cAlpha * scaleFactor) / 2));
  const m2 = Math.min(N - 1, Math.ceil((N + cAlpha * scaleFactor) / 2));

  return {
    slope,
    ciLower: slopes[m1],
    ciUpper: slopes[m2]
  };
}

/**
 * Hamed & Rao (1998) Modified Mann-Kendall Test for Serially Correlated Data.
 * Removes Sen's linear trend, ranks residuals, computes significant autocorrelation lags,
 * and inflates Var*(S) to eliminate red-noise Type I false positives.
 */
export function calculateHamedRaoMannKendall(values: number[]): {
  s: number;
  naiveZ: number;
  naivePValue: number;
  adjustedZ: number;
  adjustedPValue: number;
  varianceInflationFactor: number;
} {
  const n = values.length;
  const baseMk = calculateMannKendall(values);
  if (n < 12) {
    return {
      s: baseMk.s,
      naiveZ: baseMk.z,
      naivePValue: baseMk.pValue,
      adjustedZ: baseMk.z,
      adjustedPValue: baseMk.pValue,
      varianceInflationFactor: 1
    };
  }

  const sen = calculateSensSlope(values);
  const detrended = values.map((v, i) => v - sen * i);

  // Rank detrended series
  const indexed = detrended.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  for (let r = 0; r < n; r++) ranks[indexed[r].i] = r + 1;

  const meanRank = (n + 1) / 2;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += Math.pow(ranks[i] - meanRank, 2);

  const maxLag = Math.min(24, Math.floor(n / 4));
  const sigBound = 1.96 / Math.sqrt(n);
  let corrSum = 0;

  if (denom > 0) {
    for (let k = 1; k <= maxLag; k++) {
      let num = 0;
      for (let i = 0; i < n - k; i++) {
        num += (ranks[i] - meanRank) * (ranks[i + k] - meanRank);
      }
      const rhoK = num / denom;
      if (Math.abs(rhoK) > sigBound) {
        corrSum += (n - k) * (n - k - 1) * (n - k - 2) * rhoK;
      }
    }
  }

  const nRatio = Math.max(0.35, 1 + (2 / (n * (n - 1) * (n - 2))) * corrSum);
  const varStar = baseMk.varS * nRatio;

  let zStar = 0;
  if (baseMk.s > 0) zStar = (baseMk.s - 1) / Math.sqrt(varStar);
  else if (baseMk.s < 0) zStar = (baseMk.s + 1) / Math.sqrt(varStar);

  const pStar = Math.max(0.0001, Math.min(1, 2 * (1 - normalCDF(Math.abs(zStar)))));

  return {
    s: baseMk.s,
    naiveZ: baseMk.z,
    naivePValue: baseMk.pValue,
    adjustedZ: zStar,
    adjustedPValue: pStar,
    varianceInflationFactor: nRatio
  };
}

/**
 * Hirsch, Slack & Smith (1982) Seasonal Mann-Kendall Test + Seasonal Sen's Slope.
 * Compares strictly like-for-like calendar months (Jan vs Jan, Jul vs Jul), neutralizing seasonality.
 */
export function calculateSeasonalMannKendall(
  dates: string[],
  rawValues: number[]
): { s: number; z: number; pValue: number; seasonalSensSlopePerDecade: number } {
  const buckets: { year: number; val: number }[][] = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < rawValues.length; i++) {
    const parts = dates[i].split('-');
    const yr = Number(parts[0]);
    const mo = Number(parts[1]) - 1;
    if (mo >= 0 && mo < 12 && Number.isFinite(rawValues[i])) {
      buckets[mo].push({ year: yr, val: rawValues[i] });
    }
  }

  let totalS = 0;
  let totalVarS = 0;
  const annualSlopes: number[] = [];

  for (let m = 0; m < 12; m++) {
    const arr = buckets[m];
    if (arr.length < 3) continue;
    arr.sort((a, b) => a.year - b.year);
    const vals = arr.map(x => x.val);
    const mkM = calculateMannKendall(vals);
    totalS += mkM.s;
    totalVarS += mkM.varS;

    for (let i = 0; i < arr.length - 1; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const dy = arr[j].year - arr[i].year;
        if (dy > 0) {
          annualSlopes.push((arr[j].val - arr[i].val) / dy);
        }
      }
    }
  }

  if (totalVarS <= 0) {
    return { s: 0, z: 0, pValue: 1, seasonalSensSlopePerDecade: 0 };
  }

  let z = 0;
  if (totalS > 0) z = (totalS - 1) / Math.sqrt(totalVarS);
  else if (totalS < 0) z = (totalS + 1) / Math.sqrt(totalVarS);
  const pValue = Math.max(0.0001, Math.min(1, 2 * (1 - normalCDF(Math.abs(z)))));

  annualSlopes.sort((a, b) => a - b);
  const mid = Math.floor(annualSlopes.length / 2);
  const medianAnnualSlope =
    annualSlopes.length === 0
      ? 0
      : annualSlopes.length % 2 !== 0
      ? annualSlopes[mid]
      : (annualSlopes[mid - 1] + annualSlopes[mid]) / 2;

  return {
    s: totalS,
    z,
    pValue,
    seasonalSensSlopePerDecade: medianAnnualSlope * 10
  };
}

/**
 * Augmented Dickey-Fuller (ADF) Unit-Root Test with Constant + Linear Trend (Lag p = 1):
 *   Δy_t = α + β*t + γ*y_{t-1} + δ*Δy_{t-1} + ε_t
 * Tests H0: γ = 0 (non-stationary random walk / stochastic unit root) vs H1: γ < 0 (deterministic trend-stationary).
 * MacKinnon asymptotic 5% critical value (with constant & trend) = -3.41.
 */
export function calculateAugmentedDickeyFuller(values: number[]): {
  adfStat: number;
  criticalValue5Pct: number;
  isTrendStationary: boolean;
  verdict: string;
} {
  const critical5 = -3.41;
  const n = values.length;
  if (n < 20) {
    return {
      adfStat: 0,
      criticalValue5Pct: critical5,
      isTrendStationary: false,
      verdict: 'Sample too short (<20) for reliable ADF unit-root separation.'
    };
  }

  // Build design matrix X [m x 4] and target Y [m] for t = 2 .. n-1
  const m = n - 2;
  const k = 4;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const XtY: number[] = new Array(k).fill(0);
  const rows: number[][] = [];
  const targets: number[] = [];

  for (let t = 2; t < n; t++) {
    const dy = values[t] - values[t - 1];
    const yLag = values[t - 1];
    const dyLag = values[t - 1] - values[t - 2];
    const xRow = [1, t, yLag, dyLag];
    rows.push(xRow);
    targets.push(dy);
    for (let r = 0; r < k; r++) {
      XtY[r] += xRow[r] * dy;
      for (let c = 0; c < k; c++) {
        XtX[r][c] += xRow[r] * xRow[c];
      }
    }
  }

  // Invert 4x4 XtX via Gauss-Jordan with partial pivoting
  const aug: number[][] = XtX.map((row, i) => [
    ...row,
    ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))
  ]);

  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col + 1; r < k; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) {
      return {
        adfStat: 0,
        criticalValue5Pct: critical5,
        isTrendStationary: false,
        verdict: 'Collinear series; unit-root matrix singular.'
      };
    }
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col];
    for (let j = 0; j < 2 * k; j++) aug[col][j] /= div;
    for (let r = 0; r < k; r++) {
      if (r !== col) {
        const factor = aug[r][col];
        for (let j = 0; j < 2 * k; j++) aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  const invXtX = aug.map(row => row.slice(k));
  const beta = new Array(k).fill(0);
  for (let r = 0; r < k; r++) {
    for (let c = 0; c < k; c++) {
      beta[r] += invXtX[r][c] * XtY[c];
    }
  }

  let sse = 0;
  for (let i = 0; i < m; i++) {
    let pred = 0;
    for (let c = 0; c < k; c++) pred += rows[i][c] * beta[c];
    sse += Math.pow(targets[i] - pred, 2);
  }

  const sigma2 = sse / Math.max(1, m - k);
  const seGamma = Math.sqrt(Math.max(1e-12, sigma2 * invXtX[2][2]));
  const adfStat = beta[2] / seGamma;
  const isStationary = adfStat < critical5;

  return {
    adfStat: Number(adfStat.toFixed(2)),
    criticalValue5Pct: critical5,
    isTrendStationary: isStationary,
    verdict: isStationary
      ? `Deterministic Trend-Stationary (ADF τ = ${adfStat.toFixed(2)} < -3.41): Rejects random-walk unit root at 95% confidence.`
      : `Stochastic / Unit-Root Persistence (ADF τ = ${adfStat.toFixed(2)} ≥ -3.41): Exhibits strong multi-year memory or non-stationary drift.`
  };
}

/**
 * Benjamini & Hochberg (1995) False Discovery Rate (FDR) Multiple-Hypothesis Correction.
 * Controls expected proportion of false positives when scanning multiple regions/variables simultaneously.
 */
export function applyBenjaminiHochbergFDR(
  items: Omit<FdrHypothesisResult, 'bhAdjustedQValue' | 'survivesFdr05' | 'falsePositiveCaught'>[],
  alpha = 0.05
): FdrHypothesisResult[] {
  const m = items.length;
  if (m === 0) return [];

  const indexed = items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => a.item.hamedRaoPValue - b.item.hamedRaoPValue);

  const qValues = new Array<number>(m);
  let runningMin = 1;
  for (let rankIdx = m - 1; rankIdx >= 0; rankIdx--) {
    const rank = rankIdx + 1;
    const rawQ = (indexed[rankIdx].item.hamedRaoPValue * m) / rank;
    runningMin = Math.min(runningMin, rawQ);
    qValues[rankIdx] = Math.min(1, Number(runningMin.toFixed(4)));
  }

  const results = new Array<FdrHypothesisResult>(m);
  for (let r = 0; r < m; r++) {
    const orig = indexed[r].item;
    const q = qValues[r];
    const survives = q < alpha;
    results[indexed[r].idx] = {
      ...orig,
      bhAdjustedQValue: q,
      survivesFdr05: survives,
      falsePositiveCaught: orig.naiveMkPValue < alpha && !survives
    };
  }
  return results;
}

/**
 * Performs Pettitt's Non-Parametric Test for Abrupt Changepoints / Regime Shifts
 * Widely used in climate science to find structural breaks in time series.
 */
export function detectPettittChangepoint(
  dates: string[],
  values: number[]
): ChangepointAnalysis {
  const n = values.length;
  if (n < 12) {
    return {
      hasChangepoint: false,
      date: dates[0] || 'N/A',
      year: 2000,
      month: 1,
      index: 0,
      kStatistic: 0,
      pValue: 1,
      significance: 'NO_SHIFT',
      preMean: 0,
      postMean: 0,
      preSlopePerDecade: 0,
      postSlopePerDecade: 0,
      deltaMean: 0,
      interpretation: 'Insufficient data points to test structural break.'
    };
  }

  // Mid-ranks (ties share the average rank) so repeated values do not bias the statistic
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  const ranks = new Array<number>(n);
  for (let r = 0; r < n; ) {
    let e = r;
    while (e + 1 < n && Math.abs(indexed[e + 1].val - indexed[r].val) < 1e-12) e++;
    const mid = (r + e) / 2 + 1;
    for (let k = r; k <= e; k++) ranks[indexed[k].idx] = mid;
    r = e + 1;
  }

  // Pettitt's statistic U_t = 2 * sum_{i=1}^t R_i - t * (n + 1)
  let sumR = 0;
  let maxAbsU = -1;
  let changepointIdx = Math.floor(n / 2);

  // Avoid trivial edges
  const minMargin = Math.max(12, Math.floor(n * 0.08));
  for (let t = 1; t <= n; t++) {
    sumR += ranks[t - 1];
    if (t >= minMargin && t <= n - minMargin) {
      const u = 2 * sumR - t * (n + 1);
      const absU = Math.abs(u);
      if (absU > maxAbsU) {
        maxAbsU = absU;
        changepointIdx = t - 1;
      }
    }
  }

  // Classic approximation (Pettitt 1979): p ~= 2 exp(-6 K^2 / (n^3 + n^2)); it assumes independent values.
  // Monthly anomalies remember last month, which makes that test report "significant" almost everywhere.
  // We therefore inflate the variance of K by n / N_eff (N_eff from lag-1 autocorrelation, as in the
  // Hamed-Rao correction for Mann-Kendall). This is deliberately conservative.
  const r1 = Math.max(0, Math.min(0.95, lag1Autocorrelation(values)));
  const nEff = Math.max(3, Math.min(n, (n * (1 - r1)) / (1 + r1)));
  const exponentNaive = (-6 * Math.pow(maxAbsU, 2)) / (Math.pow(n, 3) + Math.pow(n, 2));
  const naivePValue = Math.min(1, Math.max(0.0001, 2 * Math.exp(exponentNaive)));
  const pValue = Math.min(1, Math.max(0.0001, 2 * Math.exp(exponentNaive * (nEff / n))));

  const preSlice = values.slice(0, changepointIdx + 1);
  const postSlice = values.slice(changepointIdx + 1);

  const preMean = preSlice.reduce((a, b) => a + b, 0) / (preSlice.length || 1);
  const postMean = postSlice.reduce((a, b) => a + b, 0) / (postSlice.length || 1);
  const deltaMean = postMean - preMean;

  // Pre & Post slopes
  const preSlope = preSlice.length > 2 ? calculateSensSlope(preSlice) * 120 : 0;
  const postSlope = postSlice.length > 2 ? calculateSensSlope(postSlice) * 120 : 0;

  const cpDate = dates[changepointIdx];
  const [cpY, cpM] = cpDate.split('-').map(Number);

  let significance: 'SIGNIFICANT_SHIFT' | 'POSSIBLE_SHIFT' | 'NO_SHIFT' = 'NO_SHIFT';
  let interpretation = 'No statistically significant structural break identified; series conforms to smooth trajectory.';

  if (pValue < 0.05) {
    significance = 'SIGNIFICANT_SHIFT';
    interpretation = `Significant regime shift detected in ${MONTH_NAMES[cpM - 1]} ${cpY} (Pettitt, autocorrelation-corrected p = ${pValue.toFixed(4)}). Baseline shifted by ${deltaMean > 0 ? '+' : ''}${deltaMean.toFixed(2)}.`;
  } else if (pValue < 0.15) {
    significance = 'POSSIBLE_SHIFT';
    interpretation = `Emerging break candidate observed around ${MONTH_NAMES[cpM - 1]} ${cpY} (p = ${pValue.toFixed(4)}). Requires continued observation.`;
  }

  return {
    hasChangepoint: pValue < 0.10,
    date: cpDate,
    year: cpY,
    month: cpM,
    index: changepointIdx,
    kStatistic: maxAbsU,
    pValue: Number(pValue.toFixed(4)),
    naivePValue: Number(naivePValue.toFixed(4)),
    effectiveN: Number(nEff.toFixed(1)),
    significance,
    preMean: Number(preMean.toFixed(2)),
    postMean: Number(postMean.toFixed(2)),
    preSlopePerDecade: Number(preSlope.toFixed(3)),
    postSlopePerDecade: Number(postSlope.toFixed(3)),
    deltaMean: Number(deltaMean.toFixed(2)),
    interpretation
  };
}

/**
 * Processes monthly time series with selectable reference climatological baselines:
 * - 1961-1990 (Classic WMO climate benchmark)
 * - 1981-2010 (Late 20th Century standard)
 * - 1991-2020 (Modern WMO standard)
 * - 2001-2020 (Satellite Era modern baseline)
 * - Full Period
 */
export function processMonthlyTimeSeries(
  dates: string[],
  rawValues: number[],
  unit: string,
  baselinePeriod: BaselinePeriod = '1991-2020'
): { points: TimeSeriesPoint[]; stats: StatisticalAnalysisResult } {
  const n = rawValues.length;
  if (n === 0) {
    throw new Error('No data provided');
  }

  const parsedYears = dates.map(d => Number(d.split('-')[0]));
  const parsedMonths = dates.map(d => Number(d.split('-')[1]) - 1);

  // Determine which indices fall into the chosen baseline period
  const baselineIndices: number[] = [];
  let baseStart = 1991;
  let baseEnd = 2020;

  if (baselinePeriod === '1961-1990') {
    baseStart = 1961;
    baseEnd = 1990;
  } else if (baselinePeriod === '1981-2010') {
    baseStart = 1981;
    baseEnd = 2010;
  } else if (baselinePeriod === '1991-2020') {
    baseStart = 1991;
    baseEnd = 2020;
  } else if (baselinePeriod === '2001-2020') {
    baseStart = 2001;
    baseEnd = 2020;
  } else {
    // Full period
    baseStart = -9999;
    baseEnd = 9999;
  }

  for (let i = 0; i < n; i++) {
    const y = parsedYears[i];
    if (y >= baseStart && y <= baseEnd) {
      baselineIndices.push(i);
    }
  }

  // Fallback if data range does not fully overlap baseline (e.g. 2000-2024 with 1961-1990)
  const useIndices = baselineIndices.length >= 24 ? baselineIndices : Array.from({ length: n }, (_, i) => i);

  // Group by month to calculate mean and standard deviation for Z-scores
  const monthSums = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);
  const monthVals: number[][] = Array.from({ length: 12 }, () => []);

  for (const idx of useIndices) {
    const m = parsedMonths[idx];
    monthSums[m] += rawValues[idx];
    monthCounts[m] += 1;
    monthVals[m].push(rawValues[idx]);
  }

  const climatologyMean = monthSums.map((sum, m) => (monthCounts[m] > 0 ? sum / monthCounts[m] : 0));
  const climatologyStd = monthVals.map((arr, m) => {
    if (arr.length <= 1) return 1;
    const mean = climatologyMean[m];
    const variance = arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (arr.length - 1);
    return Math.max(0.001, Math.sqrt(variance));
  });

  // Calculate Anomalies & Z-scores
  const anomalies: number[] = [];
  const zScores: number[] = [];

  for (let i = 0; i < n; i++) {
    const m = parsedMonths[i];
    const anom = rawValues[i] - climatologyMean[m];
    const z = anom / climatologyStd[m];
    anomalies.push(anom);
    zScores.push(z);
  }

  // Linear Regression on Anomalies
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += anomalies[i];
    sumXY += i * anomalies[i];
    sumX2 += i * i;
    sumY2 += anomalies[i] * anomalies[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const numerator = n * sumXY - sumX * sumY;
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const pearsonR = denom !== 0 ? numerator / denom : 0;
  const rSquared = Math.max(0, Math.min(1, pearsonR * pearsonR));

  let sse = 0;
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    const res = anomalies[i] - pred;
    residuals.push(res);
    sse += res * res;
  }
  const df = Math.max(1, n - 2);
  const standardError = Math.sqrt(sse / df);
  const seSlope = standardError / Math.sqrt(Math.max(1e-9, sumX2 - (sumX * sumX) / n));
  const tStat = seSlope > 0 ? slope / seSlope : 0;
  const pValueT = Math.max(0.0001, Math.min(1, 2 * (1 - normalCDF(Math.abs(tStat)))));

  // Lag-1 Autocorrelation on detrended residuals & Santer et al. (2000) Effective Sample Size N_eff
  let r1Num = 0;
  let r1Den = 0;
  for (let i = 0; i < n; i++) {
    r1Den += residuals[i] * residuals[i];
    if (i >= 1) r1Num += residuals[i] * residuals[i - 1];
  }
  const rawR1 = r1Den > 0 ? r1Num / r1Den : 0;
  const lag1Autocorrelation = Math.max(-0.95, Math.min(0.95, rawR1));
  const posR1 = Math.max(0, lag1Autocorrelation);
  const effectiveSampleSize = Math.max(3, Math.min(n, n * ((1 - posR1) / (1 + posR1))));
  const dofInflation = Math.sqrt(df / Math.max(1, effectiveSampleSize - 2));
  const adjustedSeSlope = seSlope * dofInflation;
  const adjustedTStat = adjustedSeSlope > 0 ? slope / adjustedSeSlope : 0;
  const adjustedPValueTTest = Math.max(0.0001, Math.min(1, 2 * (1 - normalCDF(Math.abs(adjustedTStat)))));

  // Tie-corrected MK, Hamed & Rao (1998) Serial-Correlation MK, Seasonal MK, and ADF Stationarity
  const mk = calculateMannKendall(anomalies);
  const hrMk = calculateHamedRaoMannKendall(anomalies);
  const senWithCi = calculateSensSlopeWithCI(anomalies, hrMk.varianceInflationFactor * mk.varS);
  const seasonalMk = calculateSeasonalMannKendall(dates, rawValues);
  const adf = calculateAugmentedDickeyFuller(anomalies);

  const slopePerYear = slope * 12;
  const slopePerDecade = slopePerYear * 10;
  const totalChange = slope * n;

  const sensSlopePerYear = senWithCi.slope * 12;
  const sensSlopePerDecade = sensSlopePerYear * 10;
  const sensCiLowerPerDecade = senWithCi.ciLower * 120;
  const sensCiUpperPerDecade = senWithCi.ciUpper * 120;

  // Weatherhead et al. (1998, JGR) NASA Satellite Time of Emergence (years for 90% power at alpha=0.05)
  const monthlyNoiseSigma = standardError;
  const annualizedSigma = monthlyNoiseSigma / Math.sqrt(12);
  const absAnnualSlope = Math.max(1e-6, Math.abs(sensSlopePerYear || slopePerYear));
  const autocorrPenalty = Math.sqrt((1 + posR1) / Math.max(0.05, 1 - posR1));
  const rawToe = Math.pow((3.3 * annualizedSigma * autocorrPenalty) / absAnnualSlope, 2 / 3);
  const timeOfEmergenceYears = Number(Math.max(2, Math.min(150, rawToe)).toFixed(1));

  // Achieved Statistical Power (1 - beta) at two-sided alpha = 0.05 using Hamed-Rao Z*
  const powerVal = normalCDF(Math.abs(hrMk.adjustedZ) - 1.96) + normalCDF(-Math.abs(hrMk.adjustedZ) - 1.96);
  const statisticalPowerPercent = Number(Math.min(99.9, Math.max(5.0, powerVal * 100)).toFixed(1));

  const isAutocorrelationDeflated = mk.pValue < 0.05 && hrMk.adjustedPValue >= 0.05;
  const authoritativeP = hrMk.adjustedPValue;

  let significanceCategory: SignificanceLevel = 'NOT_SIGNIFICANT';
  let verdictText = 'No statistically detectable trend; observed variations remain within natural climate variability.';

  if (authoritativeP < 0.01 && adjustedPValueTTest < 0.01) {
    significanceCategory = 'HIGHLY_SIGNIFICANT';
    verdictText = `Robust, autocorrelation-verified trend (Hamed-Rao p* < 0.01, Seasonal MK p = ${seasonalMk.pValue.toFixed(4)}). Over 99% scientific confidence beyond red-noise persistence.`;
  } else if (authoritativeP < 0.05) {
    significanceCategory = 'SIGNIFICANT';
    verdictText = `Statistically significant trend surviving Hamed-Rao serial correlation correction (p* = ${authoritativeP.toFixed(4)} < 0.05; N_eff = ${effectiveSampleSize.toFixed(0)}).`;
  } else if (isAutocorrelationDeflated) {
    significanceCategory = 'EMERGING';
    verdictText = `Red-Noise Caution: Naive MK appeared significant (p = ${mk.pValue.toFixed(4)}), but lag-1 memory (r₁ = ${lag1Autocorrelation.toFixed(2)}) inflates variance to Hamed-Rao p* = ${authoritativeP.toFixed(4)}. Estimated Time of Emergence: ~${timeOfEmergenceYears} yrs.`;
  } else if (authoritativeP < 0.15 || seasonalMk.pValue < 0.05) {
    significanceCategory = 'EMERGING';
    verdictText = `Emerging trajectory (Hamed-Rao p* = ${authoritativeP.toFixed(4)}, Power = ${statisticalPowerPercent}%). Requires ~${timeOfEmergenceYears} yrs total record to exceed 90% detection power.`;
  }

  const direction: 'INCREASING' | 'DECREASING' | 'STABLE' =
    Math.abs(slopePerDecade) < 0.0001
      ? 'STABLE'
      : slopePerDecade > 0
      ? 'INCREASING'
      : 'DECREASING';

  // Construct points with autocorrelation-adjusted 95% confidence band
  const meanX = sumX / n;
  const points: TimeSeriesPoint[] = [];

  for (let i = 0; i < n; i++) {
    const [yStr, mStr] = dates[i].split('-');
    const predTrend = intercept + slope * i;
    const leverage = 1 / n + Math.pow(i - meanX, 2) / Math.max(1e-9, sumX2 - (sumX * sumX) / n);
    const ciDelta = 1.96 * standardError * dofInflation * Math.sqrt(leverage);

    points.push({
      date: dates[i],
      year: Number(yStr),
      month: Number(mStr),
      raw: Number(rawValues[i].toFixed(3)),
      climatology: Number(climatologyMean[parsedMonths[i]].toFixed(3)),
      anomaly: Number(anomalies[i].toFixed(3)),
      zScore: Number(zScores[i].toFixed(2)),
      trend: Number(predTrend.toFixed(3)),
      ciUpper: Number((predTrend + ciDelta).toFixed(3)),
      ciLower: Number((predTrend - ciDelta).toFixed(3)),
      isExtremeWarmOrHigh: zScores[i] >= 2.0,
      isExtremeColdOrDry: zScores[i] <= -2.0
    });
  }

  // Pettitt Changepoint detection
  const changepoint = detectPettittChangepoint(dates, anomalies);

  const stats: StatisticalAnalysisResult = {
    sampleSize: n,
    timeRangeYears: Number((n / 12).toFixed(1)),
    startDate: dates[0],
    endDate: dates[n - 1],
    baselineUsed: baselinePeriod,
    slopePerYear: Number(slopePerYear.toFixed(4)),
    slopePerDecade: Number(slopePerDecade.toFixed(4)),
    totalChange: Number(totalChange.toFixed(3)),
    unit,
    rSquared: Number(rSquared.toFixed(4)),
    pearsonR: Number(pearsonR.toFixed(3)),
    tStatistic: Number(tStat.toFixed(3)),
    pValueTTest: Number(pValueT.toFixed(4)),
    mkSScore: mk.s,
    mkZScore: Number(mk.z.toFixed(2)),
    mkPValue: Number(mk.pValue.toFixed(4)),
    sensSlope: Number(sensSlopePerYear.toFixed(4)),
    sensSlopePerDecade: Number(sensSlopePerDecade.toFixed(4)),
    sensCiLowerPerDecade: Number(sensCiLowerPerDecade.toFixed(4)),
    sensCiUpperPerDecade: Number(sensCiUpperPerDecade.toFixed(4)),
    lag1Autocorrelation: Number(lag1Autocorrelation.toFixed(3)),
    effectiveSampleSize: Number(effectiveSampleSize.toFixed(1)),
    hamedRaoMkZ: Number(hrMk.adjustedZ.toFixed(2)),
    hamedRaoMkPValue: Number(hrMk.adjustedPValue.toFixed(4)),
    adjustedTStat: Number(adjustedTStat.toFixed(2)),
    adjustedPValueTTest: Number(adjustedPValueTTest.toFixed(4)),
    seasonalMkS: seasonalMk.s,
    seasonalMkZ: Number(seasonalMk.z.toFixed(2)),
    seasonalMkPValue: Number(seasonalMk.pValue.toFixed(4)),
    seasonalSensSlopePerDecade: Number(seasonalMk.seasonalSensSlopePerDecade.toFixed(4)),
    adfStatistic: adf.adfStat,
    adfCriticalValue5Pct: adf.criticalValue5Pct,
    isTrendStationary: adf.isTrendStationary,
    stationarityVerdict: adf.verdict,
    statisticalPowerPercent,
    timeOfEmergenceYears,
    isAutocorrelationDeflated,
    direction,
    significanceCategory,
    verdictText,
    changepoint
  };

  return { points, stats };
}

/**
 * Time Series Decomposition (Classical Additive STL-style)
 * Decomposes Raw into: Raw = Trend + Seasonal + Residual
 */
export function decomposeTimeSeries(
  dates: string[],
  rawValues: number[]
): TimeSeriesDecomposition {
  const n = rawValues.length;
  // 12-month centered moving average for Trend
  const trend: number[] = new Array(n).fill(0);
  const halfWindow = 6;

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(n, i + halfWindow + 1);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += rawValues[j];
    }
    trend[i] = sum / (end - start);
  }

  // Detrended series: Raw - Trend
  const detrended = rawValues.map((v, i) => v - trend[i]);

  // Seasonal component: average detrended by month
  const monthSums = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  dates.forEach((d, i) => {
    const m = Number(d.split('-')[1]) - 1;
    monthSums[m] += detrended[i];
    monthCounts[m] += 1;
  });

  const seasonalCycle = monthSums.map((sum, m) => (monthCounts[m] > 0 ? sum / monthCounts[m] : 0));

  // Center seasonal cycle to zero
  const seasonalMean = seasonalCycle.reduce((a, b) => a + b, 0) / 12;
  const centeredSeasonal = seasonalCycle.map(v => v - seasonalMean);

  // Compute decomposition points
  const points: DecompositionPoint[] = [];
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    const m = Number(dates[i].split('-')[1]) - 1;
    const s = centeredSeasonal[m];
    const t = trend[i];
    const res = rawValues[i] - t - s;
    residuals.push(res);

    points.push({
      date: dates[i],
      raw: Number(rawValues[i].toFixed(2)),
      trend: Number(t.toFixed(2)),
      seasonal: Number(s.toFixed(2)),
      residual: Number(res.toFixed(2))
    });
  }

  // Seasonality metrics
  let maxSeasonal = -Infinity;
  let minSeasonal = Infinity;
  let peakMonth = 0;
  let troughMonth = 0;

  centeredSeasonal.forEach((val, m) => {
    if (val > maxSeasonal) {
      maxSeasonal = val;
      peakMonth = m;
    }
    if (val < minSeasonal) {
      minSeasonal = val;
      troughMonth = m;
    }
  });

  const annualAmplitude = maxSeasonal - minSeasonal;

  // Variance breakdown
  const variance = (arr: number[]) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
  };

  const rawVar = variance(rawValues) || 1;
  const trendVar = variance(trend);
  const seasonalVar = variance(points.map(p => p.seasonal));
  const residualVar = variance(residuals);

  const totalVar = trendVar + seasonalVar + residualVar || 1;

  return {
    points,
    peakMonthName: MONTH_NAMES[peakMonth],
    peakMonthNumber: peakMonth + 1,
    troughMonthName: MONTH_NAMES[troughMonth],
    troughMonthNumber: troughMonth + 1,
    annualAmplitude: Number(annualAmplitude.toFixed(2)),
    seasonalVariancePercent: Number(((seasonalVar / totalVar) * 100).toFixed(1)),
    trendVariancePercent: Number(((trendVar / totalVar) * 100).toFixed(1)),
    residualVariancePercent: Number(((residualVar / totalVar) * 100).toFixed(1))
  };
}

/**
 * Calculates Bivariate Correlation, Scatter, and Lead-Lag Relationship (-12 to +12 months)
 */
export function calculateBivariateLeadLag(
  dates: string[],
  xAnomalies: number[],
  yAnomalies: number[],
  xName: string,
  yName: string
): BivariateCorrelationResult {
  const n = Math.min(xAnomalies.length, yAnomalies.length);

  // Pearson Correlation at lag 0
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  const scatterData: BivariateScatterPoint[] = [];

  for (let i = 0; i < n; i++) {
    const x = xAnomalies[i];
    const y = yAnomalies[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;

    scatterData.push({
      date: dates[i],
      xValue: Number(x.toFixed(2)),
      yValue: Number(y.toFixed(2)),
      xAnomaly: Number(x.toFixed(2)),
      yAnomaly: Number(y.toFixed(2))
    });
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const pearsonR = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const pearsonPValue = correlationWithEffectiveN(xAnomalies, yAnomalies).pValue;

  // Spearman Rank Correlation
  const rank = (arr: number[]) => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const r = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) r[indexed[i].i] = i + 1;
    return r;
  };

  const rx = rank(xAnomalies.slice(0, n));
  const ry = rank(yAnomalies.slice(0, n));
  let d2 = 0;
  for (let i = 0; i < n; i++) {
    d2 += Math.pow(rx[i] - ry[i], 2);
  }
  const spearmanRho = 1 - (6 * d2) / (n * (n * n - 1));
  const spearmanPValue = correlationWithEffectiveN(rx, ry).pValue;

  // Lead-Lag cross-correlation curve from lag -12 to +12 months
  // Negative lag: X leads Y (X occurs earlier than Y)
  // Positive lag: Y leads X
  const leadLagSeries: LeadLagPoint[] = [];
  let bestLag = 0;
  let maxAbsCorr = -1;
  let bestCorr = 0;

  for (let lag = -12; lag <= 12; lag++) {
    let sX = 0;
    let sY = 0;
    let sXY = 0;
    let sX2 = 0;
    let sY2 = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j >= 0 && j < n) {
        const xVal = xAnomalies[i];
        const yVal = yAnomalies[j];
        sX += xVal;
        sY += yVal;
        sXY += xVal * yVal;
        sX2 += xVal * xVal;
        sY2 += yVal * yVal;
        count++;
      }
    }

    const d = Math.sqrt((count * sX2 - sX * sX) * (count * sY2 - sY * sY));
    const corr = d !== 0 ? (count * sXY - sX * sY) / d : 0;

    leadLagSeries.push({
      lagMonths: lag,
      correlation: Number(corr.toFixed(3))
    });

    if (Math.abs(corr) > maxAbsCorr) {
      maxAbsCorr = Math.abs(corr);
      bestLag = lag;
      bestCorr = corr;
    }
  }

  // Construct plain-English scientific narrative
  let narrative = '';
  if (Math.abs(pearsonR) > 0.5) {
    narrative = `Strong ${pearsonR > 0 ? 'positive' : 'negative'} synchronous coupling (r = ${pearsonR.toFixed(2)}). `;
  } else if (Math.abs(pearsonR) > 0.25) {
    narrative = `Moderate ${pearsonR > 0 ? 'positive' : 'negative'} cross-correlation (r = ${pearsonR.toFixed(2)}). `;
  } else {
    narrative = `Weak contemporaneous correlation at lag 0 (r = ${pearsonR.toFixed(2)}). `;
  }

  if (bestLag < 0) {
    narrative += `${xName} leads ${yName} by ${Math.abs(bestLag)} month(s), peaking at r = ${bestCorr.toFixed(2)}. Physical interpretation: shifts in ${xName} trigger lagged systemic responses in ${yName}.`;
  } else if (bestLag > 0) {
    narrative += `${yName} leads ${xName} by ${bestLag} month(s), peaking at r = ${bestCorr.toFixed(2)}.`;
  } else {
    narrative += `Optimal interaction occurs synchronously (0 lag, r = ${bestCorr.toFixed(2)}).`;
  }

  return {
    pearsonR: Number(pearsonR.toFixed(3)),
    pearsonPValue: Number(pearsonPValue.toFixed(4)),
    spearmanRho: Number(spearmanRho.toFixed(3)),
    spearmanPValue: Number(spearmanPValue.toFixed(4)),
    rSquared: Number((pearsonR * pearsonR).toFixed(3)),
    optimalLagMonths: bestLag,
    optimalLagCorrelation: Number(bestCorr.toFixed(3)),
    leadLagSeries,
    scatterData,
    relationshipNarrative: narrative
  };
}
