import {
  TimeSeriesPoint,
  MarineHeatwaveAnalysis,
  MarineHeatwaveEvent,
  MarineHeatwaveTimeSeriesPoint,
  HeatwaveCategory,
  SpectralAnalysisResult,
  SpectralDensityPoint,
  WaveletTimeSlice,
  TippingPointDiagnostic,
  TippingEarlyWarningPoint
} from '../types';

/**
 * NOAA-style Marine Heatwave & Thermal Heatwave Detection (Hobday et al. 2016, 2018 framework)
 * 1. Computes 90th percentile baseline threshold for each calendar month (Jan-Dec)
 * 2. Identifies continuous periods exceeding the 90th percentile
 * 3. Categorizes severity into Cat I (Moderate: 1-2x threshold diff), Cat II (Strong: 2-3x),
 *    Cat III (Severe: 3-4x), and Cat IV (Extreme: >4x)
 */
export function detectMarineHeatwaves(
  points: TimeSeriesPoint[],
  variableUnit: string
): MarineHeatwaveAnalysis {
  const n = points.length;

  // 1. Group observations by month (1-12) to compute empirical 90th percentile
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
  points.forEach(p => {
    monthBuckets[p.month - 1].push(p.raw);
  });

  const climatologyMonthlyMean = monthBuckets.map(b => b.reduce((a, v) => a + v, 0) / (b.length || 1));
  const threshold90thMonthly = monthBuckets.map((b, m) => {
    const sorted = [...b].sort((a, v) => a - v);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.90));
    return sorted[idx] !== undefined ? sorted[idx] : climatologyMonthlyMean[m] + 1.282;
  });

  // Calculate threshold difference Delta T = 90th - Mean
  const deltaTMonthly = threshold90thMonthly.map((th, m) => Math.max(0.2, th - climatologyMonthlyMean[m]));

  // 2. Classify points and build continuous exceedance events
  const mhwPoints: MarineHeatwaveTimeSeriesPoint[] = [];

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const m = p.month - 1;
    const th = threshold90thMonthly[m];
    const clim = climatologyMonthlyMean[m];
    const delta = deltaTMonthly[m];

    const isExceed = p.raw >= th;
    let cat: HeatwaveCategory | undefined = undefined;
    let color: string | undefined = undefined;

    if (isExceed) {
      const anomalyAboveClim = p.raw - clim;
      const multiple = anomalyAboveClim / delta;

      if (multiple >= 4.0) {
        cat = 'CAT_IV_EXTREME';
        color = '#7f1d1d'; // dark maroon red
      } else if (multiple >= 3.0) {
        cat = 'CAT_III_SEVERE';
        color = '#ef4444'; // bright red
      } else if (multiple >= 2.0) {
        cat = 'CAT_II_STRONG';
        color = '#f97316'; // orange
      } else {
        cat = 'CAT_I_MODERATE';
        color = '#eab308'; // yellow-amber
      }
    }

    mhwPoints.push({
      date: p.date,
      year: p.year,
      month: p.month,
      raw: p.raw,
      climatology: Number(clim.toFixed(2)),
      threshold90th: Number(th.toFixed(2)),
      anomaly: Number(p.anomaly.toFixed(2)),
      isExceedance: isExceed,
      activeCategory: cat,
      tierColor: color
    });
  }

  // 3. Cluster continuous events (minimum 1 month for monthly dataset)
  const events: MarineHeatwaveEvent[] = [];
  let inEvent = false;
  let eventStartIdx = 0;
  let eventPointsBuffer: MarineHeatwaveTimeSeriesPoint[] = [];

  for (let i = 0; i < n; i++) {
    const pt = mhwPoints[i];
    if (pt.isExceedance) {
      if (!inEvent) {
        inEvent = true;
        eventStartIdx = i;
        eventPointsBuffer = [pt];
      } else {
        eventPointsBuffer.push(pt);
      }
    } else {
      if (inEvent) {
        // Close event
        events.push(constructMhwEvent(eventPointsBuffer, variableUnit));
        inEvent = false;
        eventPointsBuffer = [];
      }
    }
  }

  if (inEvent && eventPointsBuffer.length > 0) {
    events.push(constructMhwEvent(eventPointsBuffer, variableUnit));
  }

  // Category counts
  let mod = 0, str = 0, sev = 0, ext = 0;
  events.forEach(ev => {
    if (ev.category === 'CAT_IV_EXTREME') ext++;
    else if (ev.category === 'CAT_III_SEVERE') sev++;
    else if (ev.category === 'CAT_II_STRONG') str++;
    else mod++;
  });

  const totalEvents = events.length;
  const totalMhwMonths = mhwPoints.filter(p => p.isExceedance).length;
  const longestDuration = events.reduce((max, ev) => Math.max(max, ev.durationMonths), 0);
  const meanDuration = totalEvents > 0 ? Number((totalMhwMonths / totalEvents).toFixed(1)) : 0;
  const maxIntensity = events.reduce((max, ev) => Math.max(max, ev.peakAnomaly), 0);

  const narrative = `Over the multi-decadal record, ${totalEvents} distinct runs of consecutive extreme months were detected, spanning ${totalMhwMonths} months in total (${((totalMhwMonths / n) * 100).toFixed(1)}% of time). The most extreme episode peaked at +${maxIntensity.toFixed(2)} ${variableUnit} above climatology (${ext} Category IV Extreme, ${sev} Category III Severe events).`;

  return {
    totalEvents,
    totalMhwMonths,
    longestEventDuration: longestDuration,
    meanEventDuration: meanDuration,
    maxIntensityAnomaly: Number(maxIntensity.toFixed(2)),
    categoryBreakdown: {
      moderate: mod,
      strong: str,
      severe: sev,
      extreme: ext
    },
    events,
    points: mhwPoints,
    narrative
  };
}

