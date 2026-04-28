import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl md:rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);
