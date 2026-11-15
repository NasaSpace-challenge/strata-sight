import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EarthVariable, RegionHotspot, StatisticalAnalysisResult } from '../../types';
import { analyzeTrendWithGemini, AiInvestigationResponse } from '../../services/geminiService';
import { fetchAiAvailability } from '../../services/aiStatus';

/** What the user is looking at right now; every analysis screen registers one of these. */
export interface AiContextInfo {
  variable: EarthVariable;
  region: RegionHotspot;
  stats: StatisticalAnalysisResult;
  comparisonRegion?: RegionHotspot;
  comparisonStats?: StatisticalAnalysisResult;
}

export type AiEntryStatus = 'loading' | 'done' | 'error' | 'cancelled';

export interface AiEntry {
  id: number;
  /** null = the default "explain this result" request */
  question: string | null;
  status: AiEntryStatus;
  response?: AiInvestigationResponse;
  error?: string;
}

interface AiAssistantApi {
  ctx: AiContextInfo | null;
  /** True once the server says the AI is not configured (null while unknown; treated as available). */
  available: boolean | null;
  open: boolean;
  /** Hidden while another overlay (the guided demo) owns the corner of the screen. */
  suspended: boolean;
  entries: AiEntry[];
  busy: boolean;
  /** Answers that arrived while the panel was closed. */
  unseen: number;
  openPanel: () => void;
  closePanel: () => void;
  /** Open the panel and run a request (default diagnosis when no question is given). */
  ask: (question?: string) => void;
  cancel: (id: number) => void;
  retry: (id: number) => void;
  clear: () => void;
}

const Ctx = createContext<AiAssistantApi | null>(null);
const Register = createContext<{
  register: (owner: string, info: AiContextInfo) => void;
  unregister: (owner: string) => void;
  setSuspended: (v: boolean) => void;
} | null>(null);

export function contextKey(c: AiContextInfo): string {
  const place = c.variable.scope === 'global' && !c.comparisonRegion ? 'global' : c.region.id;
  return `${c.variable.id}|${place}|${c.comparisonRegion?.id ?? ''}`;
}

export const AiAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [suspended, setSuspended] = useState(false);
  const [owned, setOwned] = useState<{ owner: string; info: AiContextInfo } | null>(null);
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Record<string, AiEntry[]>>({});
  const [unseen, setUnseen] = useState(0);

  const ctx = owned?.info ?? null;
  const ctxRef = useRef<AiContextInfo | null>(null);
  ctxRef.current = ctx;
  const openRef = useRef(open);
  openRef.current = open;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const idRef = useRef(0);
  const cancelled = useRef(new Set<number>());

  useEffect(() => {
    let active = true;
    fetchAiAvailability().then(v => active && setAvailable(v));
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback((owner: string, info: AiContextInfo) => setOwned({ owner, info }), []);
  const unregister = useCallback((owner: string) => setOwned(prev => (prev?.owner === owner ? null : prev)), []);

  const patchEntry = useCallback((key: string, id: number, patch: Partial<AiEntry>) => {
    setThreads(prev => ({ ...prev, [key]: (prev[key] ?? []).map(e => (e.id === id ? { ...e, ...patch } : e)) }));
  }, []);

  const run = useCallback(
    (key: string, id: number, c: AiContextInfo, question: string | null) => {
      analyzeTrendWithGemini(c.variable, c.region, c.stats, c.comparisonRegion, c.comparisonStats, question ?? undefined)
        .then(response => {
          if (cancelled.current.has(id)) return;
          patchEntry(key, id, { status: 'done', response, error: undefined });
          if (!openRef.current) setUnseen(n => n + 1);
        })
        .catch(err => {
          if (cancelled.current.has(id)) return;
          const message = err instanceof Error ? err.message : 'The AI assistant is unavailable.';
          patchEntry(key, id, { status: 'error', error: message });
          if (!openRef.current) setUnseen(n => n + 1);
        });
    },
    [patchEntry]
  );

  const openPanel = useCallback(() => {
    setOpen(true);
    setUnseen(0);
  }, []);
  const closePanel = useCallback(() => setOpen(false), []);

  const ask = useCallback(
    (question?: string) => {
      const c = ctxRef.current;
      openPanel();
      if (!c || available === false) return;
      const key = contextKey(c);
      if ((threadsRef.current[key] ?? []).some(e => e.status === 'loading')) return; // one request at a time
      const id = ++idRef.current;
      const q = question?.trim() || null;
      setThreads(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { id, question: q, status: 'loading' }] }));
      run(key, id, c, q);
    },
    [available, openPanel, run]
  );

  const cancel = useCallback(
    (id: number) => {
      const c = ctxRef.current;
      if (!c) return;
      cancelled.current.add(id);
      patchEntry(contextKey(c), id, { status: 'cancelled' });
    },
    [patchEntry]
  );

  const retry = useCallback(
    (id: number) => {
      const c = ctxRef.current;
      if (!c) return;
      const key = contextKey(c);
      const entry = (threadsRef.current[key] ?? []).find(e => e.id === id);
      if (!entry || (threadsRef.current[key] ?? []).some(e => e.status === 'loading')) return;
      cancelled.current.delete(id);
      patchEntry(key, id, { status: 'loading', error: undefined });
      run(key, id, c, entry.question);
    },
    [patchEntry, run]
  );

  const clear = useCallback(() => {
    const c = ctxRef.current;
    if (!c) return;
    const key = contextKey(c);
    (threadsRef.current[key] ?? []).forEach(e => cancelled.current.add(e.id));
    setThreads(prev => ({ ...prev, [key]: [] }));
  }, []);

  const entries = ctx ? threads[contextKey(ctx)] ?? [] : [];
  const busy = entries.some(e => e.status === 'loading');

  const api = useMemo<AiAssistantApi>(
    () => ({ ctx, available, open, suspended, entries, busy, unseen, openPanel, closePanel, ask, cancel, retry, clear }),
    [ctx, available, open, suspended, entries, busy, unseen, openPanel, closePanel, ask, cancel, retry, clear]
  );
  const registerApi = useMemo(() => ({ register, unregister, setSuspended }), [register, unregister]);

  return (
    <Register.Provider value={registerApi}>
      <Ctx.Provider value={api}>{children}</Ctx.Provider>
    </Register.Provider>
  );
};

export function useAiAssistant(): AiAssistantApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAiAssistant must be used inside <AiAssistantProvider>');
  return v;
}

/**
 * Tell the assistant what this screen is showing. Pass a memoised object (or null when there is nothing to explain yet).
 * Each owner only ever clears its own registration, so screens can come and go without fighting.
 */
export function useRegisterAiContext(owner: string, info: AiContextInfo | null): void {
  const reg = useContext(Register);
  useEffect(() => {
    if (!reg || !info) return;
    reg.register(owner, info);
    return () => reg.unregister(owner);
  }, [reg, owner, info]);
}

/** Hide the assistant (launcher and panel) while another overlay, such as the guided demo, is on screen. */
export function useSuspendAiAssistant(suspended: boolean): void {
  const reg = useContext(Register);
  useEffect(() => {
    reg?.setSuspended(suspended);
    return () => reg?.setSuspended(false);
  }, [reg, suspended]);
}
