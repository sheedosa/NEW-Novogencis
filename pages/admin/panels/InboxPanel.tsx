import React, { memo, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminContext } from '../context';
import { Task, Message } from '../../../types';
import {
  ClipboardList, MessageSquare, FileText, CreditCard, ListChecks,
  Plus, Check, X, Snowflake, ArrowRight, Inbox as InboxIcon,
  AlertTriangle, Trash2, CalendarClock, BookText,
} from 'lucide-react';
import {
  PageHeader, Card, Button, EmptyState, Modal, Input, Select, Textarea, Badge,
  Skeleton, useConfirm, useToast,
} from '../../../components/ui';
import { relativeTime } from '../../../utils/relativeTime';

type InboxFilter = 'all' | 'tasks' | 'assessments' | 'messages' | 'forms' | 'payments';

interface InboxItem {
  id: string;
  type: 'task' | 'assessment' | 'message' | 'form' | 'payment' | 'reschedule';
  title: string;
  subtitle: string;
  patientName?: string;
  patientId?: string;
  when: string;
  priority: 'high' | 'normal';
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  task?: Task;
  /** For message-type items: the original message ID for inline reply expansion. */
  messageId?: string;
}

const filterChips: { id: InboxFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all',          label: 'All',          icon: <InboxIcon size={13} /> },
  { id: 'tasks',        label: 'Tasks',        icon: <ListChecks size={13} /> },
  { id: 'assessments',  label: 'Assessments',  icon: <ClipboardList size={13} /> },
  { id: 'messages',     label: 'Messages',     icon: <MessageSquare size={13} /> },
  { id: 'forms',        label: 'Forms',        icon: <FileText size={13} /> },
  { id: 'payments',     label: 'Payments',     icon: <CreditCard size={13} /> },
];


