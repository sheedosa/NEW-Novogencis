import React from 'react';
import { ArrowDown, ArrowUp, ArrowRight } from 'lucide-react';

type Accent = 'default' | 'gold' | 'sage' | 'info' | 'danger' | 'warning';

interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Smaller supporting line below the value (e.g. "3 of 11") */
  hint?: React.ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon?: React.ReactNode;
  /** Coloured stripe on the left edge to categorise the metric */
  accent?: Accent;
  onClick?: () => void;
  className?: string;
}

const ACCENT_STRIPE: Record<Accent, string> = {
  default: 'before:bg-sand/0',
  gold:    'before:bg-primary',
  sage:    'before:bg-success',
  info:    'before:bg-info',
  danger:  'before:bg-danger',
  warning: 'before:bg-warning',
};

const ACCENT_ICON_BG: Record<Accent, string> = {
  default: 'bg-cream text-muted',
  gold:    'bg-primary/10 text-primary',
  sage:    'bg-success-light text-success-text',
  info:    'bg-info-light text-info-text',
  danger:  'bg-danger-bg text-danger-text',
  warning: 'bg-warning-bg text-warning-text',
};

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  hint,
  delta,
  icon,
  accent = 'default',
  onClick,
  className = '',
}) => {
  const Wrapper = (onClick ? 'button' : 'div') as keyof React.JSX.IntrinsicElements;
  const interactiveClass = onClick
    ? 'text-left hover:border-obsidian/10 hover:shadow-card cursor-pointer'
    : '';

  // Relative positioning + pseudo-element gives us the left accent stripe
  // without an extra DOM element.
  const stripeBase = accent !== 'default'
    ? 'relative before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-full pl-3.5'
    : '';

  return (
    <Wrapper
      onClick={onClick}
      className={`stat-card transition-all flex items-start justify-between gap-3 ${stripeBase} ${ACCENT_STRIPE[accent]} ${interactiveClass} ${className}`}
    >
      <div className="min-w-0 flex-grow">
        <div className="stat-label">{label}</div>
        <div className="stat-value mt-1">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
        {delta && (
          <div className={`stat-delta-pill stat-delta-${delta.direction}`}>
            {delta.direction === 'up' && <ArrowUp size={11} />}
            {delta.direction === 'down' && <ArrowDown size={11} />}
            {delta.direction === 'neutral' && <ArrowRight size={11} />}
            <span>{delta.value}</span>
          </div>
        )}
      </div>
      {icon && (
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${ACCENT_ICON_BG[accent]}`}>
          {icon}
        </div>
      )}
    </Wrapper>
  );
};

export default Stat;
