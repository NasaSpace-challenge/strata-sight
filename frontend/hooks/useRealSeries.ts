import { useCallback, useEffect, useState } from 'react';
import { fetchRealSeries, LiveSeriesPayload, SeriesError } from '../services/liveEarthDataService';

export type SeriesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SeriesState {
  status: SeriesStatus;
  data: LiveSeriesPayload | null;
  error: string | null;
  retry: () => void;
}

/**
 * Loads one REAL monthly series. Never returns synthetic data: on failure `error` carries
 * a human-readable reason that the UI must display.
 */
export function useRealSeries(
  variableId: string | null,
  lat: number,
  lon: number,
  enabled = true
): SeriesState {
  const [state, setState] = useState<Omit<SeriesState, 'retry'>>({ status: 'idle', data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!enabled || !variableId) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    fetchRealSeries(variableId, lat, lon, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setState({ status: 'ready', data, error: null });
      })
      .catch(err => {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        const message = err instanceof SeriesError ? err.message : 'Unexpected error while loading data.';
        setState({ status: 'error', data: null, error: message });
      });
    return () => controller.abort();
  }, [variableId, lat, lon, enabled, nonce]);

  return { ...state, retry };
}

export interface SeriesBundleState {
  status: SeriesStatus;
  data: Record<string, LiveSeriesPayload>;
  error: string | null;
  retry: () => void;
}

/** Loads several real series for the same location in parallel (all-or-nothing). */
export function useRealSeriesBundle(
  variableIds: string[],
  lat: number,
  lon: number,
  enabled = true
): SeriesBundleState {
  const [state, setState] = useState<Omit<SeriesBundleState, 'retry'>>({ status: 'idle', data: {}, error: null });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce(n => n + 1), []);
  const key = variableIds.join(',');

  useEffect(() => {
    if (!enabled || variableIds.length === 0) {
      setState({ status: 'idle', data: {}, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', data: {}, error: null });
    Promise.all(variableIds.map(id => fetchRealSeries(id, lat, lon, controller.signal).then(d => [id, d] as const)))
      .then(entries => {
        if (!controller.signal.aborted) setState({ status: 'ready', data: Object.fromEntries(entries), error: null });
      })
      .catch(err => {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        setState({
          status: 'error',
          data: {},
          error: err instanceof SeriesError ? err.message : 'Unexpected error while loading data.'
        });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lat, lon, enabled, nonce]);

  return { ...state, retry };
}

/** Restrict several aligned series to the months they all share (by YYYY-MM key). */
export function alignByDate(
  series: { dates: string[]; values: number[] }[]
): { dates: string[]; values: number[][] } {
  if (series.length === 0) return { dates: [], values: [] };
  const maps = series.map(s => new Map(s.dates.map((d, i) => [d, s.values[i]])));
  const common = series[0].dates.filter(d => maps.every(m => m.has(d)));
  return { dates: common, values: maps.map(m => common.map(d => m.get(d) as number)) };
}
