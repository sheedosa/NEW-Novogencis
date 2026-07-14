import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into `document.body` so fixed-position overlays escape any
 * transformed ancestor. Without this, an ancestor with a non-`none` transform
 * (e.g. our `.animate-fade-up` panels, whose `both` fill-mode permanently
 * retains `translateY(0)`) becomes the containing block for `position: fixed`,
 * which trapped modals inside the panel box — off-centre and below the fold.
 *
 * Mounts only after the first client render (guards SSR / no `document`).
 */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

export default Portal;
