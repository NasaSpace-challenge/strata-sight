<p align="center"><img src="frontend/public/brand/stratasight-wordmark.jpg" alt="StrataSight" width="420" /></p>

# StrataSight: is your part of the Earth changing?

**NASA Space Apps Challenge 2026: Earth Science Trend Detective.**

Pick a plain question ("Is it getting hotter?", "Are soils drying out?"). StrataSight retrieves decades of **real** NASA and NOAA
observations for that place and answers the four questions the challenge asks, in plain language and with the statistics to back it up:

| The challenge asks | StrataSight answers with |
| --- | --- |
| **What** is changing? | A verdict headline and an arrow: rising, falling, or no clear trend |
| **Where** is it changing? | The exact grid cell analysed, plus a world **trend map** with significance dots |
| **How much** is it changing? | Sen's slope per decade with a 95% confidence interval, and the total change over the record |
| **Is it significant?** | A confidence meter built on an autocorrelation-corrected Mann-Kendall test (Hamed-Rao), reported with its p-value |

> **Nothing is simulated.** Every series is fetched from the agency service listed on its provenance strip. If a service is
> unreachable, the app says so, or shows an earlier real fetch clearly labelled `CACHED_REAL` with its original date.

---

## Try it in three minutes

```bash
npm install
npm run dev          # frontend http://localhost:5173, backend http://localhost:5000
```

