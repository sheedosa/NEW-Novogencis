/**
 * ConfirmDialog — drop-in replacement for window.confirm().
 *
 * Usage:
 *   const { confirm, ConfirmHost } = useConfirm();
 *
 *   // Inside JSX, mount once near the root of the component:
 *   {ConfirmHost}
 *
 *   // To prompt:
 *   const ok = await confirm({
 *     title: 'Delete appointment?',
 *     description: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     tone: 'danger',
 *   });
 *   if (ok) { ... }
 */

import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Portal } from './Portal';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleResolve = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const ConfirmHost = (
    <Portal>
      <AnimatePresence>
        {pending && (
          <ConfirmModal
            options={pending}
            onCancel={() => handleResolve(false)}
            onConfirm={() => handleResolve(true)}
          />
        )}
      </AnimatePresence>
    </Portal>
  );

  return { confirm, ConfirmHost };
}

const ConfirmModal: React.FC<{
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ options, onCancel, onConfirm }) => {
  // Trap Escape + restore focus on close
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    initialFocusRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [onCancel]);

  const isDanger = options.tone === 'danger';

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={options.description ? 'confirm-desc' : undefined}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-obsidian/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-xl shadow-modal w-full sm:max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            {isDanger && (
              <span className="shrink-0 w-10 h-10 rounded-full bg-red-50 text-red-600 inline-flex items-center justify-center">
                <AlertTriangle size={18} />
              </span>
            )}
            <div className="flex-1">
              <h2 id="confirm-title" className="text-base font-medium text-obsidian">
                {options.title}
              </h2>
              {options.description && (
                <p id="confirm-desc" className="text-sm text-muted mt-1.5 leading-relaxed">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 bg-cream/40 border-t border-sand flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <button
            ref={initialFocusRef}
            onClick={onConfirm}
            className={
              isDanger
                ? 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors'
                : 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-obsidian text-white hover:opacity-90 transition-opacity'
            }
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
