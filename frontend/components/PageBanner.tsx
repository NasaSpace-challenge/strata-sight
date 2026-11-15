import React from 'react';

export type BannerVariant = 'blue' | 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose';

const VARIANT_CLASS: Record<BannerVariant, string> = {
  blue: '',
  sky: 'ep-banner--sky',
  indigo: 'ep-banner--indigo',
  violet: 'ep-banner--violet',
  emerald: 'ep-banner--emerald',
  amber: 'ep-banner--amber',
  rose: 'ep-banner--rose'
};

const ICON_TINT: Record<BannerVariant, string> = {
  blue: 'text-blue-700',
  sky: 'text-sky-700',
  indigo: 'text-indigo-700',
  violet: 'text-violet-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700'
};

/** Class string for an existing wrapper that should look like a page banner. */
export const bannerClass = (variant: BannerVariant) => `ep-banner ${VARIANT_CLASS[variant]} border ring-1 ring-inset ring-white/80 shadow-card`;

interface PageBannerProps {
  variant: BannerVariant;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  /** Plain part of the title */
  title: string;
  /** Last words of the title, drawn with the page's gradient */
  accent?: string;
  subtitle?: string;
  /** Right-hand slot (status, actions) */
  children?: React.ReactNode;
}

/** Full-width page header: the Start hero's soft gradient, tinted per page. */
export const PageBanner: React.FC<PageBannerProps> = ({ variant, icon: Icon, kicker, title, accent, subtitle, children }) => (
  <section className={`${bannerClass(variant)} rounded-2xl p-5 sm:p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4`} aria-label={`${title} ${accent ?? ''}`.trim()}>
    <div className="flex items-start gap-4 min-w-0">
      <span className={`hidden sm:flex flex-shrink-0 w-12 h-12 rounded-2xl bg-white/85 ring-1 ring-white shadow-sm items-center justify-center ${ICON_TINT[variant]}`}>
        <Icon className="w-6 h-6" />
      </span>
      <div className="min-w-0">
        <div className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${ICON_TINT[variant]}`}>{kicker}</div>
        <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {title}
          {accent && (
            <>
              {' '}
              <span className="ep-banner-accent">{accent}</span>
            </>
          )}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-700 max-w-3xl leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {children && <div className="flex-shrink-0">{children}</div>}
  </section>
);
