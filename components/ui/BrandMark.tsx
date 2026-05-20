import React from 'react';

interface BrandMarkProps {
  /** When true, only the square mark is shown (collapsed sidebar) */
  collapsed?: boolean;
  /** Subtitle line under "Novogenics" — defaults to "Clinic OS" for admin */
  tagline?: string;
  className?: string;
}

/**
 * Compact brand mark used in the admin + client portal sidebar headers.
 * NOT used on the public website — that keeps its full image logo.
 *
 * Visual: 30x30 rounded obsidian square with a gold serif "N" in the centre
 * and a small gold dot in the top-right corner — the designer's signature.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  collapsed = false,
  tagline = 'Clinic OS',
  className = '',
}) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <div className="relative w-[30px] h-[30px] rounded-lg bg-obsidian text-primary flex items-center justify-center shrink-0">
      <span
        className="font-serif font-medium leading-none -mt-px"
        style={{ fontSize: 17 }}
      >
        N
      </span>
      <span
        className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-primary"
        aria-hidden
      />
    </div>
    {!collapsed && (
      <div className="flex flex-col leading-none">
        <span className="font-serif font-medium text-[16px] tracking-[-0.005em] leading-[1.1] text-obsidian">
          Novogenics
        </span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-hint mt-0.5">
          {tagline}
        </span>
      </div>
    )}
  </div>
);

export default BrandMark;
