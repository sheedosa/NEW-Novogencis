import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Renders the item in the danger colour (destructive actions). */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * One consistent "⋯" overflow menu for row-level Edit / Cancel / Delete actions.
 * Replaces the scattered 12px trash/ban icons so every "act on this row" control
 * looks and behaves the same across the platform. Closes on outside-click + Escape;
 * items are real <button>s for keyboard access.
 */
export const RowActions: React.FC<{
  actions: RowAction[];
  align?: 'left' | 'right';
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
}> = ({ actions, align = 'right', label = 'Actions', className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="btn-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[176px] rounded-lg border border-sand bg-white shadow-panel py-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              disabled={a.disabled}
              onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                a.danger ? 'text-danger hover:bg-danger-bg' : 'text-obsidian hover:bg-cream'
              }`}
            >
              {a.icon && <span className="shrink-0 flex items-center">{a.icon}</span>}
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
