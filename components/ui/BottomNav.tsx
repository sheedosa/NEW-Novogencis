import React from 'react';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface BottomNavProps {
  items: BottomNavItem[];
  active: string;
  onChange: (id: string) => void;
}

/**
 * Mobile-only bottom tab bar. Use for the patient portal where the user lives
 * inside 3–4 surfaces. Pairs with the top header on desktop (this component
 * hides itself at lg breakpoint).
 */
export const BottomNav: React.FC<BottomNavProps> = ({ items, active, onChange }) => (
  <nav
    className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-sand flex items-stretch"
    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
  >
    {items.map(item => {
      const isActive = active === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors relative ${
            isActive ? 'text-obsidian' : 'text-muted'
          }`}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
        >
          {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-full" />}
          <span className="relative">
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 bg-danger rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </span>
          <span className="text-[10px]">{item.label}</span>
        </button>
      );
    })}
  </nav>
);

export default BottomNav;
