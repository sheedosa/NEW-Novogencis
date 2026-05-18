import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * A shimmering placeholder block. Use to indicate loading content shaped like
 * the real thing, so the page never looks empty during Firestore fetches.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'md',
}) => {
  const radius = rounded === 'full' ? 'rounded-full' : `rounded-${rounded}`;
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <span
      aria-hidden="true"
      className={`block bg-sand/70 ${radius} skeleton-shimmer ${className}`}
      style={style}
    />
  );
};

interface SkeletonRowProps {
  count?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Convenience: render N copies of children. Useful for stamping out skeleton
 * rows that all share the same internal layout.
 */
export const SkeletonRows: React.FC<SkeletonRowProps> = ({ count = 3, className = '', children }) => (
  <div className={`flex flex-col ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <React.Fragment key={i}>{children}</React.Fragment>
    ))}
  </div>
);

export default Skeleton;
