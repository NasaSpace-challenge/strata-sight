import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Compass,
  BarChart3,
  Split,
  Info,
  Layers,
  GitCompare,
  Map,
  Flame,
  Radio,
  Activity,
  ChevronDown,
  Menu,
  X,
  Waves,
  Check
} from 'lucide-react';

export type TabId =
  | 'detective'
  | 'explorer'
  | 'paradox'
  | 'map'
  | 'multiagency'
  | 'teleconnections'
  | 'compound'
  | 'heatwave'
  | 'spectral'
  | 'bivariate'
  | 'decomposition'
  | 'about';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: TabId) => void;
  onOpenQuickDemo: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Primary workflow: ask -> analyze -> compare -> locate -> cross-check. */
const PRIMARY: NavItem[] = [
  { id: 'detective', label: 'Start', hint: 'Ask a question, pick a place', icon: Compass },
  { id: 'explorer', label: 'Analyze', hint: 'Time series, trend & significance', icon: BarChart3 },
  { id: 'paradox', label: 'Compare', hint: 'Two regions side by side', icon: Split },
  { id: 'map', label: 'Map', hint: 'Where is it changing? Trend map', icon: Map },
  { id: 'multiagency', label: 'Water & SAR', hint: 'SWOT, Canadian gauges, CSA RCM', icon: Radio }
];

const ADVANCED: NavItem[] = [
  { id: 'teleconnections', label: 'Teleconnections', hint: 'ENSO, NAO, PDO influence on your series', icon: Waves },
  { id: 'bivariate', label: 'Lead–lag correlation', hint: 'Does one variable lead another?', icon: GitCompare },
  { id: 'decomposition', label: 'Trend / season / noise', hint: 'Separate the signal components', icon: Layers },
  { id: 'heatwave', label: 'Extreme months', hint: 'Months above the 90th percentile', icon: Flame },
  { id: 'compound', label: 'Compound hot + dry', hint: 'Heat and drought at once', icon: Flame },
  { id: 'spectral', label: 'Cycles (spectral)', hint: 'Periodicities in the record', icon: Activity }
];

const ABOUT: NavItem = { id: 'about', label: 'Methods', hint: 'Statistics, data sources, limits', icon: Info };

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenQuickDemo }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const advRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (advRef.current && !advRef.current.contains(e.target as Node)) setAdvancedOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAdvancedOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (id: TabId) => {
    setActiveTab(id);
    setAdvancedOpen(false);
    setMobileOpen(false);
  };

  const advancedActive = ADVANCED.some(a => a.id === activeTab);

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
      <div className="ep-container">
        <div className="flex items-center justify-between h-16 gap-3">
          <button
            onClick={() => go('detective')}
            className="flex items-center gap-2.5 group flex-shrink-0"
            aria-label="StrataSight home"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white ring-1 ring-slate-200 shadow-sm transition-transform group-hover:scale-105">
              <img src="/brand/stratasight-icon.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            </span>
            <span className="text-left">
              <span className="block font-extrabold text-lg tracking-tight text-slate-900 leading-none">
                Strata
                <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-[CanvasText]">Sight</span>
              </span>
              <span className="block text-[10px] text-slate-500 mt-0.5 hidden sm:block">What is changing, where, and is it real?</span>
            </span>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
            {PRIMARY.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  title={item.hint}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  className={tabClass(activeTab === item.id)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}

            <div className="relative" ref={advRef}>
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={advancedOpen}
                className={tabClass(advancedActive)}
              >
                Advanced
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50"
                >
                  {ADVANCED.map(item => {
                    const Icon = item.icon;
                    const sel = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => go(item.id)}
                        className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors ${
                          sel ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 ${sel ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                          <span className="block text-xs text-slate-500">{item.hint}</span>
                        </span>
                        {sel && <Check className="w-4 h-4 text-blue-600 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => go(ABOUT.id)}
              title={ABOUT.hint}
              aria-current={activeTab === 'about' ? 'page' : undefined}
              className={tabClass(activeTab === 'about')}
            >
              <Info className="w-4 h-4" />
              {ABOUT.label}
            </button>
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onOpenQuickDemo}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Guided demo</span>
              <span className="sm:hidden">Demo</span>
            </button>
            <button
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-slate-200 bg-white max-h-[75vh] overflow-y-auto px-3 py-3 space-y-1" aria-label="Mobile">
          {[...PRIMARY, ...ADVANCED, ABOUT].map(item => {
            const Icon = item.icon;
            const sel = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left ${
                  sel ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${sel ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
