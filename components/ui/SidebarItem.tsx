import React from 'react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  /** Optional one-line explanation shown as a native tooltip on hover. */
  hint?: string;
  active?: boolean;
  badge?: React.ReactNode;
  collapsed?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  hint,
  active = false,
  badge,
  collapsed = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}
    title={collapsed ? label : hint}
  >
    <span className="nav-icon inline-flex items-center justify-center w-4 h-4 shrink-0">
      {icon}
    </span>
    {!collapsed && (
      <>
        <span className="truncate">{label}</span>
        {badge !== undefined && badge !== null && badge !== 0 && (
          <span className="nav-badge nav-badge-gold">{badge}</span>
        )}
      </>
    )}
  </button>
);

export default SidebarItem;
