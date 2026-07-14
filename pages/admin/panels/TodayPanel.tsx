import React, { memo, useMemo, useState, useEffect } from 'react';
import { useAdminContext } from '../context';
import { localTodayISO } from '../../../utils/time';
import {
  CalendarDays, CalendarX2, AlertTriangle, FileText, CreditCard,
  StickyNote, ArrowRight, Plus, Users as UsersIcon,
  CheckCircle, Sun, Phone, TrendingUp, ClipboardList, MessageSquare,
  Trash2, X as XIcon, UserCog,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Stat, Button, StatusBadge, EmptyState,
  Skeleton, RowActions, useConfirm, useToast,
} from '../../../components/ui';
import type { RowAction } from '../../../components/ui';
import { Appointment } from '../../../types';

interface PrepFlag {
  id: string;
  label: string;
  icon: React.ReactNode;
  tone: 'warning' | 'danger' | 'neutral';
}

function getPrepFlags(apt: Appointment, allMessages: any[], allClients: any[]): PrepFlag[] {
  const flags: PrepFlag[] = [];
  const client = allClients.find(c => c.id === apt.clientId);
  if (!client) return flags;

  // Unsigned form?
  const unsigned = allMessages.find(
    m => m.type === 'form' && !m.isSigned &&
         (m.senderId === apt.clientId || m.recipientId === apt.clientId)
  );
  if (unsigned) flags.push({ id: 'form', label: 'Form unsigned', icon: <FileText size={12} />, tone: 'warning' });

  // No deposit / pending payment?
  const pendingPay = (client.payments || []).find((p: any) => p.status === 'Pending' || p.status === 'Overdue');
  if (pendingPay) flags.push({ id: 'pay', label: 'Payment pending', icon: <CreditCard size={12} />, tone: 'warning' });

  // Policies not accepted?
  if (!client.policiesAccepted) flags.push({ id: 'policy', label: 'Policies pending', icon: <AlertTriangle size={12} />, tone: 'danger' });

  // Notes missing on a completed appointment?
  if (apt.status === 'Completed' && (!apt.notes || apt.notes.trim().length === 0)) {
    flags.push({ id: 'notes', label: 'Notes missing', icon: <StickyNote size={12} />, tone: 'warning' });
  }

  return flags;
}

