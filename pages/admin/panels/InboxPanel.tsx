import React, { memo, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminContext } from '../context';
import { Task } from '../../../types';
import {
  ClipboardList, MessageSquare, FileText, CreditCard, ListChecks,
  Plus, Check, X, Snowflake, ArrowRight, Inbox as InboxIcon,
  AlertTriangle, Trash2,
} from 'lucide-react';
import {
  PageHeader, Card, Button, EmptyState, Modal, Input, Select, Textarea, Badge,
  Skeleton, useConfirm,
} from '../../../components/ui';

type InboxFilter = 'all' | 'tasks' | 'assessments' | 'messages' | 'forms' | 'payments';

interface InboxItem {
  id: string;
  type: 'task' | 'assessment' | 'message' | 'form' | 'payment';
  title: string;
  subtitle: string;
  patientName?: string;
  patientId?: string;
  when: string;
  priority: 'high' | 'normal';
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  task?: Task;
}

const filterChips: { id: InboxFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all',          label: 'All',          icon: <InboxIcon size={13} /> },
  { id: 'tasks',        label: 'Tasks',        icon: <ListChecks size={13} /> },
  { id: 'assessments',  label: 'Assessments',  icon: <ClipboardList size={13} /> },
  { id: 'messages',     label: 'Messages',     icon: <MessageSquare size={13} /> },
  { id: 'forms',        label: 'Forms',        icon: <FileText size={13} /> },
  { id: 'payments',     label: 'Payments',     icon: <CreditCard size={13} /> },
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

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
        out.push({
          id: `message-${m.id}`,
          type: 'message',
          title: `Message from ${client?.name || 'client'}`,
          subtitle: m.body?.slice(0, 80) || m.subject || '',
          patientName: client?.name,
          patientId: client?.id,
          when: m.createdAt,
          priority: 'normal',
          primaryAction: {
            label: 'Reply',
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
            onClick: () => onUpdateTask(t.id, { status: 'done', completedAt: new Date().toISOString() }),
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
  }, [filteredClients, clients, messages, tasks, user, setSelectedClientId, setClientRecordTab, handleSidebarClick, setTriageSelectedId, onUpdateTask]);

  const filtered = filter === 'all' ? items : items.filter(i => {
    if (filter === 'tasks') return i.type === 'task';
    if (filter === 'assessments') return i.type === 'assessment';
    if (filter === 'messages') return i.type === 'message';
    if (filter === 'forms') return i.type === 'form';
    if (filter === 'payments') return i.type === 'payment';
    return true;
  });

  const counts: Record<InboxFilter, number> = {
    all: items.length,
    tasks: items.filter(i => i.type === 'task').length,
    assessments: items.filter(i => i.type === 'assessment').length,
    messages: items.filter(i => i.type === 'message').length,
    forms: items.filter(i => i.type === 'form').length,
    payments: items.filter(i => i.type === 'payment').length,
  };

  const iconFor = (type: InboxItem['type']) => {
    if (type === 'assessment') return <ClipboardList size={14} />;
    if (type === 'message') return <MessageSquare size={14} />;
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
    <div className="animate-fade-up flex flex-col gap-4">
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

      {/* Filter chips — use shared .filter-chip CSS so styling stays consistent. */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
            title="All caught up"
            description={filter === 'all' ? 'Nothing in your inbox right now.' : 'No items in this filter.'}
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
                className={`group px-4 py-3 hover:bg-cream/40 transition-colors relative ${idx > 0 ? 'border-t border-cream' : ''} ${item.priority === 'high' ? 'bg-danger-bg/40' : ''}`}
              >
                {/* Type accent stripe on the left — instant visual categorisation */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  item.priority === 'high'         ? 'bg-danger' :
                  item.type === 'assessment'       ? 'bg-info' :
                  item.type === 'message'          ? 'bg-primary' :
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
                      item.type === 'form'       ? 'bg-warning-bg text-warning-text' :
                      item.type === 'payment'    ? 'bg-success-light text-success-text' :
                                                   'bg-cream text-obsidian'
                    }`}>
                      {iconFor(item.type)}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-hint">
                          {item.type === 'assessment' ? 'Assessment' :
                           item.type === 'message'    ? 'Message' :
                           item.type === 'form'       ? 'Form' :
                           item.type === 'payment'    ? 'Payment' :
                           item.type === 'task'       ? 'Task' : 'Item'}
                        </span>
                        {item.priority === 'high' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
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
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-hint">
                        {item.type === 'assessment' ? 'Assessment' :
                         item.type === 'message'    ? 'Message' :
                         item.type === 'form'       ? 'Form' :
                         item.type === 'payment'    ? 'Payment' :
                         item.type === 'task'       ? 'Task' : 'Item'}
                      </span>
                      {item.priority === 'high' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
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
    </div>
  );
}

export default memo(InboxPanel);
