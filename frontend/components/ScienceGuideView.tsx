import React from 'react';
import { NASA_VARIABLES } from '../services/earthScienceData';
import { bannerClass } from './PageBanner';
import {
  BookOpen,
  Activity,
  Satellite,
  ShieldCheck,
  Database,
  Scale,
  ExternalLink
} from 'lucide-react';

export const ScienceGuideView: React.FC = () => {
  const officialSources = [
    {
      name: 'NASA Giovanni (GES DISC)',
      url: 'https://giovanni.gsfc.nasa.gov/',
      role: 'Time-series service used for GPM IMERG precipitation, GLDAS soil moisture, AIRS skin temperature and OMI NO₂ (retrieved server-side with an Earthdata token).'
    },
    {
      name: 'NASA GES DISC Hydrology Data Rods',
      url: 'https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series',
      role: 'Hydrology data rods (GLDAS-2.1, NLDAS-2, FLDAS): fast single-point, long-record extraction of soil moisture and runoff.'
    },
    {
      name: 'NASA LP DAAC AppEEARS & NASA POWER',
      url: 'https://appeears.earthdatacloud.nasa.gov/',
      role: 'AppEEARS lists 193 analysis-ready products (browsable in the Water & SAR tab). NASA POWER serves the MERRA-2 / CERES point series used throughout StrataSight.'
    },
    {
      name: 'NOAA Climate Data Online (CDO v2) & GML',
      url: 'https://www.ncei.noaa.gov/cdo-web/',
      role: 'Physical weather-station ground truth (GHCND / GSOM) & live Mauna Loa CO₂ / Global CH₄ atmospheric baselines.'
    },
    {
      name: 'KNMI Climate Explorer (Netherlands)',
      url: 'https://climexp.knmi.nl/',
      role: 'Observed teleconnection indices (ENSO Niño 3.4, NAO, IOD) used in the Teleconnections tab.'
    },
    {
      name: 'KRISS Statistical Trend Methods & Statsig Significance',
      url: 'https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b',
      role: 'Parametric OLS vs. Mann-Kendall vs. Hirsch Seasonal MK vs. ADF unit-root stationarity, statistical power (1−β), and BH-FDR.'
    },
    {
      name: 'CSA RADARSAT Constellation Mission (RCM) & SAR Python Tutorial',
      url: 'https://donnees-data.asc-csa.gc.ca/en/dataset/rcm',
      role: 'Trio of C-band (5.405 GHz) all-weather SAR spacecraft piercing BC wildfire smoke (OK2080033), Arctic polar night, and marine oil slicks.'
    },
    {
      name: 'NASA / CNES / CSA SWOT Mission & PO.DAAC Hydrocron',
      url: 'https://www.asc-csa.gc.ca/eng/satellites/swot/',
      role: 'Ka-band Radar Interferometer (KaRIn) surveying 90% of global lakes & rivers with live WSE, width, slope, and discharge telemetry.'
    },
    {
      name: 'Geo.ca & ECCC MSC GeoMet OGC API (Canada)',
      url: 'https://geo.ca/',
      role: 'Canadian Geospatial Data Infrastructure & 100-year Water Survey of Canada (HYDAT) hydrometric ground-truth gauges under OGL–Canada.'
    }
  ];

  return (
    <div className="py-4 space-y-8 text-slate-800">
      {/* Hero Banner */}
      <div className={`${bannerClass('emerald')} rounded-2xl p-6 sm:p-8`}>
        <div className="flex items-center space-x-2.5 text-emerald-700 text-xs font-mono uppercase tracking-wider font-semibold mb-2">
          <BookOpen className="w-4 h-4" />
          <span>StrataSight Scientific Methodology &amp; Multi-Agency Reference</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Rigorous Climate Trend Detection &amp; Statistical Significance
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Geophysical satellite records exhibit strong seasonal cycles, non-Gaussian extremes, red-noise serial
          autocorrelation, and structural regime breaks. Naive ordinary least-squares trendlines routinely trigger false
          positives, so StrataSight executes a 6-stage NASA / KNMI / KRISS statistical verification pipeline.
        </p>
      </div>

      {/* 6-Stage Mathematical Verification Pipeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>The 6-Stage StrataSight Statistical Engine</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-blue-700 text-xs font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
              STAGE 1 • ANOMALIES
            </span>
            <h3 className="font-bold text-slate-900 text-sm">WMO Baseline Deseasonalization</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Subtracts calendar-month reference climatology (<code className="font-mono">A_ym = X_ym − μ_m</code>) and
              computes standardized Z-scores across selectable WMO baselines (1961–1990, 1981–2010, 1991–2020, 2001–2020).
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-blue-700 text-xs font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
              STAGE 2 • HAMED–RAO MK
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Autocorrelation-Corrected Mann–Kendall</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Applies tie-adjusted rank statistics plus Hamed &amp; Rao (1998) empirical serial-correlation variance
              inflation (<code className="font-mono">Var*(S)</code>) and Santer et al. (2000){' '}
              <code className="font-mono">N_eff = N(1−r₁)/(1+r₁)</code> to eliminate red-noise false positives.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-indigo-700 text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
              STAGE 3 • SEASONAL MK
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Hirsch Seasonal Mann–Kendall &amp; Sen CI</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Evaluates concordance strictly within matching calendar months (<code className="font-mono">S = Σ S_m</code>)
              alongside Gilbert (1987) 95% non-parametric Theil–Sen slope confidence intervals, immune to flood or El Niño outliers.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-amber-700 text-xs font-bold px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              STAGE 4 • STATIONARITY &amp; BREAKS
            </span>
            <h3 className="font-bold text-slate-900 text-sm">ADF Unit-Root &amp; Pettitt Regime Shifts</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Augmented Dickey–Fuller (<code className="font-mono">τ &lt; −3.41</code>) separates deterministic
              trend-stationarity from stochastic unit-root drift, while Pettitt&apos;s rank test pinpoints structural
              regime jumps.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-emerald-700 text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              STAGE 5 • POWER &amp; EMERGENCE
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Weatherhead Time of Emergence (ToE)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Computes achieved statistical power (<code className="font-mono">1 − β</code>) and NASA satellite
              detection horizon <code className="font-mono">T ≈ [3.3 σ_N √((1+φ)/(1−φ)) / |ω|]^(2/3)</code> so short
              missions (e.g. SWOT) aren&apos;t misread as static.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-2">
            <span className="font-mono text-purple-700 text-xs font-bold px-2 py-0.5 rounded bg-purple-50 border border-purple-200">
              STAGE 6 • ANTI-P-HACKING
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Benjamini–Hochberg FDR Control</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Controls False Discovery Rate (<code className="font-mono">q_i = min(p_i · m / rank_i)</code>) across
              simultaneous multi-region and multi-variable hypothesis scans.
            </p>
          </div>
        </div>
      </div>

      {/* Integrated NASA, Partner & CSA Data Sources */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-card space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span>Integrated Space Agency &amp; Climate Partner Sources</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {officialSources.map(src => (
            <a
              key={src.name}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="p-3.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors block space-y-1"
            >
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{src.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-slate-600 leading-relaxed">{src.role}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Provenance table: generated from the live variable catalog, so it cannot drift from the app */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4" aria-labelledby="provenance-heading">
        <div>
          <h3 id="provenance-heading" className="text-lg font-bold text-slate-900">
            Where every number comes from
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Each series is fetched from the agency service below when you ask for it. Nothing is simulated. If a service is unreachable, the app says so, or
            shows an earlier real fetch clearly labelled as cached.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4 font-semibold">Variable</th>
                <th className="py-2 pr-4 font-semibold">Product / instrument</th>
                <th className="py-2 pr-4 font-semibold">Agency</th>
                <th className="py-2 pr-4 font-semibold">Record</th>
                <th className="py-2 pr-4 font-semibold">Resolution</th>
                <th className="py-2 font-semibold">Know before you trust it</th>
              </tr>
            </thead>
            <tbody>
              {NASA_VARIABLES.map(v => (
                <tr key={v.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-semibold text-slate-900">{v.name}</td>
                  <td className="py-2 pr-4 text-slate-700">{v.instrumentOrModel}</td>
                  <td className="py-2 pr-4 text-slate-700">{v.agency}</td>
                  <td className="py-2 pr-4 text-slate-700 whitespace-nowrap">{v.startYear ?? '?'}–present</td>
                  <td className="py-2 pr-4 text-slate-700">{v.scope === 'global' ? 'Global mean / single station' : v.resolution ?? 'n/a'}</td>
                  <td className="py-2 text-slate-600">{v.caveat ?? 'Monthly values; see the definition on the variable card.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Honest limits */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-2" aria-labelledby="limits-heading">
        <h3 id="limits-heading" className="text-lg font-bold text-amber-900">
          What this tool cannot tell you
        </h3>
        <ul className="list-disc pl-5 text-sm text-amber-900/90 space-y-1.5 leading-relaxed">
          <li>
            <strong>It detects change; it does not explain it.</strong> A significant trend is not proof of a cause. Attribution needs climate models and expert
            analysis.
          </li>
          <li>
            <strong>Records are short for climate.</strong> Satellite products span 10–25 years; natural cycles such as El Niño can masquerade as trends. Longer
            records (MERRA-2 from 1981, CO₂ from 1958) are more reliable.
          </li>
          <li>
            <strong>Reanalysis is a model-assisted estimate,</strong> not a thermometer. It blends observations with a weather model, so local extremes can be smoothed.
          </li>
          <li>
            <strong>Monthly data remember last month.</strong> Simple significance tests overstate certainty on such data, so every verdict uses an
            autocorrelation-corrected test (Hamed–Rao) and reports the simple test only for comparison.
          </li>
          <li>
            <strong>Maps test many places at once.</strong> The trend map corrects for that with a false-discovery-rate procedure, but neighbouring cells are
            correlated, so treat isolated dots with caution.
          </li>
        </ul>
      </div>

      {/* Mandatory Licensing & Non-U.S. Government Data Use Compliance */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 space-y-3 text-xs">
        <div className="flex items-center space-x-2 text-emerald-400 font-mono uppercase tracking-wider font-bold">
          <Scale className="w-4 h-4" />
          <span>Data Governance, Attribution &amp; Non-U.S. Government Compliance</span>
        </div>
        <p className="leading-relaxed text-slate-300">
          1. <strong>NASA &amp; NOAA Open Science:</strong> NASA POWER (MERRA-2 / CERES), GES DISC Giovanni &amp; Data
          Rods, LP DAAC AppEEARS, PO.DAAC SWOT Hydrocron, NTRS 20090042747, and NOAA NCEI/GML datasets are provided
          under U.S. Government open-science policies with full source citation.
        </p>
        <p className="leading-relaxed text-slate-300">
          2. <strong>Canadian Space Agency (CSA) &amp; Geo.ca:</strong>{' '}
          <em>Contains information licensed under the Open Government Licence – Canada.</em>CSA&apos;s{' '}
          <code className="text-sky-300">asc-csa/Synthetic_Aperture_Radar_Tutorial</code> workflows are used in
          compliance with the CSA Modified MIT License.
        </p>
        <p className="leading-relaxed text-slate-400">
          3. <strong>Partner Disclaimer:</strong> KNMI Climate Explorer (Royal Netherlands Meteorological Institute) and
          KRISS statistical references are utilized strictly for scientific/educational hackathon analysis.{' '}
          <em>
            NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on
            non-U.S. Government websites.
          </em>
        </p>
      </div>
    </div>
  );
};
