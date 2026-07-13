import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm lg:max-w-md',
  md: 'sm:max-w-md lg:max-w-lg',
  lg: 'sm:max-w-lg lg:max-w-2xl',
  xl: 'sm:max-w-lg lg:max-w-4xl',
};

/**
 * Centered card on desktop, bottom sheet on mobile.
 * The mobile variant slides up from the bottom edge, rounded only at the top,
 * and grows up to 90% of the viewport height — the standard native pattern.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
}) => {
  // True bottom-sheet (slide-up + drag-to-dismiss) only on phones; from `sm` up
  // the modal is a centred card, so desktop/tablet get a scale-fade instead.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);

    // Lock body scroll while modal is open (no background scroll bleed-through on mobile)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-obsidian/55 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
          />
          <motion.div
            /* Mobile: slide up + drag-to-dismiss. Desktop/tablet: scale-fade. */
            initial={isMobile ? { y: '100%', opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { y: '100%', opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.8 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_e, info) => {
              // Deliberate pull required — a stray scroll gesture shouldn't dismiss
              if (info.offset.y > 160 || info.velocity.y > 800) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={`relative z-10 w-full ${sizeClass[size]} bg-white shadow-modal flex flex-col overflow-hidden
                        max-h-[92dvh] sm:max-h-[90vh]
                        rounded-t-xl sm:rounded-xl`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <span className="w-10 h-1 bg-sand rounded-full" />
            </div>

            {(title || subtitle) && (
              <div className="px-5 py-3 lg:py-4 border-b border-sand flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <h3 className="text-base font-medium text-obsidian truncate">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="btn-icon shrink-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 py-5 flex-1" data-scroll>
              {children}
            </div>
            {footer && (
              <div className="px-5 py-4 border-t border-sand bg-ivory shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
