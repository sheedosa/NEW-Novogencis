import React, { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo: React.FC<LogoProps> = React.memo(({ size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);
  
  // Updated to a more reliable Google Drive image serving endpoint
  // ID extracted from: 1B6HV1f06_qb78MsilSwpN-l1-LpwHB2k
  const logoSrc = "https://lh3.googleusercontent.com/d/1B6HV1f06_qb78MsilSwpN-l1-LpwHB2k";

  const heights = {
    sm: 'h-14 md:h-16',
    md: 'h-24 md:h-32',
    lg: 'h-32 md:h-48 lg:h-56'
  }[size];

  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      {!hasError ? (
        <img 
          src={logoSrc} 
          alt="Novogenics Logo" 
          className={`${heights} w-auto object-contain transition-all duration-500`}
          draggable={false}
          onError={() => setHasError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        // Fallback in case image still fails to load
        <div className="flex flex-col items-center">
          <h2 className="font-serif text-2xl md:text-3xl text-brand-green uppercase">Novogenics</h2>
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Dr Aminah Amer</p>
        </div>
      )}
    </div>
  );
});

export default Logo;