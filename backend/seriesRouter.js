/**
 * /api/series      : real monthly time series for (variable, lat, lon, start, end)
 * /api/series/catalog : which data providers are usable on this server right now
 */
import express from 'express';
import { getSeries, listSeriesCapabilities, getProviderAvailability } from './seriesService.js';

export const seriesRouter = express.Router();

seriesRouter.get('/catalog', async (_req, res) => {
  try {
    const [providers, variables] = await Promise.all([
      getProviderAvailability(),
      Promise.resolve(listSeriesCapabilities())
    ]);
    res.json({
      timestamp: new Date().toISOString(),
      providers,
      variables: variables.map(v => ({
        ...v,
        available: providers[v.provider]?.available ?? false,
        unavailableReason: providers[v.provider]?.available ? undefined : providers[v.provider]?.reason
      }))
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

seriesRouter.get('/', async (req, res) => {
  try {
    const variable = String(req.query.variable || '');
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const start = req.query.start !== undefined ? Number(req.query.start) : undefined;
    const end = req.query.end !== undefined ? Number(req.query.end) : undefined;

    const payload = await getSeries(variable, lat, lon, start, end);
    res.json(payload);
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    if (status >= 500) console.error(`[series] ${req.query.variable}:`, e.message);
    res.status(status).json({ error: e.message });
  }
});
