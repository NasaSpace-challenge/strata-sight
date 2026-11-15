import { describe, expect, it } from 'vitest';
import {
  applyBenjaminiHochbergFDR,
  calculateHamedRaoMannKendall,
  calculateMannKendall,
  calculateSensSlope,
  correlationWithEffectiveN,
  detectPettittChangepoint,
  processMonthlyTimeSeries,
  studentTTwoSidedP
} from './statisticsEngine';

// ---- deterministic test-signal helpers (unit tests only; the app never simulates data) -----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}
function ar1(n: number, phi: number, seed: number) {
  const r = rng(seed);
  const out: number[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    x = phi * x + gauss(r);
    out.push(x);
  }
  return out;
}
function monthDates(startYear: number, n: number) {
  return Array.from({ length: n }, (_, i) => `${startYear + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
}

describe('Mann-Kendall', () => {
  it('matches the textbook result for a strictly increasing series of 5', () => {
    // S = 10, Var(S) = 5*4*15/18 = 16.667, z = (S-1)/sqrt(Var) = 2.2045, p = 0.0275
    const r = calculateMannKendall([1, 2, 3, 4, 5]);
    expect(r.s).toBe(10);
    expect(r.varS).toBeCloseTo(16.667, 2);
    expect(r.z).toBeCloseTo(2.2045, 3);
    expect(r.pValue).toBeCloseTo(0.0275, 3);
  });

  it('applies the tie correction to Var(S)', () => {
    const noTies = calculateMannKendall([1, 2, 3, 4, 5, 6]);
    const ties = calculateMannKendall([1, 1, 3, 3, 5, 5]);
    expect(ties.varS).toBeLessThan(noTies.varS);
  });

  it('finds no trend in a constant series', () => {
    const r = calculateMannKendall(new Array(30).fill(4));
    expect(r.s).toBe(0);
    expect(r.pValue).toBeCloseTo(1, 6);
  });
});

describe("Sen's slope", () => {
  it('recovers the exact slope of a line', () => {
    expect(calculateSensSlope(Array.from({ length: 40 }, (_, i) => 2 * i + 1))).toBeCloseTo(2, 10);
  });
  it('is robust to a wild outlier', () => {
    const v = Array.from({ length: 40 }, (_, i) => 0.5 * i);
    v[20] = 1e6;
    expect(calculateSensSlope(v)).toBeCloseTo(0.5, 6);
  });
});

describe('Hamed-Rao modified Mann-Kendall', () => {
  it('is less confident than naive MK on strongly autocorrelated data', () => {
    let widened = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = calculateHamedRaoMannKendall(ar1(240, 0.9, seed));
      if (r.adjustedPValue >= r.naivePValue) widened++;
    }
    expect(widened).toBeGreaterThanOrEqual(17);
  });

  it('still detects a real trend', () => {
    const noise = ar1(300, 0.3, 7);
    const r = calculateHamedRaoMannKendall(noise.map((e, i) => e + 0.02 * i));
    expect(r.adjustedPValue).toBeLessThan(0.01);
  });
});

describe('Pettitt change-point test', () => {
  it('locates a genuine step change', () => {
    const r = rng(3);
    const v = Array.from({ length: 240 }, (_, i) => (i < 100 ? 0 : 2) + 0.4 * gauss(r));
    const res = detectPettittChangepoint(monthDates(2000, 240), v);
    expect(Math.abs(res.index - 99)).toBeLessThanOrEqual(4);
    expect(res.pValue).toBeLessThan(0.01);
    expect(res.significance).toBe('SIGNIFICANT_SHIFT');
  });

  it('does not flag break points in white noise', () => {
    let flagged = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const res = detectPettittChangepoint(monthDates(2000, 240), ar1(240, 0, seed));
      if (res.pValue < 0.05) flagged++;
    }
    expect(flagged / 40).toBeLessThan(0.15);
  });

  it('is not fooled by month-to-month memory (regression: classic Pettitt flags ~everything)', () => {
    let corrected = 0;
    let naive = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const res = detectPettittChangepoint(monthDates(2000, 240), ar1(240, 0.85, seed));
      if (res.pValue < 0.05) corrected++;
      if ((res.naivePValue ?? 1) < 0.05) naive++;
    }
    expect(naive / 40).toBeGreaterThan(0.5); // the uncorrected test is badly overconfident...
    expect(corrected / 40).toBeLessThan(0.25); // ...the corrected one is much closer to its nominal level
    expect(corrected).toBeLessThan(naive);
  });
});

describe('Benjamini-Hochberg FDR', () => {
  it('produces the textbook q-values', () => {
    const mk = (p: number, i: number) => ({
      id: String(i),
      regionName: '',
      variableName: '',
      slopePerDecade: 0,
      unit: '',
      naiveMkPValue: p,
      hamedRaoPValue: p
    });
    const out = applyBenjaminiHochbergFDR([0.001, 0.01, 0.2, 0.9].map(mk), 0.05);
    expect(out.map(o => o.bhAdjustedQValue)).toEqual([0.004, 0.02, 0.2667, 0.9]);
    expect(out.map(o => o.survivesFdr05)).toEqual([true, true, false, false]);
  });
});

describe('Student-t and effective-N correlation', () => {
  it('reproduces t = 2.228, df = 10 -> p = 0.05', () => {
    expect(studentTTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
  });
  it('gives p = 1 for t = 0', () => {
    expect(studentTTwoSidedP(0, 20)).toBeCloseTo(1, 10);
  });
  it('shrinks the effective sample size for autocorrelated series', () => {
    const x = ar1(240, 0.9, 11);
    const y = ar1(240, 0.9, 12);
    const r = correlationWithEffectiveN(x, y);
    expect(r.nEff).toBeLessThan(r.n * 0.3);
  });
  it('detects a perfect relationship', () => {
    const x = Array.from({ length: 60 }, (_, i) => Math.sin(i / 5));
    const r = correlationWithEffectiveN(x, x.map(v => 3 * v + 1));
    expect(r.r).toBeCloseTo(1, 10);
    expect(r.pValue).toBeLessThan(0.001);
  });
});

describe('processMonthlyTimeSeries end to end', () => {
  it('recovers a known trend through a strong seasonal cycle', () => {
    const n = 12 * 40;
    const r = rng(5);
    const values = Array.from({ length: n }, (_, i) => 15 + 10 * Math.sin((2 * Math.PI * (i % 12)) / 12) + 0.0025 * i + 0.5 * gauss(r));
    // true trend: 0.0025 per month -> 0.3 per decade
    const { stats } = processMonthlyTimeSeries(monthDates(1985, n), values, '°C', 'FULL_PERIOD');
    expect(stats.sensSlopePerDecade).toBeGreaterThan(0.25);
    expect(stats.sensSlopePerDecade).toBeLessThan(0.35);
    expect(stats.hamedRaoMkPValue).toBeLessThan(0.01);
  });

  it('reports no trend for stationary noise', () => {
    const n = 12 * 30;
    let falsePositives = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const v = ar1(n, 0.6, seed + 100).map((e, i) => 10 + 5 * Math.sin((2 * Math.PI * (i % 12)) / 12) + e);
      const { stats } = processMonthlyTimeSeries(monthDates(1990, n), v, 'x', 'FULL_PERIOD');
      if (stats.hamedRaoMkPValue < 0.05) falsePositives++;
    }
    expect(falsePositives).toBeLessThanOrEqual(4);
  });
});
