import React from 'react';

type AvatarTone = 'default' | 'gold' | 'sage' | 'info' | 'terra' | 'indigo';
type AvatarSize = 'sm' | 'md' | 'lg' | number;

interface AvatarProps {
  /** Patient/user initials to render */
  initials: string;
  /** Tone — if omitted, derived deterministically from the id prop */
  tone?: AvatarTone;
  /** Used to derive a stable tone when `tone` isn't passed. Same id always → same tone. */
  id?: string;
  /** sm = 28, md = 36, lg = 44, or a custom number in px */
  size?: AvatarSize;
  className?: string;
}

const TONE_POOL: Exclude<AvatarTone, 'default'>[] = ['gold', 'sage', 'info', 'terra', 'indigo'];

/**
 * Deterministic tone selection from an id — patient YK always gets gold,
 * patient IP always gets info, etc. Stable across renders + sessions.
 */
export function getAvatarTone(id: string | undefined): AvatarTone {
  if (!id) return 'default';
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONE_POOL[hash % TONE_POOL.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  tone,
  id,
  size = 'md',
  className = '',
}) => {
  const resolvedTone = tone ?? getAvatarTone(id);
  const sizeClass = typeof size === 'string' ? `avatar-${size}` : '';
  const styleOverride = typeof size === 'number'
    ? { width: size, height: size, fontSize: Math.round(size * 0.36) }
    : undefined;

  const toneClass = resolvedTone === 'default' ? '' : `avatar-${resolvedTone}`;
  return (
    <span
      className={`avatar ${sizeClass} ${toneClass} ${className}`.trim()}
      style={styleOverride}
    >
      {initials}
    </span>
  );
};

export default Avatar;
