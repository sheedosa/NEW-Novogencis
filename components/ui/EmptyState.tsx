import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'} px-6 ${className}`}
  >
    {icon && (
      <div className="w-10 h-10 rounded-md bg-cream flex items-center justify-center text-hint mb-3">
        {icon}
      </div>
    )}
    <p className="text-sm font-medium text-obsidian">{title}</p>
    {description && (
      <p className="text-xs text-muted mt-1 max-w-sm">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
