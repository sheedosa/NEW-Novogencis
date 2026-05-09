import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'dark' | 'ai' | 'cream';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

/**
 * Card — base surface component.
 *
 * variant="default" → white card with sand border (standard)
 * variant="dark"    → obsidian card (for AI panels, dark sections)
 * variant="ai"      → obsidian card with gold accent border-top
 * variant="cream"   → cream fill, no border (metric/stat use)
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  variant = 'default',
  padding = 'md',
  hover = false,
}) => {
  const base = 'rounded-lg transition-all duration-200';

  const variantStyles: Record<string, string> = {
    default: 'bg-white border border-sand',
    dark:    'bg-obsidian border-none',
    ai:      'bg-obsidian border-none border-t-2 border-t-primary',
    cream:   'bg-cream border-none',
  };

  const paddingStyles: Record<string, string> = {
    none: '',
    sm:   'p-3',
    md:   'p-4',
    lg:   'p-5',
  };

  const hoverStyle = hover
    ? 'cursor-pointer hover:border-primary/40 hover:shadow-card'
    : '';

  const clickStyle = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`${base} ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverStyle} ${clickStyle} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  );
};


/* ── Subcomponents ───────────────────────────────────────────── */

interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, action, className = '' }) => (
  <div className={`flex items-center justify-between mb-3 ${className}`}>
    <span className="text-sm font-medium text-obsidian">{title}</span>
    {action && <div className="text-xs text-primary font-medium cursor-pointer">{action}</div>}
  </div>
);


interface StatCardProps {
  value: string | number;
  label: string;
  delta?: string;
  deltaType?: 'up' | 'down' | 'ai' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  delta,
  deltaType = 'neutral',
  className = '',
}) => {
  const deltaColors: Record<string, string> = {
    up:      'text-success-DEFAULT',
    down:    'text-danger-DEFAULT',
    ai:      'text-primary',
    neutral: 'text-hint',
  };

  const deltaIcons: Record<string, string> = {
    up:      '↑',
    down:    '↓',
    ai:      '✦',
    neutral: '',
  };

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && (
        <div className={`stat-delta ${deltaType} ${deltaColors[deltaType]}`}>
          <span>{deltaIcons[deltaType]}</span>
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
};


/* ── AI content card ─────────────────────────────────────────── */
interface AICardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export const AICard: React.FC<AICardProps> = ({
  title = 'AI insight',
  children,
  className = '',
  footer,
}) => (
  <div className={`card-dark rounded-lg p-4 ${className}`}>
    <div className="flex items-center gap-2 mb-3">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4M19 17v4M3 5h4M17 19h4"/>
      </svg>
      <span className="text-2xs font-medium uppercase tracking-[0.08em] text-primary">{title}</span>
    </div>
    <div className="text-sm text-sand/90 leading-relaxed">{children}</div>
    {footer && (
      <div className="mt-3 pt-3 border-t border-white/10 text-2xs text-hint">
        {footer}
      </div>
    )}
  </div>
);


export default Card;
