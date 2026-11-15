import { useEffect, useState } from 'react';
import { BestCandidate, fetchBest, fetchLayers, ImageryLayer, snapshotUrl } from '../services/earthView';

export interface BestSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error';
  layer: ImageryLayer | null;
  best: BestCandidate | null;
  candidates: BestCandidate[];
  /** Ready-to-use image URL for the clearest recent day */
  url: string | null;
  error?: string;
}

/**
 * The clearest natural-colour picture of a place from the last week, from NASA's Terra satellite.
 * Pass `enabled=false` to hold off (for example until a card scrolls into view).
 */
export function useBestSnapshot(lat: number, lon: number, enabled = true, span = 100, size = 640): BestSnapshot {
  const [state, setState] = useState<BestSnapshot>({ status: 'idle', layer: null, best: null, candidates: [], url: null });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState(s => ({ ...s, status: 'loading', error: undefined }));
    (async () => {
      try {
        const { layers } = await fetchLayers();
        const layer = layers.find(l => l.key === 'terra') ?? layers.find(l => l.group === 'photo');
        if (!layer) throw new Error('No natural-colour layer is available.');
        const res = await fetchBest(layer.key, lat, lon, { span });
        if (!active) return;
        if (!res.best) {
          setState({ status: 'error', layer, best: null, candidates: res.candidates, url: null, error: 'No usable satellite picture in the last week (cloud or satellite gaps).' });
          return;
        }
        setState({ status: 'ready', layer, best: res.best, candidates: res.candidates, url: snapshotUrl(layer.key, lat, lon, res.best.date, { span, size }) });
      } catch (e) {
        if (active) setState({ status: 'error', layer: null, best: null, candidates: [], url: null, error: (e as Error).message });
      }
    })();
    return () => {
      active = false;
    };
  }, [lat, lon, enabled, span, size]);

  return state;
}
