import React from 'react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: React.ReactNode;
  collapsed?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  active = false,
  badge,
  collapsed = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}
    title={collapsed ? label : undefined}
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
