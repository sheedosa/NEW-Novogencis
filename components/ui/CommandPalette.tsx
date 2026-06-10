import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowRight, Command } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  keywords?: string[];        // searchable extras (e.g. patient ID, email)
  icon?: React.ReactNode;
  hint?: string;              // right-side hint (e.g. shortcut key)
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

/**
 * Linear/Notion-style command palette. Triggered by Cmd+K / Ctrl+K.
 * Type to fuzzy-filter; ↑/↓ to move; Enter to run; Esc to close.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open, onClose, items, placeholder = 'Type a command or search…',
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Reset state on open; restore focus to wherever the user was on close
  // (e.g. mid-sentence in a notes textarea before hitting Cmd+K).
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setActive(0);
      // Focus a tick later so the input mounts first
      setTimeout(() => inputRef.current?.focus(), 30);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      const hay = [
        item.label,
        item.group,
        ...(item.keywords || []),
      ].filter(Boolean).join(' ').toLowerCase();
      // Tokenized match: all query tokens must appear
      return q.split(/\s+/).every(token => hay.includes(token));
    });
  }, [items, query]);

  // Group filtered results for display
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach(item => {
      const g = item.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    // Preserve original ordering of group names by first occurrence
    const seen: string[] = [];
    filtered.forEach(item => {
      const g = item.group || 'Other';
      if (!seen.includes(g)) seen.push(g);
    });
    return seen.map(g => ({ name: g, items: groups[g] }));
  }, [filtered]);

  // Reset active index when filter changes
  useEffect(() => { setActive(0); }, [query]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, active, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-obsidian/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[60vh]"
          >
            {/* Input row */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-sand">
              <Search size={16} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-grow bg-transparent border-none focus:ring-0 text-sm text-obsidian placeholder:text-hint p-0"
                style={{ padding: '0', border: 'none', boxShadow: 'none' }}
              />
              <kbd className="hidden sm:inline-flex text-xs text-hint border border-sand rounded px-1.5 py-0.5">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1" data-scroll>
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No matches for "{query}".</p>
              ) : (
                grouped.map(group => (
                  <div key={group.name}>
                    <p className="px-3 pt-3 pb-1 text-xs text-hint">{group.name}</p>
                    {group.items.map((item) => {
                      const overallIndex = filtered.indexOf(item);
                      const isActive = overallIndex === active;
                      return (
                        <button
                          key={item.id}
                          onMouseEnter={() => setActive(overallIndex)}
                          onClick={() => { item.onSelect(); onClose(); }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                            isActive ? 'bg-cream' : 'hover:bg-cream/60'
                          }`}
                        >
                          {item.icon && (
                            <span className="text-muted shrink-0 w-4 h-4 inline-flex items-center justify-center">
                              {item.icon}
                            </span>
                          )}
                          <span className="text-sm text-obsidian flex-grow truncate">{item.label}</span>
                          {item.hint && (
                            <span className="text-xs text-hint shrink-0">{item.hint}</span>
                          )}
                          {isActive && (
                            <ArrowRight size={13} className="text-obsidian shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-sand bg-ivory flex items-center justify-between text-xs text-hint">
              <span className="inline-flex items-center gap-1">
                <kbd className="border border-sand rounded px-1">↑↓</kbd> Navigate
                <span className="ml-2"><kbd className="border border-sand rounded px-1">↵</kbd> Open</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Command size={11} /> K
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
