import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui';
import { Button, StatusBadge } from '../../components/ui';
import { User as UserIcon, PlusCircle, Send, StickyNote, RefreshCw, CheckCircle, AlertCircle, Clock, BookText } from 'lucide-react';
import { InternalNoteEntry, Template } from '../../types';

// Re-export StatusBadge for any legacy import sites that look here
export { StatusBadge };

// ── AssignedBadge ──────────────────────────────────────────────────────────
export const AssignedBadge = ({ isAssigned }: { isAssigned: boolean }) => {
  if (!isAssigned) return null;
  return (
    <span className="badge badge-active flex items-center gap-1">
      <UserIcon size={11} />
      Assigned
    </span>
  );
};

// ── MessageInputForm ───────────────────────────────────────────────────────
export const MessageInputForm = ({
  onSend,
  placeholder = 'Type a message…',
  showQuickActionsBtn = false,
  showQuickActions = false,
  onToggleQuickActions,
  templates,
}: {
  onSend: (message: string) => void;
  placeholder?: string;
  showQuickActionsBtn?: boolean;
  showQuickActions?: boolean;
  onToggleQuickActions?: () => void;
  /** Saved message templates — when present, an insert-template picker shows. */
  templates?: Template[];
}) => {
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const insertTemplate = (body: string) => {
    setInput(prev => (prev ? `${prev} ${body}` : body));
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) { onSend(input); setInput(''); } }}
        className="flex gap-2 w-full items-center"
      >
        {showQuickActionsBtn && onToggleQuickActions && (
          <Button
            type="button"
            variant={showQuickActions ? 'primary' : 'ghost'}
            size="sm"
            onClick={onToggleQuickActions}
            aria-label="Quick actions"
          >
            <PlusCircle size={14} />
          </Button>
        )}
        {templates && templates.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(s => !s)}
              aria-label="Insert template"
              title="Insert a saved message template"
            >
              <BookText size={14} />
            </Button>
            {showTemplates && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
                <div className="absolute left-0 bottom-full mb-2 w-64 max-h-60 overflow-y-auto bg-white rounded-lg shadow-panel border border-sand z-50 p-1.5 space-y-0.5">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => insertTemplate(t.body)}
                      className="w-full text-left px-3 py-2 hover:bg-cream rounded-md"
                    >
                      <p className="text-sm font-medium text-obsidian truncate">{t.title}</p>
                      <p className="text-xs text-muted truncate">{t.body}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-grow"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!input.trim()}
          aria-label="Send"
        >
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
};

// ── InternalNotesEditor ────────────────────────────────────────────────────
// Append-only log of timestamped clinical notes. Each saved entry becomes a
// permanent history item with author, date, and time. Notes are never
// overwritten — this is a clinical audit trail.

function formatNoteTimestamp(iso: string): { abs: string; rel: string } {
  const date = new Date(iso);
  const abs = date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const diff = Date.now() - date.getTime();
  const rel = diff < 60_000        ? 'Just now'
            : diff < 3_600_000     ? `${Math.floor(diff / 60_000)} min ago`
            : diff < 86_400_000    ? `${Math.floor(diff / 3_600_000)} hr ago`
            : diff < 604_800_000   ? `${Math.floor(diff / 86_400_000)} days ago`
                                   : abs;
  return { abs, rel };
}

interface InternalNotesEditorProps {
  /** Existing entries from Firestore (sorted newest first by caller, or we sort here). */
  entries?: InternalNoteEntry[];
  /** Legacy single-string note. If present and `entries` is empty, shown as one legacy item. */
  legacyNote?: string;
  /** Display name of the current admin (so we can label new entries). */
  authorName?: string;
  /** Firebase UID of the current admin. */
  authorId: string;
  /** Persist a new entry. The component handles ID + timestamps itself. */
  onAddEntry: (entry: InternalNoteEntry) => Promise<void>;
}

