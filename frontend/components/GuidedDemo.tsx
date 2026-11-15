import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export interface DemoStep {
  title: string;
  body: string;
  /** What to look at on the screen right now. */
  lookFor: string;
  /** Moves the app to the right place for this step. */
  run: () => void;
}

interface GuidedDemoProps {
  steps: DemoStep[];
  index: number;
  onGo: (index: number) => void;
  onExit: () => void;
}

/** Non-blocking coach panel that drives the real app through one complete investigation. */
export const GuidedDemo: React.FC<GuidedDemoProps> = ({ steps, index, onGo, onExit }) => {
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  if (!step) return null;
  return (
    <aside
      role="dialog"
      aria-label="Guided demo"
      aria-live="polite"
      className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] rounded-2xl bg-white text-slate-900 shadow-elevated border border-slate-200 border-t-4 border-t-blue-600 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-semibold">
            Guided demo • step {index + 1} of {steps.length}
          </div>
          <h2 className="mt-1 text-base font-bold leading-snug text-slate-900">{step.title}</h2>
        </div>
        <button onClick={onExit} aria-label="Exit demo" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.body}</p>
      <p className="mt-3 text-xs text-amber-900 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <strong>Look for:</strong> {step.lookFor}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onGo(index - 1)}
            disabled={index === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => (last ? onExit() : onGo(index + 1))}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            {last ? 'Finish' : 'Next'} {!last && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
