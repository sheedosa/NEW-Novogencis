import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui';
import { Button, StatusBadge } from '../../components/ui';
import { User as UserIcon, PlusCircle, Send, StickyNote, RefreshCw, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getApp } from 'firebase/app';

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
// Lazily-created functions instance, scoped to europe-west2 to match deploy.
let functionsInstance: ReturnType<typeof getFunctions> | null = null;
function getRegionalFunctions() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getApp(), 'europe-west2');
  }
  return functionsInstance;
}

interface AIDraftContext {
  clientId: string;
  threadMessages: Array<{ senderId: string; body: string; createdAt: string }>;
}

export const MessageInputForm = ({
  onSend,
  placeholder = 'Type a message…',
  showQuickActionsBtn = false,
  showQuickActions = false,
  onToggleQuickActions,
  aiDraftContext,
}: {
  onSend: (message: string) => void;
  placeholder?: string;
  showQuickActionsBtn?: boolean;
  showQuickActions?: boolean;
  onToggleQuickActions?: () => void;
  /** When provided, shows a "Draft with AI" button that calls the Cloud Function. */
  aiDraftContext?: AIDraftContext;
}) => {
  const [input, setInput] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const handleAiDraft = async () => {
    if (!aiDraftContext) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const fns = getRegionalFunctions();
      const draftReply = httpsCallable<AIDraftContext, { draft: string }>(fns, 'draftReply');
      const result = await draftReply(aiDraftContext);
      setInput(result.data.draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Draft failed';
      setDraftError(msg);
      setTimeout(() => setDraftError(null), 4000);
    } finally {
      setDrafting(false);
    }
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
        {aiDraftContext && aiDraftContext.threadMessages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAiDraft}
            disabled={drafting}
            loading={drafting}
            aria-label="Draft reply with AI"
            title="Draft a reply with AI based on the conversation"
          >
            <Sparkles size={14} className="text-primary" />
          </Button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={drafting ? 'Drafting…' : placeholder}
          className="flex-grow"
          disabled={drafting}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!input.trim() || drafting}
          aria-label="Send"
        >
          <Send size={14} />
        </Button>
      </form>
      {draftError && (
        <p className="text-xs text-danger mt-1.5">{draftError}</p>
      )}
    </div>
  );
};

// ── InternalNotesEditor ────────────────────────────────────────────────────
export const InternalNotesEditor = ({
  initialNotes,
  onSave,
}: {
  initialNotes: string;
  onSave: (notes: string) => Promise<void>;
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => { setNotes(initialNotes); setSaveStatus('idle'); }, [initialNotes]);

  useEffect(() => {
    if (notes === initialNotes) return;
    setSaveStatus('idle');
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await onSave(notes);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [notes, initialNotes, onSave]);

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote size={15} className="text-muted" />
          <h3 className="text-sm font-medium text-obsidian">Internal clinical notes</h3>
        </div>
        <div className="flex items-center justify-end min-w-[80px]">
          {saveStatus === 'saving' && <span className="text-xs text-muted flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={12} /> Saved</span>}
          {saveStatus === 'error'  && <span className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12} /> Error</span>}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add private clinical notes about this client's progress, specific concerns, or internal reminders…"
        className="min-h-[120px] resize-none"
      />
      <div className="flex justify-end mt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            setSaveStatus('saving');
            try {
              await onSave(notes);
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 3000);
            } catch {
              setSaveStatus('error');
            }
          }}
        >
          Save now
        </Button>
      </div>
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
        className="min-h-[200px] resize-none bg-white/5 !text-white !border-white/15 placeholder:text-white/40"
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
