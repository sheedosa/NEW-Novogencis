import React from 'react';

type Tone = 'default' | 'dark' | 'subtle' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padded?: boolean;
  /** Optional left accent stripe — useful for categorising sections */
  accent?: 'gold' | 'sage' | 'info' | 'danger' | 'warning';
}

const toneClass: Record<Tone, string> = {
  default: 'card',
  dark: 'card-dark',
  subtle: 'card',
  elevated: 'card card-elevated',
};

const accentStripe: Record<NonNullable<CardProps['accent']>, string> = {
  gold:    'before:bg-primary',
  sage:    'before:bg-success',
  info:    'before:bg-info',
  danger:  'before:bg-danger',
  warning: 'before:bg-warning',
};

export const Card: React.FC<CardProps> = ({
  tone = 'default',
  padded = true,
  accent,
  className = '',
  children,
  ...rest
}) => (
  <div
    className={`${toneClass[tone]} ${padded ? '' : '!p-0'} ${tone === 'subtle' ? 'bg-cream/60' : ''} ${
      accent ? `relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${accentStripe[accent]}` : ''
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  leadingIcon,
  trailing,
  className = '',
  ...rest
}) => (
  <div className={`flex items-center justify-between gap-3 mb-3 ${className}`} {...rest}>
    <div className="flex items-center gap-2.5 min-w-0">
      {leadingIcon && <span className="text-muted shrink-0">{leadingIcon}</span>}
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-obsidian truncate">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </div>
);

export default Card;
