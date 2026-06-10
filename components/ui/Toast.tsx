/**
 * Toast notification system — replaces native window.alert() across the app.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Photo uploaded');
 *   toast.error('Failed to send message');
 *   toast.info('Saved to drafts');
 *
 * Mount <ToastProvider> once at the App root.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

/** Optional inline action on a toast — e.g. "Undo" after marking a task done. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  action?: ToastAction;
}

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastApi {
  success: (title: string, opts?: ToastOptions) => void;
  error: (title: string, opts?: ToastOptions) => void;
  info: (title: string, opts?: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<{ toast: ToastApi } | null>(null);

export function useToast(): { toast: ToastApi } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so calling toast.* before provider mounts won't crash.
    const noop: (title: string, opts?: ToastOptions) => void = () => { /* no-op */ };
    const noopDismiss: (id: string) => void = () => { /* no-op */ };
    return { toast: { success: noop, error: noop, info: noop, dismiss: noopDismiss } };
  }
  return ctx;
}

/**
 * Module-level reference to the latest dispatch so non-React code (e.g. error
 * handlers, utility files) can call `notify.success(...)` without prop drilling.
 * Set inside the provider mount.
 */
let externalDispatch: ((tone: ToastTone, title: string, opts?: ToastOptions) => void) | null = null;

export const notify = {
  success: (title: string, opts?: ToastOptions) => externalDispatch?.('success', title, opts),
  error: (title: string, opts?: ToastOptions) => externalDispatch?.('error', title, opts),
  info: (title: string, opts?: ToastOptions) => externalDispatch?.('info', title, opts),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, title: string, opts?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = opts?.duration ?? (tone === 'error' ? 6000 : 4000);
    setItems((prev) => [...prev, { id, tone, title, description: opts?.description, duration, action: opts?.action }]);
  }, []);

  // Expose imperative dispatch globally for non-React callers
  useEffect(() => {
    externalDispatch = push;
    return () => { externalDispatch = null; };
  }, [push]);

  const api: ToastApi = React.useMemo(() => ({
    success: (title, opts) => push('success', title, opts),
    error: (title, opts) => push('error', title, opts),
    info: (title, opts) => push('info', title, opts),
    dismiss,
  }), [push, dismiss]);

  const value = React.useMemo(() => ({ toast: api }), [api]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

const ToastViewport: React.FC<{ items: ToastItem[]; onDismiss: (id: string) => void }> = ({ items, onDismiss }) => (
  <div
    className="fixed z-[200] inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:left-auto pointer-events-none flex flex-col gap-2 items-stretch sm:items-end"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    aria-live="polite"
    aria-atomic="true"
  >
    <AnimatePresence initial={false}>
      {items.map((t) => (
        <ToastBubble key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </AnimatePresence>
  </div>
);

const ToastBubble: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  const palette = item.tone === 'success'
    ? { bg: 'bg-white', border: 'border-emerald-200', icon: 'text-emerald-600', accent: 'bg-emerald-500' }
    : item.tone === 'error'
    ? { bg: 'bg-white', border: 'border-red-200', icon: 'text-red-600', accent: 'bg-red-500' }
    : { bg: 'bg-white', border: 'border-sand', icon: 'text-obsidian', accent: 'bg-obsidian' };

  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;

  return (
    <motion.div
      role={item.tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-auto ${palette.bg} ${palette.border} border rounded-lg shadow-modal max-w-md w-full sm:w-[360px] overflow-hidden relative`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${palette.accent}`} />
      <div className="flex items-start gap-3 px-4 py-3 pl-5">
        <span className={`shrink-0 mt-0.5 ${palette.icon}`}>
          <Icon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-obsidian">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
          )}
        </div>
        {item.action && (
          <button
            onClick={() => { item.action!.onClick(); onDismiss(item.id); }}
            className="shrink-0 px-3 py-1 text-xs font-medium text-obsidian bg-cream hover:bg-sand rounded-md transition-colors"
          >
            {item.action.label}
          </button>
        )}
        <button
          onClick={() => onDismiss(item.id)}
          className="shrink-0 -mr-1 -mt-1 w-9 h-9 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md"
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
};
