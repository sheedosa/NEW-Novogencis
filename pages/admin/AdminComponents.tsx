import React, { useState, useRef, useEffect } from 'react';
import { AdminTab } from './context';

/* ─────────────────────────────────────────────────────────────
   StatusBadge
   Renders a coloured pill for client / appointment status.
───────────────────────────────────────────────────────────── */
export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    // Assessment states
    'New':               'badge-new',
    'Reviewed':          'badge-pending',
    'Contacted':         'badge-review',
    'Converted':         'badge-active',
    'Not Suitable':      'badge-inactive',
    // Client states
    'Active':            'badge-active',
    'Ongoing':           'badge-active',
    'Inactive':          'badge-inactive',
    'Assessment Submitted': 'badge-new',
    // Appointment states
    'Confirmed':         'badge-active',
    'Completed':         'badge-inactive',
    'Cancelled':         'badge-danger',
    'Pending':           'badge-pending',
    'Prep Required':     'badge-pending',
    // Payment states
    'Paid':              'badge-active',
    'Awaiting':          'badge-pending',
    'Overdue':           'badge-danger',
  };
  return (
    <span className={`badge ${map[status] ?? 'badge-inactive'}`}>
      {status}
    </span>
  );
};


/* ─────────────────────────────────────────────────────────────
   AssignedBadge
───────────────────────────────────────────────────────────── */
export const AssignedBadge = ({ isAssigned }: { isAssigned: boolean }) => {
  if (!isAssigned) return null;
  return (
    <span className="badge badge-review text-2xs">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Mine
    </span>
  );
};


/* ─────────────────────────────────────────────────────────────
   AIChip — marks any AI-generated content
───────────────────────────────────────────────────────────── */
export const AIChip = ({ label = 'AI-generated' }: { label?: string }) => (
  <span className="ai-chip">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    {label}
  </span>
);


/* ─────────────────────────────────────────────────────────────
   SidebarItem
   Accepts a React node icon (Lucide component).
───────────────────────────────────────────────────────────── */
interface SidebarItemProps {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  activeTab: AdminTab;
  selectedClientId: string | null;
  onClick: (id: AdminTab) => void;
  isCollapsed?: boolean;
  badge?: { value: number | string; variant: 'blue' | 'gold' | 'green' | 'amber' };
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  id,
  label,
  icon,
  activeTab,
  selectedClientId,
  onClick,
  isCollapsed = false,
  badge,
}) => {
  const isActive = activeTab === id && !selectedClientId;

  return (
    <button
      onClick={() => onClick(id)}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className={`nav-icon shrink-0 ${isActive ? 'text-primary' : 'text-hint'}`}
            style={{ display: 'flex', alignItems: 'center', width: 18, height: 18 }}>
        {icon}
      </span>

      {!isCollapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {badge && (
            <span className={`nav-badge nav-badge-${badge.variant}`}>
              {badge.value}
            </span>
          )}
        </>
      )}

      {isCollapsed && badge && (
        <span
          style={{
            position: 'absolute',
            top: 4, right: 4,
            width: 7, height: 7,
            borderRadius: '50%',
            background: badge.variant === 'gold' ? '#C9A86A' : '#2563EB',
          }}
        />
      )}
    </button>
  );
};


/* ─────────────────────────────────────────────────────────────
   MessageInputForm — used in admin messages panel
───────────────────────────────────────────────────────────── */
interface MessageInputFormProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showQuickActionsBtn?: boolean;
  showQuickActions?: boolean;
  onToggleQuickActions?: () => void;
}

export const MessageInputForm: React.FC<MessageInputFormProps> = ({
  onSend,
  placeholder = 'Type a message…',
  disabled = false,
  showQuickActionsBtn = false,
  showQuickActions = false,
  onToggleQuickActions,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      background: '#fff',
      border: '0.5px solid var(--color-sand)',
      borderRadius: 'var(--radius-lg)',
      padding: '8px 8px 8px 14px',
    }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: 0,
          fontSize: 13,
          fontFamily: 'inherit',
          color: 'var(--color-obsidian)',
          lineHeight: '1.5',
          maxHeight: 120,
          overflowY: 'auto',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="btn btn-primary btn-sm"
        style={{ borderRadius: 9, padding: '7px 13px', flexShrink: 0 }}
        aria-label="Send message"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
        </svg>
        Send
      </button>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   PageHeader — consistent title bar used inside portal panels
───────────────────────────────────────────────────────────── */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-obsidian)', margin: 0 }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--color-hint)', marginTop: 3, marginBottom: 0 }}>{subtitle}</p>
      )}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
  </div>
);


/* ─────────────────────────────────────────────────────────────
   EmptyState — consistent empty panel placeholder
───────────────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: 12,
  }}>
    {icon && (
      <div style={{
        width: 48, height: 48,
        borderRadius: 12,
        background: 'var(--color-cream)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-hint)',
        marginBottom: 4,
      }}>
        {icon}
      </div>
    )}
    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-obsidian)', margin: 0 }}>{title}</p>
    {description && (
      <p style={{ fontSize: 13, color: 'var(--color-hint)', margin: 0, maxWidth: 320 }}>{description}</p>
    )}
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </div>
);


/* ─────────────────────────────────────────────────────────────
   InternalNotesEditor — auto-saves internal clinical notes
───────────────────────────────────────────────────────────── */
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
    <div className="card mt-4 md:mt-8" style={{ borderStyle: 'dashed' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-hint)' }}>Internal Clinical Notes</span>
        <div style={{ fontSize: 11, color: saveStatus === 'saved' ? 'var(--color-success)' : saveStatus === 'error' ? 'var(--color-danger)' : 'var(--color-hint)' }}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved ✓'}
          {saveStatus === 'error' && 'Error — retry'}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add private clinical notes about this client's progress..."
        style={{ width: '100%', minHeight: 120, resize: 'vertical', border: '0.5px solid var(--color-sand)', borderRadius: 'var(--radius-md)', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-obsidian)', background: '#fff' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          onClick={async () => {
            setSaveStatus('saving');
            try { await onSave(notes); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000); }
            catch { setSaveStatus('error'); }
          }}
          className="btn btn-primary btn-sm"
        >
          Force Save
        </button>
      </div>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   FeedbackEditor — saves clinical feedback visible to client
───────────────────────────────────────────────────────────── */
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Enter clinical feedback visible to the client. On first save the client receives a portal notification."
        style={{ width: '100%', minHeight: 200, resize: 'vertical', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', padding: '9px 13px', fontSize: 13, fontFamily: 'inherit', color: '#fff', background: 'rgba(255,255,255,0.05)' }}
      />
      <button
        onClick={handleSubmit}
        disabled={status === 'saving' || feedback === initialFeedback || !feedback.trim()}
        className="btn btn-ai"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {status === 'saving' && 'Saving…'}
        {status === 'saved' && 'Saved & client notified ✓'}
        {status === 'error' && 'Failed — retry'}
        {status === 'idle' && (initialFeedback ? 'Update Feedback' : 'Submit Feedback')}
      </button>
    </div>
  );
};
