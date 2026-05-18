import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Legacy Card import shim. New code should use `components/ui/Card`.
 * Uses the `.card` CSS class from index.css so all surfaces share one elevation/radius system.
 */
export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`card ${className}`}>{children}</div>
);

export default Card;