function InboxPanel() {
  const {
    user,
    filteredClients,
    clients,
    messages,
    tasks,
    onAddTask,
    onUpdateTask,
    onDeleteTask,
    setSelectedClientId,
    setClientRecordTab,
    setActiveTab,
    handleSidebarClick,
    setTriageSelectedId,
  } = useAdminContext();

  const { confirm, ConfirmHost } = useConfirm();
  const { toast } = useToast();
  const { onSendMessage, onMarkMessageRead, appointments, onUpdateAppointment, templates } = useAdminContext();
  const messageTemplates = templates.filter(t => t.category === 'message');
  const [showReplyTemplates, setShowReplyTemplates] = useState(false);

  /** Parse "10:30 AM" into minutes since midnight (null if unparseable). */
  const parseTime12h = (t: string | undefined): number | null => {
    if (!t) return null;
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  };

  // ── Accept-reschedule modal state ─────────────────────────────────────────
  const [acceptingMsg, setAcceptingMsg] = useState<Message | null>(null);
  const [acceptForm, setAcceptForm] = useState({ date: '', time: '10:00 AM' });
  const [acceptSaving, setAcceptSaving] = useState(false);
  const acceptApt = acceptingMsg?.rescheduleRequest
    ? appointments.find(a => a.id === acceptingMsg.rescheduleRequest!.appointmentId) ?? null
    : null;
  // Live conflict check for the proposed new slot (same clinician, overlapping window).
  const acceptConflict = (() => {
    if (!acceptApt || !acceptForm.date || !acceptForm.time) return null;
    const start = parseTime12h(acceptForm.time);
    if (start === null) return null;
    const end = start + (acceptApt.durationMin ?? 30);
    for (const a of appointments) {
      if (a.id === acceptApt.id) continue;
      if (a.clinicianId !== acceptApt.clinicianId) continue;
      if (a.date !== acceptForm.date) continue;
      if (a.status === 'Cancelled' || a.status === 'No-Show') continue;
      const aStart = parseTime12h(a.time);
      if (aStart === null) continue;
      const aEnd = aStart + (a.durationMin ?? 30);
      if (start < aEnd && end > aStart) return a;
    }
    return null;
  })();

  const handleDeleteTask = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Delete this task?',
      description: `"${title}" will be permanently removed.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) await onDeleteTask(id);
  };

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [showNewTask, setShowNewTask] = useState(false);
  const [warmingUp, setWarmingUp] = useState(true);
  /** Which message item is expanded for inline reply (id of the InboxItem). */
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySending, setReplySending] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWarmingUp(false), 400);
    return () => clearTimeout(t);
  }, []);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    clientId: '',
    priority: 'normal' as 'normal' | 'high',
  });

  const items: InboxItem[] = useMemo(() => {
    const out: InboxItem[] = [];

    // Pending triage (assessments)
    filteredClients
      .filter(c => c.status === 'Assessment Submitted')
      .forEach(c => {
        out.push({
          id: `assessment-${c.id}`,
          type: 'assessment',
          title: `New assessment — ${c.name}`,
          subtitle: `${c.gender || 'patient'} · submitted ${c.createdAt ? relativeTime(c.createdAt) : 'recently'} ago`,
          patientName: c.name,
          patientId: c.id,
          when: c.createdAt || new Date().toISOString(),
          priority: 'high',
          primaryAction: {
            label: 'Review',
            onClick: () => {
              setTriageSelectedId(c.id);
              setSelectedClientId(c.id);
              handleSidebarClick('patients');
              setClientRecordTab('overview');
            },
          },
        });
      });

    // Unread messages from clients
    messages
      .filter(m => !m.read && m.recipientId === 'admin')
      .forEach(m => {
        const client = clients.find(c => c.id === m.senderId);
        const itemId = `message-${m.id}`;

        // Structured reschedule request — one-tap accept/decline instead of
        // parsing the free-text body. Older messages without the payload fall
        // through to the plain message branch below.
        if (m.rescheduleRequest) {
          const req = m.rescheduleRequest;
          const apt = appointments.find(a => a.id === req.appointmentId);
          out.push({
            id: itemId,
            type: 'reschedule',
            title: `Reschedule request — ${client?.name || 'client'}`,
            subtitle: apt
              ? `${apt.type} on ${new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → wants ${new Date(`${req.preferredDate}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} (${req.preferredTime.toLowerCase()})`
              : 'Original appointment no longer exists',
            patientName: client?.name,
            patientId: client?.id,
            when: m.createdAt,
            priority: 'high',
            messageId: m.id,
            primaryAction: {
              label: 'Accept',
              onClick: () => {
                if (!apt) {
                  toast.error('Appointment not found', { description: 'It may have been cancelled or already moved. Reply to the patient instead.' });
                  return;
                }
                setAcceptForm({ date: req.preferredDate, time: apt.time || '10:00 AM' });
                setAcceptingMsg(m);
              },
            },
            secondaryAction: {
              label: 'Decline',
              onClick: () => {
                setReplyDraft(`Hi ${client?.name?.split(' ')[0] || 'there'}, unfortunately we can't move your appointment to that time. `);
                setExpandedReplyId(itemId);
              },
            },
          });
          return;
        }

        out.push({
          id: itemId,
          type: 'message',
          title: `Message from ${client?.name || 'client'}`,
          subtitle: m.body?.slice(0, 80) || m.subject || '',
          patientName: client?.name,
          patientId: client?.id,
          when: m.createdAt,
          priority: 'normal',
          messageId: m.id,
          // Primary action toggles inline reply expansion — no navigation.
          primaryAction: {
            label: 'Reply',
            onClick: () => {
              setExpandedReplyId(prev => prev === itemId ? null : itemId);
              setReplyDraft('');
            },
          },
          // Secondary action: jump to full thread inside the patient record.
          secondaryAction: {
            label: 'Open thread',
            onClick: () => {
              if (client) {
                setSelectedClientId(client.id);
                handleSidebarClick('patients');
                setClientRecordTab('communications');
              }
            },
          },
        });
      });

    // Unsigned forms (forms sent to a client that haven't been signed)
    messages
      .filter(m => m.type === 'form' && !m.isSigned && m.recipientId !== 'admin')
      .forEach(m => {
        // Forms can be from admin → client OR client → admin (when re-sending),
        // so we look up either party against the client list.
        const client = clients.find(c => c.id === m.recipientId) ||
                       clients.find(c => c.id === m.senderId);
        out.push({
          id: `form-${m.id}`,
          type: 'form',
          title: `Form unsigned — ${client?.name || 'client'}`,
          subtitle: m.subject,
          patientName: client?.name,
          patientId: client?.id,
          when: m.createdAt,
          priority: 'normal',
          primaryAction: {
            label: 'Open thread',
            onClick: () => {
              if (client) {
                setSelectedClientId(client.id);
                handleSidebarClick('patients');
                setClientRecordTab('communications');
              }
            },
          },
        });
      });

    // Pending / overdue payments
    filteredClients.forEach(c => {
      (c.payments || [])
        .filter(p => p.status === 'Pending' || p.status === 'Overdue')
        .forEach(p => {
          const due = p.dueDate ? new Date(p.dueDate) : null;
          const isOverdue = due && due < new Date();
          out.push({
            id: `payment-${c.id}-${p.id}`,
            type: 'payment',
            title: `${p.status === 'Overdue' || isOverdue ? 'Overdue' : 'Pending'} payment — ${c.name}`,
            subtitle: `£${p.amount.toFixed(2)} · ${p.description}${due ? ` · due ${due.toLocaleDateString('en-GB')}` : ''}`,
            patientName: c.name,
            patientId: c.id,
            when: p.dueDate || p.createdAt,
            priority: isOverdue ? 'high' : 'normal',
            primaryAction: {
              label: 'Open',
              onClick: () => {
                setSelectedClientId(c.id);
                handleSidebarClick('patients');
                setClientRecordTab('financials');
              },
            },
          });
        });
    });

    // Open tasks
    const today = new Date().toISOString().split('T')[0];
    tasks
      .filter(t => t.status === 'open' && (!t.assigneeId || t.assigneeId === user?.id))
      .filter(t => !t.snoozedUntil || t.snoozedUntil <= today)
      .forEach(t => {
        const overdue = t.dueDate && t.dueDate < today;
        out.push({
          id: `task-${t.id}`,
          type: 'task',
          title: t.title,
          subtitle: [
            t.clientName ? `For ${t.clientName}` : null,
            t.dueDate ? (overdue ? `Overdue · due ${new Date(t.dueDate).toLocaleDateString('en-GB')}` : `Due ${new Date(t.dueDate).toLocaleDateString('en-GB')}`) : null,
            t.description ? t.description.slice(0, 60) : null,
          ].filter(Boolean).join(' · '),
          patientName: t.clientName,
          patientId: t.clientId,
          when: t.dueDate || t.createdAt,
          priority: (t.priority === 'high' || overdue) ? 'high' : 'normal',
          primaryAction: {
            label: 'Done',
            onClick: () => {
              const previousStatus = t.status;
              onUpdateTask(t.id, { status: 'done', completedAt: new Date().toISOString() });
              // Surface an undo toast so doctors can recover from a mis-tap.
              toast.success('Task marked done', {
                description: `"${t.title}" moved to completed.`,
                duration: 5000,
                action: {
                  label: 'Undo',
                  onClick: () => onUpdateTask(t.id, { status: previousStatus || 'open', completedAt: '' }),
                },
              });
            },
          },
          secondaryAction: {
            label: 'Snooze',
            onClick: () => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              onUpdateTask(t.id, { status: 'snoozed', snoozedUntil: tomorrow.toISOString().split('T')[0] });
            },
          },
          task: t,
        });
      });

    // Sort: high priority first, then by when desc
    return out.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return new Date(b.when).getTime() - new Date(a.when).getTime();
    });
  }, [filteredClients, clients, messages, appointments, tasks, user, setSelectedClientId, setClientRecordTab, handleSidebarClick, setTriageSelectedId, onUpdateTask, toast]);

  const filtered = filter === 'all' ? items : items.filter(i => {
    if (filter === 'tasks') return i.type === 'task';
    if (filter === 'assessments') return i.type === 'assessment';
    if (filter === 'messages') return i.type === 'message' || i.type === 'reschedule';
    if (filter === 'forms') return i.type === 'form';
    if (filter === 'payments') return i.type === 'payment';
    return true;
  });

  const counts: Record<InboxFilter, number> = {
    all: items.length,
    tasks: items.filter(i => i.type === 'task').length,
    assessments: items.filter(i => i.type === 'assessment').length,
    messages: items.filter(i => i.type === 'message' || i.type === 'reschedule').length,
    forms: items.filter(i => i.type === 'form').length,
    payments: items.filter(i => i.type === 'payment').length,
  };

  const iconFor = (type: InboxItem['type']) => {
    if (type === 'assessment') return <ClipboardList size={14} />;
    if (type === 'message') return <MessageSquare size={14} />;
    if (type === 'reschedule') return <CalendarClock size={14} />;
    if (type === 'form') return <FileText size={14} />;
    if (type === 'payment') return <CreditCard size={14} />;
    return <ListChecks size={14} />;
  };

  const submitNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const client = newTask.clientId ? filteredClients.find(c => c.id === newTask.clientId) : null;
    await onAddTask({
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      status: 'open',
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      assigneeId: user?.id,
      assigneeName: user?.fullName,
      clientId: client?.id,
      clientName: client?.name,
    });
    setNewTask({ title: '', description: '', dueDate: '', clientId: '', priority: 'normal' });
    setShowNewTask(false);
  };

  return (
    <div className="animate-fade-up page-stack">
      {ConfirmHost}
      <PageHeader
        title="Inbox"
        subtitle={`${items.length} item${items.length !== 1 ? 's' : ''} need${items.length === 1 ? 's' : ''} you`}
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => setShowNewTask(true)}>
            New task
          </Button>
        }
      />

      {/* Filter chips — wrap on narrow screens so Forms/Payments are never
          hidden behind an uncued horizontal scroll. Sticky so you can re-filter
          a long queue without scrolling back to the top. */}
      <div className="sticky top-0 z-20 flex flex-wrap gap-2 bg-ivory/95 backdrop-blur-sm py-2">
        {filterChips.map(chip => (
          <button
            key={chip.id}
            onClick={() => setFilter(chip.id)}
            className={`filter-chip whitespace-nowrap ${filter === chip.id ? 'is-active' : ''}`}
          >
            {chip.icon}
            <span>{chip.label}</span>
            {counts[chip.id] > 0 && (
              <span className="filter-count">{counts[chip.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Bulk actions bar (only for current filter, only task-eligible items) ── */}
      {(() => {
        const taskItems = filtered.filter(i => i.type === 'task' && i.task);
        if (taskItems.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-cream/60 border border-sand rounded-md px-3 py-2">
            <span className="text-xs text-muted">
              {taskItems.length} task{taskItems.length !== 1 ? 's' : ''} in view
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Snowflake size={12} />}
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const until = tomorrow.toISOString().split('T')[0];
                  taskItems.forEach(i => onUpdateTask(i.task!.id, { status: 'snoozed', snoozedUntil: until }));
                }}
              >
                Snooze all
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Check size={12} />}
                onClick={() => {
                  taskItems.forEach(i => onUpdateTask(i.task!.id, { status: 'done', completedAt: new Date().toISOString() }));
                }}
              >
                Mark all done
              </Button>
            </div>
          </div>
        );
      })()}

      {/* List */}
      <Card padded={false}>
        {warmingUp && filtered.length === 0 ? (
          <div className="flex flex-col">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t border-cream' : ''}`}>
                <Skeleton width={32} height={32} />
                <div className="flex-grow flex flex-col gap-1.5">
                  <Skeleton height={14} width="50%" />
                  <Skeleton height={11} width="80%" />
                  <Skeleton height={10} width="20%" />
                </div>
                <Skeleton width={80} height={28} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Check size={16} />}
            title={filter === 'all' ? "You're all caught up" : 'Nothing here right now'}
            description={
              filter === 'all'
                ? 'New assessments, messages, unsigned forms, and overdue payments will appear here as they come in. Great work today.'
                : 'Try a different filter, or switch to "All" to see everything that needs attention.'
            }
          />
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
            {filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, x: 80, height: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={`group px-4 py-3 hover:bg-cream/60 transition-colors relative ${idx > 0 ? 'border-t border-cream' : ''} ${item.priority === 'high' ? 'bg-danger-bg/40' : ''}`}
              >
                {/* Type accent stripe on the left — instant visual categorisation */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  item.priority === 'high'         ? 'bg-danger' :
                  item.type === 'assessment'       ? 'bg-info' :
                  item.type === 'message'          ? 'bg-primary' :
                  item.type === 'reschedule'       ? 'bg-warning' :
                  item.type === 'form'             ? 'bg-warning' :
                  item.type === 'payment'          ? 'bg-success' :
                                                     'bg-transparent'
                }`} />

                {/* Mobile: stacked card layout */}
                <div className="flex flex-col gap-2.5 md:hidden">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                      item.type === 'assessment' ? 'bg-info-light text-info-text' :
                      item.type === 'message'    ? 'bg-primary/10 text-primary' :
                      item.type === 'reschedule' ? 'bg-warning-bg text-warning-text' :
                      item.type === 'form'       ? 'bg-warning-bg text-warning-text' :
                      item.type === 'payment'    ? 'bg-success-light text-success-text' :
                                                   'bg-cream text-obsidian'
                    }`}>
                      {iconFor(item.type)}
                    </div>
                    <div
                      className={`min-w-0 flex-grow ${item.type === 'message' ? 'cursor-pointer' : ''}`}
                      onClick={item.type === 'message' ? () => setExpandedReplyId(prev => prev === item.id ? null : item.id) : undefined}
                      aria-expanded={item.type === 'message' ? expandedReplyId === item.id : undefined}
                      title={item.type === 'message' ? 'Tap to read the full conversation' : undefined}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {item.type === 'assessment' ? 'Assessment' :
                           item.type === 'message'    ? 'Message' :
                         item.type === 'reschedule' ? 'Reschedule' :
                           item.type === 'form'       ? 'Form' :
                           item.type === 'payment'    ? 'Payment' :
                           item.type === 'task'       ? 'Task' : 'Item'}
                        </span>
                        {item.priority === 'high' && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium uppercase tracking-wider text-danger">
                            <AlertTriangle size={10} /> Priority
                          </span>
                        )}
                        <span className="text-xs text-hint ml-auto">{relativeTime(item.when)} ago</span>
                      </div>
                      <p className="text-sm font-medium text-obsidian mt-0.5">{item.title}</p>
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" trailingIcon={<ArrowRight size={13} />} onClick={item.primaryAction.onClick} className="flex-1">
                      {item.primaryAction.label}
                    </Button>
                    {item.secondaryAction && (
                      <Button variant="ghost" size="sm" onClick={item.secondaryAction.onClick} aria-label="Snooze">
                        <Snowflake size={13} />
                      </Button>
                    )}
                    {item.task && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(item.task!.id, item.task!.title)} aria-label="Delete task">
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Desktop: inline row */}
                <div className="hidden md:flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    item.type === 'assessment' ? 'bg-info-light text-info-text' :
                    item.type === 'message'    ? 'bg-primary/10 text-primary' :
                    item.type === 'form'       ? 'bg-warning-bg text-warning-text' :
                    item.type === 'payment'    ? 'bg-success-light text-success-text' :
                                                 'bg-cream text-obsidian'
                  }`}>
                    {iconFor(item.type)}
                  </div>
                  <div
                    className={`min-w-0 flex-grow ${item.type === 'message' ? 'cursor-pointer' : ''}`}
                    onClick={item.type === 'message' ? () => setExpandedReplyId(prev => prev === item.id ? null : item.id) : undefined}
                    aria-expanded={item.type === 'message' ? expandedReplyId === item.id : undefined}
                    title={item.type === 'message' ? 'Click to read the full conversation' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        {item.type === 'assessment' ? 'Assessment' :
                         item.type === 'message'    ? 'Message' :
                         item.type === 'reschedule' ? 'Reschedule' :
                         item.type === 'form'       ? 'Form' :
                         item.type === 'payment'    ? 'Payment' :
                         item.type === 'task'       ? 'Task' : 'Item'}
                      </span>
                      {item.priority === 'high' && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium uppercase tracking-wider text-danger">
                          <AlertTriangle size={10} /> Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-obsidian truncate mt-0.5">{item.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.subtitle}</p>
                    <p className="text-xs text-hint mt-1">{relativeTime(item.when)} ago</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.secondaryAction && (
                      <Button variant="ghost" size="sm" onClick={item.secondaryAction.onClick}>
                        <Snowflake size={13} />
                      </Button>
                    )}
                    {item.task && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(item.task!.id, item.task!.title)} aria-label="Delete task">
                        <Trash2 size={13} />
                      </Button>
                    )}
                    <Button variant="primary" size="sm" trailingIcon={<ArrowRight size={13} />} onClick={item.primaryAction.onClick}>
                      {item.primaryAction.label}
                    </Button>
                  </div>
                </div>

                {/* ── Inline reply expansion (message-type items only) ─────────── */}
                <AnimatePresence>
                  {(item.type === 'message' || item.type === 'reschedule') && expandedReplyId === item.id && item.messageId && (() => {
                    // Last 5 messages in this thread (between admin and patient).
                    // Older history lives behind "Open thread".
                    const threadMessages = messages
                      .filter(m => m.senderId === item.patientId || m.recipientId === item.patientId)
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    const recentThread = threadMessages.slice(-5);
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-3 border-t border-cream pt-3"
                      >
                        {/* col-reverse + reversed array bottom-anchors the scroll
                            (newest visible) without a scrollTop effect that would
                            race the height animation. */}
                        <div className="flex flex-col-reverse gap-2 mb-3 max-h-60 overflow-y-auto pr-1">
                          {[...recentThread].reverse().map(m => (
                            <div
                              key={m.id}
                              className={`text-sm px-3 py-2 md:px-4 md:py-3 rounded-md max-w-[85%] ${
                                m.senderId === 'admin'
                                  ? 'self-end bg-primary/10 text-obsidian ml-auto border border-primary/20'
                                  : 'self-start bg-cream text-obsidian border border-sand'
                              }`}
                            >
                              {m.body}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            placeholder="Reply to patient..."
                            rows={2}
                            className="flex-1 bg-cream border-transparent rounded-md px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            autoFocus
                          />
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                if (!replyDraft.trim() || !item.patientId) return;
                                setReplySending(true);
                                try {
                                  await onSendMessage({
                                    senderId: 'admin',
                                    recipientId: item.patientId,
                                    subject: 'Reply',
                                    body: replyDraft.trim(),
                                    type: 'message',
                                    createdAt: new Date().toISOString(),
                                    read: false,
                                  });
                                  // Mark the original message as read so it leaves the inbox.
                                  if (item.messageId) await onMarkMessageRead(item.messageId);
                                  setReplyDraft('');
                                  setExpandedReplyId(null);
                                } finally {
                                  setReplySending(false);
                                }
                              }}
                              disabled={!replyDraft.trim() || replySending}
                            >
                              {replySending ? 'Sending…' : 'Send'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setExpandedReplyId(null); setReplyDraft(''); }}
                            >
                              Cancel
                            </Button>
                            {messageTemplates.length > 0 && (
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowReplyTemplates(s => !s)}
                                  aria-label="Insert template"
                                  title="Insert a saved message template"
                                >
                                  <BookText size={13} />
                                </Button>
                                {showReplyTemplates && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowReplyTemplates(false)} />
                                    <div className="absolute right-0 bottom-full mb-2 w-64 max-h-60 overflow-y-auto bg-white rounded-lg shadow-panel border border-sand z-50 p-1.5 space-y-0.5">
                                      {messageTemplates.map(t => (
                                        <button
                                          key={t.id}
                                          type="button"
                                          onClick={() => {
                                            setReplyDraft(prev => (prev ? `${prev} ${t.body}` : t.body));
                                            setShowReplyTemplates(false);
                                          }}
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
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* New task modal */}
      <Modal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        title="New task"
        subtitle="Something to follow up on. Link to a patient or keep it standalone."
        size="md"
      >
        <form onSubmit={submitNewTask} className="flex flex-col gap-3">
          <Input
            label="Title"
            required
            value={newTask.title}
            onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))}
            placeholder="e.g. Call back Saba about month 6"
          />
          <Textarea
            label="Notes (optional)"
            rows={2}
            value={newTask.description}
            onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))}
            placeholder="Any context for later"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Due date"
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask(t => ({ ...t, dueDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
            <Select
              label="Priority"
              value={newTask.priority}
              onChange={(e) => setNewTask(t => ({ ...t, priority: e.target.value as 'normal' | 'high' }))}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </div>
          <Select
            label="Linked patient (optional)"
            value={newTask.clientId}
            onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))}
          >
            <option value="">— Standalone task —</option>
            {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowNewTask(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!newTask.title.trim()}>Create task</Button>
          </div>
        </form>
      </Modal>

      {/* Accept-reschedule modal — confirms the patient's structured request,
          with a live conflict check against the clinician's other bookings. */}
      <Modal
        open={!!acceptingMsg && !!acceptApt}
        onClose={() => setAcceptingMsg(null)}
        title="Accept reschedule"
        subtitle={acceptApt ? `${acceptApt.clientName} — ${acceptApt.type}, currently ${acceptApt.date} at ${acceptApt.time}` : undefined}
        size="md"
      >
        {acceptApt && acceptingMsg?.rescheduleRequest && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Patient asked for{' '}
              <span className="text-obsidian font-medium">
                {new Date(`${acceptingMsg.rescheduleRequest.preferredDate}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
              {' '}({acceptingMsg.rescheduleRequest.preferredTime.toLowerCase()}). Pick the exact slot:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="New date"
                type="date"
                required
                value={acceptForm.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setAcceptForm(f => ({ ...f, date: e.target.value }))}
              />
              <Select
                label="New time"
                required
                value={acceptForm.time}
                onChange={(e) => setAcceptForm(f => ({ ...f, time: e.target.value }))}
              >
                {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            {acceptConflict && (
              <div className="rounded-md bg-danger-bg border border-danger/20 px-3 py-2.5 text-xs text-danger-text">
                <span className="font-medium">Conflict:</span> {acceptConflict.doctorName ?? 'This clinician'} already has{' '}
                <span className="font-medium">{acceptConflict.type}</span> with {acceptConflict.clientName} at {acceptConflict.time} that day.
                Pick a different time.
              </div>
            )}
            <p className="text-xs text-muted">The patient is notified automatically once the new time is saved.</p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setAcceptingMsg(null)} disabled={acceptSaving}>Cancel</Button>
              <Button
                variant="primary"
                disabled={acceptSaving || !acceptForm.date || !acceptForm.time || !!acceptConflict}
                loading={acceptSaving}
                onClick={async () => {
                  if (!acceptApt || !acceptingMsg) return;
                  setAcceptSaving(true);
                  try {
                    await onUpdateAppointment(acceptApt.id, { date: acceptForm.date, time: acceptForm.time });
                    await onMarkMessageRead(acceptingMsg.id);
                    toast.success('Appointment rescheduled', {
                      description: `${acceptApt.clientName} moved to ${acceptForm.date} at ${acceptForm.time}. Patient notified.`,
                    });
                    setAcceptingMsg(null);
                  } catch (err) {
                    console.error('Failed to accept reschedule:', err);
                    toast.error('Could not reschedule', { description: 'Please try again.' });
                  } finally {
                    setAcceptSaving(false);
                  }
                }}
              >
                {acceptSaving ? 'Saving…' : 'Confirm new time'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default memo(InboxPanel);