export const InternalNotesEditor: React.FC<InternalNotesEditorProps> = ({
  entries = [],
  legacyNote,
  authorName,
  authorId,
  onAddEntry,
}) => {
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    setStatus('saving');
    try {
      const newEntry: InternalNoteEntry = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        body,
        createdAt: new Date().toISOString(),
        authorId,
        authorName,
      };
      await onAddEntry(newEntry);
      setDraft('');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save note:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center gap-2"
          title="Visible only to clinic staff. Use this for clinical observations, concerns, and reminders. Entries are permanent and timestamped."
        >
          <StickyNote size={15} className="text-muted" />
          <h3 className="text-sm font-medium text-obsidian">Internal clinical notes</h3>
        </div>
        <div className="flex items-center justify-end min-w-[80px]">
          {status === 'saving' && <span className="text-xs text-muted flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Saving…</span>}
          {status === 'saved'  && <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={12} /> Saved</span>}
          {status === 'error'  && <span className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12} /> Failed</span>}
        </div>
      </div>

      {/* New-note composer */}
      <div className="flex flex-col gap-2 mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a clinical note — what was observed, decided, or planned. Entries are timestamped and cannot be edited."
          className="min-h-[80px] resize-none text-sm leading-relaxed"
          disabled={status === 'saving'}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-hint">
            {draft.trim().length > 0
              ? `Will save as ${authorName || 'you'} · ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Each entry is permanent and timestamped — write as you would in a clinical record.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!draft.trim() || status === 'saving'}
            loading={status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>

      {/* History */}
      {(sortedEntries.length > 0 || legacyNote) && (
        <div className="border-t border-sand pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-muted" />
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              History ({sortedEntries.length + (legacyNote ? 1 : 0)})
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {sortedEntries.map((entry) => {
              const { abs, rel } = formatNoteTimestamp(entry.createdAt);
              return (
                <div key={entry.id} className="border-l-2 border-sand pl-3 py-0.5">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-obsidian">
                      {entry.authorName || 'Clinician'}
                    </span>
                    <span className="text-xs text-hint" title={abs}>{rel}</span>
                  </div>
                  <p className="text-sm text-obsidian whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                  <p className="text-xs text-hint mt-1 font-mono">{abs}</p>
                </div>
              );
            })}

            {/* Legacy single-string note — shown as one entry with no timestamp.
                Pre-dates the timestamped log; preserved for clinical continuity. */}
            {legacyNote && (
              <div className="border-l-2 border-sand pl-3 py-0.5">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-obsidian">Earlier notes</span>
                  <span className="text-xs text-hint">Pre-log</span>
                </div>
                <p className="text-sm text-obsidian whitespace-pre-wrap leading-relaxed">{legacyNote}</p>
                <p className="text-xs text-hint mt-1 italic">Written before timestamped notes were introduced.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

// ── FeedbackEditor ─────────────────────────────────────────────────────────
export const FeedbackEditor = ({
  initialFeedback,
  onSave,
}: {
  initialFeedback: string;
  onSave: (feedback: string) => Promise<void>;
}) => {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => { setFeedback(initialFeedback); setStatus('idle'); }, [initialFeedback]);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    setStatus('saving');
    try {
      await onSave(feedback);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
    }
  };

  const isUnchanged = feedback === initialFeedback;
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Enter clinical feedback that will be visible to the client. On first save the client receives an in-portal notification and an email."
        className="min-h-[180px] resize-none text-sm leading-relaxed"
      />
      <Button
        variant="ai"
        fullWidth
        onClick={handleSubmit}
        disabled={status === 'saving' || isUnchanged || !feedback.trim()}
        loading={status === 'saving'}
        leadingIcon={status === 'saved' ? <CheckCircle size={14} /> : status === 'error' ? <AlertCircle size={14} /> : <Send size={14} />}
      >
        {status === 'saving' && 'Saving…'}
        {status === 'saved'  && 'Saved & client notified'}
        {status === 'error'  && 'Failed — retry'}
        {status === 'idle'   && (initialFeedback ? 'Update feedback' : 'Submit feedback')}
      </Button>
    </div>
  );
};
