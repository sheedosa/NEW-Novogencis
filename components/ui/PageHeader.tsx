import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Tiny uppercase label above the title — e.g. "Today", "Clinical" */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-4 pb-1 ${className}`}>
    <div className="min-w-0">
      {eyebrow && (
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary mb-1">
          {eyebrow}
        </div>
      )}
      <h1 className="text-[22px] md:text-[26px] font-medium text-obsidian leading-tight tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs md:text-sm text-muted mt-1 leading-relaxed">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
  </div>
);

export default PageHeader;