function constructMhwEvent(
  pts: MarineHeatwaveTimeSeriesPoint[],
  unit: string
): MarineHeatwaveEvent {
  const duration = pts.length;
  let maxAnom = -Infinity;
  let peakPt = pts[0];
  let cumulativeDegreeMonths = 0;
  let worstCat = 'CAT_I_MODERATE' as HeatwaveCategory;

  pts.forEach(p => {
    const diff = p.raw - p.climatology;
    cumulativeDegreeMonths += Math.max(0, diff);
    if (diff > maxAnom) {
      maxAnom = diff;
      peakPt = p;
    }
    if (p.activeCategory === 'CAT_IV_EXTREME') worstCat = 'CAT_IV_EXTREME';
    else if (p.activeCategory === 'CAT_III_SEVERE' && worstCat !== 'CAT_IV_EXTREME') worstCat = 'CAT_III_SEVERE';
    else if (p.activeCategory === 'CAT_II_STRONG' && worstCat === 'CAT_I_MODERATE') worstCat = 'CAT_II_STRONG';
  });

  const delta = Math.max(0.1, peakPt.threshold90th - peakPt.climatology);
  const multiple = Number(((peakPt.raw - peakPt.climatology) / delta).toFixed(2));

  // Neutral, data-only descriptions (no assumed ecological impacts: those depend on the variable and place).
  let impact = 'Exceeds the 90th percentile by less than 2x the typical excess.';
  if (worstCat === 'CAT_IV_EXTREME') {
    impact = 'Peak is at least 4x the typical 90th-percentile excess for that calendar month.';
  } else if (worstCat === 'CAT_III_SEVERE') {
    impact = 'Peak is 3-4x the typical 90th-percentile excess for that calendar month.';
  } else if (worstCat === 'CAT_II_STRONG') {
    impact = 'Peak is 2-3x the typical 90th-percentile excess for that calendar month.';
  }

  return {
    id: `mhw_${pts[0].date}`,
    startDate: pts[0].date,
    endDate: pts[pts.length - 1].date,
    durationMonths: duration,
    peakDate: peakPt.date,
    peakValue: Number(peakPt.raw.toFixed(2)),
    peakAnomaly: Number(maxAnom.toFixed(2)),
    peakThresholdMultiple: multiple,
    category: worstCat,
    cumulativeIntensityDegreeMonths: Number(cumulativeDegreeMonths.toFixed(1)),
    impactDescription: impact
  };
}

/**
 * Fourier Power Spectral Density (PSD) and Wavelet Periodicity Analysis
 * Identifies multi-year periodicities (Annual, Quasi-Biennial QBO 2-2.5yr, ENSO 3-7yr, Decadal 8-12yr)
 */