No API keys are needed for the core experience (NASA POWER / MERRA-2 and NOAA GML). See [Optional services](#optional-services).

**Suggested judge path** (or click **Guided demo** in the header for a narrated six-step tour):

1. **Start**: choose *"Is the air getting dirtier or cleaner?"*, then *Indo-Gangetic Plain*, then **Show me the answer**.
2. **Analyze**: read the verdict card. Flip *Plain English / Technical*. Open the full statistical report.
3. **Compare**: open the story *"Two Paths for Air Pollution"*: aerosols rising over South Asia, falling over Scandinavia.
4. **Map**: *"Where is it changing?"* samples real series on a 15° land grid. Red over India, blue over eastern China. Click any square to analyze it.
5. **Methods**: a generated provenance table (agency, product, record, resolution, caveat per variable) and an honest list of what the tool cannot tell you.

For a fast first load on a fresh machine, optionally pre-fetch the demo data (about 1 to 2 minutes):

```bash
npm run warm
```

---

## What makes the answers trustworthy

- **Real data only.** 19 variables across NASA POWER (MERRA-2 / CERES), NASA GES DISC (GPM IMERG, GLDAS, AIRS, OMI), NOAA GML and optional MODIS via Earth Engine. Variables whose provider is not configured are **hidden**, never faked.
- **Provenance on every series:** agency, product, endpoint, license, native resolution, DOI where one exists, record start and end, number of months, number of interpolated months.
- **Gaps** of up to three months are linearly interpolated and flagged; longer gaps are never papered over.
- **Autocorrelation is handled.** Monthly climate data remember last month, which makes the plain Mann-Kendall test overconfident. Verdicts use the Hamed-Rao modified test; the plain p-value is shown only for comparison. The Pettitt change-point test uses an effective-sample-size correction for the same reason.
- **Multiple-testing is handled.** The trend map tests dozens of places at once; dots mark cells that survive Benjamini-Hochberg false-discovery control at 5%.
- **It states its limits.** A detected trend is not attributed to a cause, short satellite records can mimic trends, and reanalysis is a model-assisted estimate. These appear next to every verdict and on the Methods page.
- **Tested.** `npm test` runs 17 unit tests of the statistics engine against textbook values and seeded synthetic signals, including a regression test that autocorrelated noise is no longer reported as a structural break.

### Statistics at a glance

| Method | Used for |
| --- | --- |
| Mann-Kendall with tie correction | Trend detection |
| Hamed-Rao modified Mann-Kendall | **Authoritative** p-value under serial correlation |
| Sen's slope with Gilbert confidence interval | Size of change per decade |
| Seasonal Mann-Kendall, STL-style decomposition | Seasonal robustness, signal / season / noise |
| Pettitt (autocorrelation-corrected) | Abrupt change-point |
| Benjamini-Hochberg FDR | Field significance on the trend map |
| Bretherton effective-N correlation | Lead-lag and teleconnection links (ENSO, NAO, PDO) |

---

## Data sources

| Variable | Product / instrument | Agency | Record | Resolution | Provider |
| --- | --- | --- | --- | --- | --- |
| Near-surface air temperature | MERRA-2 (via NASA POWER) | NASA GMAO | 1981–present | 0.5° × 0.625° | POWER |
| Daytime maximum / nighttime minimum temperature | MERRA-2 (via NASA POWER) | NASA GMAO | 1981–present | 0.5° × 0.625° | POWER |
| Land & sea skin temperature | MERRA-2 (via NASA POWER) | NASA GMAO | 1981–present | 0.5° × 0.625° | POWER |
| Sunlight reaching the surface | CERES SYN1deg (via NASA POWER) | NASA LaRC | 1981–present | 1° × 1° | POWER |
| Cloud cover | MERRA-2 / CERES (via NASA POWER) | NASA GMAO / LaRC | 1981–present | 0.5° × 0.625° | POWER |
| Relative humidity, wind speed, total column ozone | MERRA-2 (via NASA POWER) | NASA GMAO | 1981–present | 0.5° × 0.625° | POWER |
| Aerosol optical depth (550 nm) | MERRA-2 aerosol reanalysis | NASA GMAO | 2001–present | 0.5° × 0.625° | POWER |
| Precipitation (gauge-corrected), root-zone soil wetness | MERRA-2 (via NASA POWER) | NASA GMAO | 1981–present | 0.5° × 0.625° | POWER |
| Tropospheric NO₂ | OMI on Aura | NASA GSFC / KNMI | 2004–present | 0.25° × 0.25° | GES DISC |
| Monthly precipitation | GPM IMERG Final | NASA / JAXA | 2000–present | 0.1° × 0.1° | GES DISC |
| Root-zone soil moisture | GLDAS-2.1 Noah | NASA GSFC | 2000–present | 0.25° × 0.25° (land) | GES DISC |
| Satellite skin temperature | AIRS on Aqua | NASA JPL | 2002–present | 1° × 1° | GES DISC |
| Atmospheric CO₂ | Mauna Loa Observatory | NOAA GML | 1958–present | global mean | NOAA GML |
| Atmospheric methane | Global marine surface network | NOAA GML | 1984–present | global mean | NOAA GML |
| Vegetation greenness (NDVI), optional | MODIS on Terra | NASA LP DAAC | 2001–present | 250 m | Earth Engine |

The same table, with per-variable caveats, is generated live in the app's **Methods** tab from the variable catalog, so it cannot drift from the code.
Water-resources views also use PO.DAAC SWOT river altimetry, Environment and Climate Change Canada hydrometric gauges, and CSA RCM SAR scene metadata.

---

## See it from space

The Map tab has a third mode, **See it from space**, that shows what the place looks like, using NASA's own imagery services:

| View | Source |
| --- | --- |
| Satellite map: Terra, Aqua and NOAA-20 true colour, plus heat, air pollution, NO₂, rain, greenness and night lights, with a date picker and a "clearest recent days" strip | NASA GIBS (Worldview tiles) |
| Then vs now slider (same time of year, clearest nearby day) and a daily time-lapse | NASA GIBS and Worldview Snapshots, cached by the backend |
| Natural events near the place (wildfires, storms, volcanoes, floods, sea ice) | NASA EONET |
| Pictures and videos tagged with the place | NASA Image and Video Library |
| "Earth right now" on the Start page | NASA EPIC on DSCOVR |

It is honest about what it is: daily satellite pictures that are hours to two days old, not live video. Cloud cover is estimated from a tiny preview and labelled as such. A verdict on Analyze also shows a recent picture of the place, and the printed briefing embeds it with its date and source. No API key is needed. Backend routes: `/api/imagery`, `/api/events`, `/api/media`, `/api/epic`; downloaded previews are cached in `backend/imagery-cache/` (git-ignored).

---

## Architecture

```
frontend/   React 19 + Vite + TypeScript (strict) + Tailwind (built, not CDN) + Recharts + Leaflet + CesiumJS (3D globe)
  services/statisticsEngine.ts   all statistics (tested in statisticsEngine.test.ts)
  services/verdict.ts            turns statistics into the plain-language answer
  services/guidedQuestions.ts    the question-first entry points
  services/landGrid.ts           land sampling grid (shared with the cache-warming script)
  components/                    VerdictCard, TrendMapView, DetectiveWizard, GuidedDemo, labs…
backend/    Express 5 gateway: one /api/series route in front of every agency
  seriesService.js               provider adapters, gap handling, provenance, caching, stale-while-error
  seed-cache/                    read-only seed of real fetches (served only if a live call fails)
scripts/warm-cache.mts           pre-fetch the demo data
```

- **Resilience.** Concurrent identical requests share one upstream fetch. If an agency fails, an earlier real response for the exact request is served as `CACHED_REAL`. A committed `backend/seed-cache/` covers the demo stories, so a flaky network cannot break a live demo.
- **Performance.** The main JavaScript bundle is about 390 kB (124 kB gzipped); the 3D globe, Gemini SDK, map and labs load on demand. Switching region on Analyze settles in well under a second once data is cached.
- **Accessibility.** Keyboard-operable controls, `aria` labels and live regions, reduced-motion support, visible focus rings, and a text readout beside every map.
- **Responsive.** Audited at 390 px width across every tab with no horizontal overflow.

## Optional services

Copy `backend/.env.example` to `backend/.env.local` and fill in what you have. Everything is optional; the app runs without a file.

| Setting | Unlocks |
| --- | --- |
| `EARTHDATA_TOKEN` (free, [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov/users/tokens)) | GPM IMERG, GLDAS, AIRS and OMI variables |
| `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `PROXY_HEADER` + `gcloud auth application-default login` | The AI Climatologist drawer (Gemini on Vertex AI). Without it the drawer says it is unavailable. |
| `EE_PROJECT_ID`, `EE_SERVICE_ACCOUNT_KEY_FILE` | MODIS NDVI via Earth Engine (hidden unless the project is registered) |
| `NOAA_CDO_TOKEN` | NOAA Climate Data Online lookups |

Never commit `backend/.env.local` or `backend/ee-service-account.json` (both are git-ignored).

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Frontend and backend with hot reload |
| `npm test` | Statistics and imagery-logic unit tests (frontend and backend) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Production build of the frontend |
| `npm run warm` | Pre-fetch demo data into the local cache (`-- --map=all` scans every POWER variable) |
| `npm run seed` | Refresh the committed read-only seed |

Requires Node.js 20.18 or newer (22.9+ recommended).

## Known limitations

- Trend-map cells are sampled on a 15° grid by cell-centre land test, so some coastal cells are omitted; neighbouring cells are correlated, so the FDR correction is approximate.
- Satellite-era records (10 to 25 years) can be dominated by natural cycles such as El Niño.
- The CSA RCM SAR scene values in the Water & SAR tab are illustrative scene metadata, labelled as such, not a processed time series.
- StrataSight detects change; it does not attribute it to a cause.
- Satellite pictures are daily snapshots, not live video; the cloud percentage is an estimate from a small preview, and NASA's media library only covers some places.

## Attribution

Contains information licensed under the Open Government Licence – Canada. NASA POWER, GES DISC, PO.DAAC and NOAA data are used under their open-data policies with source citation. KNMI Climate Explorer indices are used for scientific and educational purposes.
NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites.
Coastlines: Natural Earth via `world-atlas`.