function TodayPanel() {
  const {
    user,
    filteredAppointments,
    filteredClients,
    appointments,
    messages,
    tasks,
    openBookingModal,
    setActiveTab,
    handleSidebarClick,
    openPatient,
    getInitials,
    onUpdateAppointment,
    onDeleteAppointment,
  } = useAdminContext();

  const { confirm, ConfirmHost } = useConfirm();
  const { toast } = useToast();

  // Cancel / delete a booking straight from the run sheet — same clear, confirmed
  // actions the Schedule offers, so a doctor never has to hunt for them.
  const cancelBooking = async (apt: Appointment) => {
    if (apt.status === 'Cancelled') return;
    const ok = await confirm({
      title: 'Cancel this booking?',
      description: `${apt.clientName}'s ${apt.type} at ${apt.time} will be marked Cancelled and the slot freed. The booking stays in the record.`,
      confirmLabel: 'Cancel booking',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await onUpdateAppointment(apt.id, { status: 'Cancelled' });
      toast.success('Booking cancelled');
    } catch {
      toast.error('Could not cancel the booking', { description: 'Please try again.' });
    }
  };
  const deleteBooking = async (apt: Appointment) => {
    const ok = await confirm({
      title: 'Delete this appointment?',
      description: `This permanently removes ${apt.clientName}'s ${apt.type} at ${apt.time}. This can't be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await onDeleteAppointment(apt.id);
      toast.success('Appointment deleted');
    } catch {
      toast.error('Could not delete the appointment', { description: 'Please try again.' });
    }
  };
  const apptActions = (apt: Appointment): RowAction[] => [
    { label: 'Open patient', icon: <UserCog size={13} />, onClick: () => openPatient(apt.clientId) },
    ...(apt.status !== 'Cancelled'
      ? [{ label: 'Cancel booking', icon: <XIcon size={13} />, onClick: () => cancelBooking(apt), danger: true } as RowAction]
      : []),
    { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => deleteBooking(apt), danger: true },
  ];

  // 400ms perceived-loading window so the page feels responsive instead of
  // popping content in one cycle later. After the window, real empty states show.
  const [warmingUp, setWarmingUp] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWarmingUp(false), 400);
    return () => clearTimeout(t);
  }, []);

  const today = localTodayISO();

  const todayAppointments = useMemo(
    () => filteredAppointments
      .filter(a => a.date === today && a.status !== 'Cancelled')
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [filteredAppointments, today],
  );

  // Tomorrow + week stats
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA'); // local date — avoids BST UTC roll-back
  })();
  const tomorrowAppointments = filteredAppointments.filter(a => a.date === tomorrowStr && a.status !== 'Cancelled');

  // Revenue today (sum of Paid payments dated today across all clients)
  const revenueToday = useMemo(() => {
    return filteredClients.reduce((sum, c) => {
      return sum + (c.payments || [])
        .filter(p => p.status === 'Paid' && p.paidDate?.slice(0, 10) === today)
        .reduce((s, p) => s + p.amount, 0);
    }, 0);
  }, [filteredClients, today]);

  // New patients this week (since 7 days ago)
  const newPatientsWeek = useMemo(() => {
    const now = Date.now();
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    return filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() < ms7d).length;
  }, [filteredClients]);

  // Pending tasks (mine + global open)
  const openTasks = useMemo(
    () => tasks.filter(t => t.status === 'open' && (!t.assigneeId || t.assigneeId === user?.id)),
    [tasks, user],
  );

  // Pending triage count (assessments awaiting review)
  const pendingTriage = filteredClients.filter(c => c.status === 'Assessment Submitted');

  // Unread from clients
  const unreadFromClients = messages.filter(m => !m.read && m.recipientId === 'admin');

  // ── Overview dashboard: lead funnel + 30-day activity ──────────────────────
  const nowMs = Date.now();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  // Cumulative funnel by patient stage (rank ≥ N reached this stage).
  const STAGE_RANK: Record<string, number> = {
    'New Inquiry': 0, 'Assessment Submitted': 1, 'Reviewed': 2, 'Contacted': 3,
    'Converted': 4, 'Active': 4, 'Ongoing': 4, 'Completed': 4,
  };
  const rankOf = (status?: string) => STAGE_RANK[status ?? ''] ?? 0;
  const activeLeads = filteredClients.filter(c => c.status !== 'Not Suitable');
  const funnel = [
    { label: 'Leads', count: activeLeads.length },
    { label: 'Assessment done', count: activeLeads.filter(c => rankOf(c.status) >= 1).length },
    { label: 'Reviewed', count: activeLeads.filter(c => rankOf(c.status) >= 2).length },
    { label: 'Contacted', count: activeLeads.filter(c => rankOf(c.status) >= 3).length },
    { label: 'Converted', count: activeLeads.filter(c => rankOf(c.status) >= 4).length },
  ];
  const funnelTop = Math.max(1, funnel[0].count);
  const conversionRate = activeLeads.length ? Math.round((funnel[4].count / activeLeads.length) * 100) : 0;
  const notSuitableCount = filteredClients.filter(c => c.status === 'Not Suitable').length;
  const revenue30d = filteredClients.reduce((sum, c) => sum + (c.payments || [])
    .filter(p => p.status === 'Paid' && p.paidDate && nowMs - new Date(p.paidDate).getTime() < ms30d)
    .reduce((s, p) => s + p.amount, 0), 0);
  const sevenAheadISO = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-CA'); })();
  const upcoming7d = filteredAppointments.filter(a =>
    (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= today && a.date <= sevenAheadISO,
  ).length;

  const formatGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  const friendlyDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.fullName || '').split(' ')[0];

  return (
    <div className="animate-fade-up page-stack">
      {ConfirmHost}
      <PageHeader
        title={`${greeting}${firstName ? ', ' + firstName : ''}`}
        subtitle={friendlyDate}
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => openBookingModal()}>
            Book appointment
          </Button>
        }
      />

      {/* ── Overview dashboard — activity KPIs + lead funnel (first section) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Awaiting review" value={pendingTriage.length} accent="gold" icon={<ClipboardList size={16} />} onClick={() => setActiveTab('inbox')} />
        <Stat label="Unread messages" value={unreadFromClients.length} accent="info" icon={<MessageSquare size={16} />} onClick={() => setActiveTab('inbox')} />
        <Stat label="Upcoming · 7 days" value={upcoming7d} accent="sage" icon={<CalendarDays size={16} />} onClick={() => handleSidebarClick('schedule')} />
        <Stat label="Revenue · 30 days" value={formatGBP(revenue30d)} icon={<CreditCard size={16} />} onClick={() => handleSidebarClick('practice')} />
        <Stat label="New patients · 7d" value={newPatientsWeek} icon={<UsersIcon size={16} />} onClick={() => handleSidebarClick('patients')} />
      </div>

      <Card>
        <CardHeader
          title="Lead funnel"
          subtitle={`${conversionRate}% converted · ${activeLeads.length} in pipeline${notSuitableCount ? ` · ${notSuitableCount} not suitable` : ''}`}
          leadingIcon={<TrendingUp size={14} />}
        />
        <div className="mt-3 flex flex-col gap-2">
          {funnel.map((s) => {
            const pct = Math.round((s.count / funnelTop) * 100);
            return (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-28 sm:w-32 shrink-0 text-xs text-muted">{s.label}</span>
                <div className="flex-grow h-6 rounded-md bg-cream overflow-hidden relative">
                  <div className="h-full bg-primary/70 rounded-md transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
                  <span className="absolute inset-y-0 left-2.5 flex items-center text-2xs font-semibold text-obsidian tabular-nums">{s.count}</span>
                </div>
                <span className="w-10 shrink-0 text-right text-2xs text-hint tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Up next hero — shown to all doctors when there's an imminent appointment ── */}
      {(() => {
        const now = new Date();
        const next = todayAppointments.find(a => {
          const m = a.time?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!m) return false;
          let h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          const ap = m[3].toUpperCase();
          if (ap === 'PM' && h < 12) h += 12;
          if (ap === 'AM' && h === 12) h = 0;
          const aptDate = new Date();
          aptDate.setHours(h, min, 0, 0);
          // Eligible if it hasn't passed yet
          return aptDate.getTime() > now.getTime();
        });
        if (!next) return null;
        const client = filteredClients.find(c => c.id === next.clientId);
        const flags = getPrepFlags(next, messages, filteredClients);
        const m = next.time!.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)!;
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
        const aptDate = new Date();
        aptDate.setHours(h, min, 0, 0);
        const minsUntil = Math.round((aptDate.getTime() - now.getTime()) / 60000);
        const timing = minsUntil < 1 ? 'Starting now' : minsUntil < 60 ? `In ${minsUntil} min` : minsUntil < 180 ? `In ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m` : null;
        if (!timing) return null;        // not "imminent enough" to surface as a hero

        return (
          <div className="order-0">
            <Card accent="gold" className="!p-0 overflow-hidden">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-gold" />
                    Up next · {timing}
                  </span>
                  <span className="text-xs text-muted">{next.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="avatar avatar-lg">{getInitials(next.clientName)}</div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-base font-medium text-obsidian truncate">{next.clientName}</p>
                    <p className="text-xs text-muted truncate">{next.type}</p>
                  </div>
                </div>
                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {flags.map(f => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-cream text-obsidian"
                      >
                        {f.icon} {f.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {client?.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="btn btn-secondary btn-sm flex-1"
                    >
                      <Phone size={13} /> Call
                    </a>
                  )}
                  <button
                    onClick={() => openPatient(next.clientId)}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    Open chart <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Compact today strap-line — replaces the 4-up KPI row.
          Doctors scan this once, then move on to the run sheet below. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted px-1 order-1">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} className="text-info" />
          <span className="text-obsidian font-medium">{todayAppointments.length}</span>
          <span>session{todayAppointments.length !== 1 ? 's' : ''}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CreditCard size={14} className="text-success-text" />
          <span className="text-obsidian font-medium">{formatGBP(revenueToday)}</span>
          <span>today</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UsersIcon size={14} className="text-primary" />
          <span className="text-obsidian font-medium">{newPatientsWeek}</span>
          <span>new this week</span>
        </span>
      </div>

      {/* Main: run sheet — the doctor's primary surface, full width */}
      <div className="flex flex-col gap-3">
        <div>
          <Card padded={false}>
            <div className="px-4 py-3 border-b border-sand flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-muted" />
                <h3 className="text-sm font-medium text-obsidian">Run sheet · {friendlyDate}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowRight size={13} />}
                onClick={() => handleSidebarClick('schedule')}
              >
                Full calendar
              </Button>
            </div>
            {warmingUp && todayAppointments.length === 0 ? (
              <div className="flex flex-col">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t border-cream' : ''}`}>
                    <div className="text-center shrink-0 w-12 pt-0.5">
                      <Skeleton width={28} height={14} className="mx-auto" />
                      <Skeleton width={20} height={10} className="mx-auto mt-1" />
                    </div>
                    <div className="divider-v h-9" />
                    <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                      <Skeleton width={28} height={28} rounded="full" />
                      <div className="flex-grow flex flex-col gap-1.5">
                        <Skeleton height={12} width="60%" />
                        <Skeleton height={10} width="40%" />
                      </div>
                    </div>
                    <Skeleton width={70} height={20} rounded="full" />
                  </div>
                ))}
              </div>
            ) : todayAppointments.length === 0 ? (
              <EmptyState
                icon={<CalendarX2 size={16} />}
                title="No sessions today"
                description="Enjoy the quiet, or book a slot."
                action={
                  <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => openBookingModal()}>
                    Book appointment
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {todayAppointments.map((apt, idx) => {
                  const flags = getPrepFlags(apt, messages, filteredClients);
                  const client = filteredClients.find(c => c.id === apt.clientId);
                  return (
                    <div
                      key={apt.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPatient(apt.clientId)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPatient(apt.clientId); } }}
                      className={`w-full text-left px-4 py-3 hover:bg-cream/60 transition-colors cursor-pointer ${idx > 0 ? 'border-t border-cream' : ''}`}
                    >
                      {/* Line 1 is constant height: time | patient | status.
                          Prep flags render on their own line beneath, aligned
                          under the patient block, so rows keep a steady rhythm. */}
                      <div className="flex items-center gap-3">
                        {/* Time column */}
                        <div className="text-center shrink-0 w-12">
                          <p className="text-sm font-medium text-obsidian leading-none font-mono">
                            {apt.time?.split(' ')[0] || '—'}
                          </p>
                          <p className="text-xs text-hint mt-0.5">{apt.time?.split(' ')[1] || ''}</p>
                        </div>
                        <div className="divider-v h-9" />
                        {/* Patient */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                          <div className="avatar avatar-sm">{getInitials(apt.clientName)}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-obsidian truncate">{apt.clientName}</p>
                              {client?.policiesAccepted && (
                                <CheckCircle size={11} className="text-success shrink-0" aria-label="Policies accepted" />
                              )}
                            </div>
                            <p className="text-xs text-muted truncate">{apt.type}</p>
                          </div>
                        </div>
                        <StatusBadge status={apt.status} />
                        <RowActions actions={apptActions(apt)} />
                      </div>
                      {flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pl-[73px]">
                          {flags.map(f => (
                            <span
                              key={f.id}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                                f.tone === 'danger'  ? 'bg-danger-bg text-danger-text border border-danger/25' :
                                f.tone === 'warning' ? 'bg-warning-bg text-warning-text border border-warning/30' :
                                                       'bg-cream text-muted border border-sand'
                              }`}
                            >
                              {f.icon}
                              {f.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Compact follow-on links — one line each, full detail lives in
            Inbox and Schedule respectively. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => handleSidebarClick('inbox')}
            className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-sand bg-white hover:bg-cream/60 transition-colors text-left"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={14} className={`shrink-0 ${(pendingTriage.length + unreadFromClients.length + openTasks.length) > 0 ? 'text-warning-text' : 'text-muted'}`} />
              <span className="text-sm text-obsidian truncate">
                {(pendingTriage.length + unreadFromClients.length + openTasks.length) === 0
                  ? 'Inbox — all caught up'
                  : `${pendingTriage.length + unreadFromClients.length + openTasks.length} item${(pendingTriage.length + unreadFromClients.length + openTasks.length) !== 1 ? 's' : ''} need${(pendingTriage.length + unreadFromClients.length + openTasks.length) === 1 ? 's' : ''} you`}
              </span>
            </span>
            <ArrowRight size={13} className="text-muted shrink-0" />
          </button>
          <button
            onClick={() => handleSidebarClick('schedule')}
            className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-sand bg-white hover:bg-cream/60 transition-colors text-left"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Sun size={14} className="text-muted shrink-0" />
              <span className="text-sm text-obsidian truncate">
                Tomorrow: {tomorrowAppointments.length === 0 ? 'no sessions' : `${tomorrowAppointments.length} session${tomorrowAppointments.length !== 1 ? 's' : ''}`}
              </span>
            </span>
            <ArrowRight size={13} className="text-muted shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(TodayPanel);
