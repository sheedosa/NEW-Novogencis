import React, { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { AdminTab } from './context';
import {
  User, PlusCircle, Send, StickyNote, RefreshCw, CheckCircle, AlertCircle,
  LayoutDashboard, ClipboardList, Database, CalendarDays, MessageCircle,
  Activity, FileText,
} from 'lucide-react';

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  space_dashboard:    LayoutDashboard,
  assignment:         ClipboardList,
  database:           Database,
  calendar_month:     CalendarDays,
  health_and_safety:  Activity,
  forum:              MessageCircle,
  description:        FileText,
};

// ── StatusBadge ────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'New': 'bg-red-500 text-white',
    'Reviewed': 'bg-yellow-500 text-white',
    'Contacted': 'bg-blue-500 text-white',
    'Converted': 'bg-green-500 text-white',
    'Not Suitable': 'bg-gray-500 text-white',
    'Active': 'bg-green-100 text-green-700',
    'Ongoing': 'bg-primary text-white',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-2xs font-medium text-hint ${colors[status] || 'bg-gray-200 text-muted'}`}>
      {status}
    </span>
  );
};

// ── AssignedBadge ──────────────────────────────────────────────────────────
export const AssignedBadge = ({ isAssigned }: { isAssigned: boolean }) => {
  if (!isAssigned) return null;
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[8px] font-medium uppercase shrink-0">
      <User size={10} />
      Assigned
    </span>
  );
};

// ── SidebarItem ────────────────────────────────────────────────────────────
export const SidebarItem = ({
  id, label, icon, activeTab, selectedClientId, onClick, isCollapsed, count,
}: {
  id: AdminTab;
  label: string;
  icon: string;
  activeTab: AdminTab;
  selectedClientId: string | null;
  onClick: (id: AdminTab) => void;
  isCollapsed?: boolean;
  count?: number;
}) => {
  const isActive = activeTab === id && !selectedClientId;
  const Icon = NAV_ICONS[icon] || LayoutDashboard;
  return (
    <button
      onClick={() => onClick(id)}
      className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={16} className={`nav-icon ${isActive ? 'text-clinical' : 'text-muted'}`} />
      {!isCollapsed && <span>{label}</span>}
      {!isCollapsed && typeof count === 'number' && count > 0 && (
        <span className="nav-badge">{count}</span>
      )}
    </button>
  );
};

// ── MessageInputForm ───────────────────────────────────────────────────────
export const MessageInputForm = ({
  onSend,
  placeholder = 'Type a message...',
  showQuickActionsBtn = false,
  showQuickActions = false,
  onToggleQuickActions,
}: {
  onSend: (message: string) => void;
  placeholder?: string;
  showQuickActionsBtn?: boolean;
  showQuickActions?: boolean;
  onToggleQuickActions?: () => void;
}) => {
  const [input, setInput] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (input.trim()) { onSend(input); setInput(''); } }}
      className="flex gap-2 md:gap-4 w-full items-center"
    >
      {showQuickActionsBtn && onToggleQuickActions && (
        <button
          type="button"
          onClick={onToggleQuickActions}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all shrink-0 ${showQuickActions ? 'bg-primary text-clinical-dark' : 'bg-cream text-muted hover:text-primary'}`}
        >
          <PlusCircle size={18} />
        </button>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="flex-grow bg-cream border-transparent rounded-xl px-4 md:px-6 py-2.5 md:py-4 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all min-w-0"
      />
      <button
        type="submit"
        disabled={!input.trim()}
        className="w-10 h-10 md:w-12 md:h-12 bg-primary text-white md:text-clinical-dark rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center disabled:opacity-50 disabled:scale-100 md:shadow-lg md:shadow-primary/20"
      >
        <Send size={18} />
      </button>
    </form>
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
    <Card className="p-4 sm:p-6 md:p-8 mt-4 md:mt-8 bg-cream/30 border-dashed border-black/10">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <StickyNote size={20} className="text-primary" />
          <h3 className="text-[10px] md:text-xs font-medium uppercase text-muted">Internal Clinical Notes</h3>
        </div>
        <div className="flex items-center justify-end min-w-[80px]">
          {saveStatus === 'saving' && <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1"><RefreshCw size={14} className="animate-spin" /> Saving...</span>}
          {saveStatus === 'saved'  && <span className="text-[10px] font-bold text-green-500 flex items-center gap-1"><CheckCircle size={14} /> Saved</span>}
          {saveStatus === 'error'  && <span className="text-[10px] font-bold text-red-500 flex items-center gap-1"><AlertCircle size={14} /> Error</span>}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add private clinical notes about this client's progress, specific concerns, or internal reminders..."
        className="w-full bg-white border-black/5 rounded-xl p-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none shadow-sm"
      />
      <div className="flex justify-end mt-4">
        <button
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
          className="bg-obsidian text-white px-6 py-2 rounded-full text-2xs font-medium text-hint hover:bg-primary transition-colors shadow-lg shadow-clinical-dark/10"
        >
          Force Save
        </button>
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
    <div className="space-y-4">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Enter clinical feedback that will be visible to the client. On first save the client receives an in-portal notification and an email."
        className="w-full bg-white/5 border-white/10 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 min-h-[200px] resize-none text-white placeholder:text-gray-500"
      />
      <button
        onClick={handleSubmit}
        disabled={status === 'saving' || isUnchanged || !feedback.trim()}
        className="w-full bg-primary text-clinical-dark px-6 py-3 rounded-xl text-2xs font-medium text-hint hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
      >
        {status === 'saving' && (<><RefreshCw size={16} className="animate-spin" /> Saving…</>)}
        {status === 'saved'  && (<><CheckCircle size={16} /> Saved &amp; Client Notified</>)}
        {status === 'error'  && (<><AlertCircle size={16} /> Failed — Retry</>)}
        {status === 'idle'   && (<><Send size={16} /> {initialFeedback ? 'Update Feedback' : 'Submit Feedback'}</>)}
      </button>
    </div>
  );
};