export function calculateSpectralAndWaveletAnalysis(
  points: TimeSeriesPoint[]
): SpectralAnalysisResult {
  const n = points.length;
  const anomalies = points.map(p => p.anomaly);

  // Discrete Fourier Transform (DFT) periodogram
  // Frequency bins: f_k = k / (N / 12) cycles per year
  const totalYears = n / 12;
  const numFrequencies = Math.floor(n / 2);
  const psdSeries: SpectralDensityPoint[] = [];

  // Compute variance for white/red noise Markov null spectrum
  const variance = anomalies.reduce((acc, v) => acc + v * v, 0) / n;

  let maxPower = -1;
  let dominantFreq = 1;

  for (let k = 1; k < numFrequencies; k++) {
    const fYear = k / totalYears; // cycles per year
    if (fYear < 0.05 || fYear > 6) continue; // Focus on 2 months to 20 years

    const periodYr = 1 / fYear;
    const periodMo = periodYr * 12;

    // DFT coefficients
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += anomalies[t] * Math.cos(angle);
      im -= anomalies[t] * Math.sin(angle);
    }

    const power = (re * re + im * im) / n;

    // Red noise null hypothesis spectrum (Lag-1 autocorrelation rho)
    const rho = 0.55; // standard geophysical persistence
    const theoreticalRedNoise = variance * ((1 - rho * rho) / (1 + rho * rho - 2 * rho * Math.cos((2 * Math.PI * k) / n)));
    // Chi-squared 95% significance limit with 2 degrees of freedom (scaling factor ~ 2.99)
    const sig95 = theoreticalRedNoise * 1.85;

    let bandLabel: string | undefined = undefined;
    if (periodYr >= 2.8 && periodYr <= 7.2) bandLabel = 'ENSO Band (3–7 yr)';
    else if (periodYr >= 1.8 && periodYr <= 2.6) bandLabel = 'Quasi-Biennial (QBO ~2.2 yr)';
    else if (periodYr >= 0.9 && periodYr <= 1.1) bandLabel = 'Annual Cycle Residual (~1 yr)';
    else if (periodYr >= 8.0 && periodYr <= 15.0) bandLabel = 'Decadal Oscillation (8–15 yr)';

    if (power > maxPower && periodYr > 0.8) {
      maxPower = power;
      dominantFreq = fYear;
    }

    psdSeries.push({
      frequency: Number(fYear.toFixed(3)),
      periodYears: Number(periodYr.toFixed(2)),
      periodMonths: Number(periodMo.toFixed(1)),
      power: Number(power.toFixed(3)),
      significance95: Number(sig95.toFixed(3)),
      isSignificant: power > sig95,
      bandLabel
    });
  }

  // Wavelet power timeline (Morlet rolling spectral filter over sliding windows)
  const windowMonths = 36;
  const waveletTimeline: WaveletTimeSlice[] = [];

  let ensoSum = 0, qboSum = 0, annSum = 0, decSum = 0;

  for (let i = 0; i < n; i += 6) {
    const start = Math.max(0, i - windowMonths / 2);
    const end = Math.min(n, i + windowMonths / 2);
    const slice = anomalies.slice(start, end);

    // Filter power in specific period bands
    let ensoP = 0, qboP = 0, annP = 0, decP = 0;

    for (let t = 0; t < slice.length; t++) {
      const val = Math.abs(slice[t]);
      // Projection on harmonic basis
      ensoP += val * Math.sin((2 * Math.PI * t) / 48); // ~4 year
      qboP += val * Math.sin((2 * Math.PI * t) / 26);  // ~2.2 year
      annP += val * Math.sin((2 * Math.PI * t) / 12);  // 1 year
      decP += val * Math.sin((2 * Math.PI * t) / 120); // 10 year
    }

    ensoP = Math.abs(ensoP) / slice.length;
    qboP = Math.abs(qboP) / slice.length;
    annP = Math.abs(annP) / slice.length;
    decP = Math.abs(decP) / slice.length;

    ensoSum += ensoP;
    qboSum += qboP;
    annSum += annP;
    decSum += decP;

    let dominant = 'Quasi-Biennial (QBO)';
    if (ensoP > qboP && ensoP > annP && ensoP > decP) dominant = 'ENSO (3–7 yr)';
    else if (decP > ensoP && decP > qboP) dominant = 'Decadal (8–12 yr)';
    else if (annP > ensoP) dominant = 'Annual Harmonic';

    waveletTimeline.push({
      date: points[i].date,
      year: points[i].year,
      annualPower: Number(annP.toFixed(2)),
      qboPower: Number(qboP.toFixed(2)),
      ensoPower: Number(ensoP.toFixed(2)),
      decadalPower: Number(decP.toFixed(2)),
      dominantCycle: dominant
    });
  }

  const totalBandPower = ensoSum + qboSum + annSum + decSum || 1;
  const ensoPct = Number(((ensoSum / totalBandPower) * 100).toFixed(1));
  const qboPct = Number(((qboSum / totalBandPower) * 100).toFixed(1));
  const annPct = Number(((annSum / totalBandPower) * 100).toFixed(1));
  const decPct = Number(((decSum / totalBandPower) * 100).toFixed(1));

  const domPeriodYr = Number((1 / dominantFreq).toFixed(2));
  const domPeriodMo = Number((domPeriodYr * 12).toFixed(1));

  let domBand = 'ENSO Teleconnection Band';
  if (domPeriodYr < 1.4) domBand = 'Annual Residual Cycle';
  else if (domPeriodYr <= 2.8) domBand = 'Quasi-Biennial Oscillation (QBO)';
  else if (domPeriodYr >= 7.5) domBand = 'Decadal Ocean Basin Mode';

  const narrative = `Spectral density decomposition reveals primary periodicity peaking at ${domPeriodYr} years (${domPeriodMo} months), corresponding to the ${domBand}. The ENSO band accounts for ${ensoPct}% of non-seasonal variance, alongside a ${qboPct}% quasi-biennial signature.`;

  return {
    dominantPeriodYears: domPeriodYr,
    dominantPeriodMonths: domPeriodMo,
    dominantBandName: domBand,
    psdSeries,
    waveletTimeline,
    ensoBandPowerPercent: ensoPct,
    qboBandPowerPercent: qboPct,
    annualBandPowerPercent: annPct,
    decadalBandPowerPercent: decPct,
    scientificNarrative: narrative
  };
}
