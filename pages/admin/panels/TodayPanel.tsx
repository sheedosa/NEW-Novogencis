import React, { memo, useMemo, useState, useEffect } from 'react';
import { useAdminContext } from '../context';
import {
  CalendarDays, CalendarX2, AlertTriangle, FileText, CreditCard,
  StickyNote, ArrowRight, Plus, ClipboardList, MessageSquare, Users as UsersIcon,
  CheckCircle, Sun, Phone, Activity, Send, X as XIcon,
  Sparkles, Lightbulb, TrendingUp, TrendingDown, Hourglass, UserX, PackageCheck,
} from 'lucide-react';
import {
  PageHeader, Stat, Card, CardHeader, Button, StatusBadge, EmptyState, Badge,
  Skeleton,
} from '../../../components/ui';
import { Appointment } from '../../../types';
import { doc, onSnapshot, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

interface DailyBriefingDoc {
  date: string;
  generatedAt: string;
  model: string;
  summary: string;
  bullets: string[];
  metrics?: Record<string, number>;
}

interface FollowUpSuggestionDoc {
  clientId: string;
  clientName: string;
  clientFirstName: string;
  hoursStale: number;
  draftSubject: string;
  draftBody: string;
  status: 'pending-approval' | 'sent' | 'dismissed';
  generatedAt: string;
  editedBody?: string;
}

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
  if (unsigned) flags.push({ id: 'form', label: 'Form unsigned', icon: <FileText size={11} />, tone: 'warning' });

  // No deposit / pending payment?
  const pendingPay = (client.payments || []).find((p: any) => p.status === 'Pending' || p.status === 'Overdue');
  if (pendingPay) flags.push({ id: 'pay', label: 'Payment pending', icon: <CreditCard size={11} />, tone: 'warning' });

  // Policies not accepted?
  if (!client.policiesAccepted) flags.push({ id: 'policy', label: 'Policies pending', icon: <AlertTriangle size={11} />, tone: 'danger' });

  // Notes missing on a completed appointment?
  if (apt.status === 'Completed' && (!apt.notes || apt.notes.trim().length === 0)) {
    flags.push({ id: 'notes', label: 'Notes missing', icon: <StickyNote size={11} />, tone: 'warning' });
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
    setSelectedClientId,
    handleSidebarClick,
    getInitials,
  } = useAdminContext();

  // 400ms perceived-loading window so the page feels responsive instead of
  // popping content in one cycle later. After the window, real empty states show.
  const [warmingUp, setWarmingUp] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWarmingUp(false), 400);
    return () => clearTimeout(t);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // ── AI: today's briefing (written by the dailyBriefing Cloud Function) ────
  const [briefing, setBriefing] = useState<DailyBriefingDoc | null>(null);
  useEffect(() => {
    const ref = doc(db, 'daily_briefings', today);
    return onSnapshot(ref, snap => {
      setBriefing(snap.exists() ? (snap.data() as DailyBriefingDoc) : null);
    }, () => setBriefing(null));
  }, [today]);

  // ── AI: pending follow-up suggestions ─────────────────────────────────────
  const [followUps, setFollowUps] = useState<FollowUpSuggestionDoc[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'followup_suggestions'), where('status', '==', 'pending-approval'));
    return onSnapshot(q, snap => {
      setFollowUps(snap.docs.map(d => d.data() as FollowUpSuggestionDoc));
    }, () => setFollowUps([]));
  }, []);

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
    return d.toISOString().split('T')[0];
  })();
  const tomorrowAppointments = filteredAppointments.filter(a => a.date === tomorrowStr && a.status !== 'Cancelled');

  // Revenue today (sum of Paid payments dated today across all clients)
  const revenueToday = useMemo(() => {
    return filteredClients.reduce((sum, c) => {
      return sum + (c.payments || [])
        .filter(p => p.status === 'Paid' && p.paidDate === today)
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

  const formatGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  // ─────────────────────────────────────────────────────────────────────────
  // Clinic Radar — forward-thinking signals computed from data the app
  // already has. Each item is something a real operator would want to know
  // BEFORE they realise it themselves. Keep this honest: only show what's
  // computable from real data, never invent metrics.
  // ─────────────────────────────────────────────────────────────────────────
  const radar = useMemo(() => {
    const items: {
      id: string;
      tone: 'gold' | 'warning' | 'danger' | 'positive';
      icon: React.ReactNode;
      title: string;
      detail: string;
      action?: { label: string; onClick: () => void };
    }[] = [];

    const now = Date.now();
    const ms = (days: number) => days * 24 * 60 * 60 * 1000;

    // 1. Active patients who have no upcoming booking AND haven't been in for 60+ days
    //    → likely to churn unless reached out to
    const atRisk = filteredClients.filter(c => {
      if (!['Active', 'Ongoing', 'Converted'].includes(c.status || '')) return false;
      const aps = appointments.filter(a => a.clientId === c.id);
      const upcoming = aps.find(a => (a.status === 'Confirmed' || a.status === 'Pending') && new Date(a.date) >= new Date(new Date().toDateString()));
      if (upcoming) return false;
      const lastVisit = aps.filter(a => a.status === 'Completed').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (!lastVisit) return false;
      return now - new Date(lastVisit.date).getTime() > ms(60);
    });
    if (atRisk.length > 0) {
      items.push({
        id: 'at-risk',
        tone: 'danger',
        icon: <UserX size={14} />,
        title: `${atRisk.length} active patient${atRisk.length !== 1 ? 's' : ''} at risk of lapsing`,
        detail: `${atRisk.slice(0, 2).map(c => c.name).join(', ')}${atRisk.length > 2 ? ` and ${atRisk.length - 2} more` : ''} — no future booking and 60+ days since last visit.`,
        action: { label: 'Open registry', onClick: () => handleSidebarClick('patients') },
      });
    }

    // 2. Reviewed-but-not-Contacted bottleneck — patients stuck in the funnel
    const stuckReviewed = filteredClients.filter(c => {
      if (c.status !== 'Reviewed') return false;
      const reviewedAt = c.assessmentData?.reviewDate ? new Date(c.assessmentData.reviewDate).getTime() : new Date(c.createdAt || 0).getTime();
      return now - reviewedAt > ms(3);
    });
    if (stuckReviewed.length > 0) {
      items.push({
        id: 'stuck-reviewed',
        tone: 'warning',
        icon: <Hourglass size={14} />,
        title: `${stuckReviewed.length} reviewed patient${stuckReviewed.length !== 1 ? 's' : ''} waiting for outreach`,
        detail: `Feedback was submitted 3+ days ago. Convert them before they go cold.`,
        action: { label: 'See list', onClick: () => handleSidebarClick('patients') },
      });
    }

    // 3. Conversion momentum — % converted this 14d vs prior 14d
    const conv14 = filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() < ms(14) && ['Converted', 'Active', 'Ongoing'].includes(c.status || '')).length;
    const conv14prev = filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() >= ms(14) && now - new Date(c.createdAt).getTime() < ms(28) && ['Converted', 'Active', 'Ongoing'].includes(c.status || '')).length;
    if (conv14 + conv14prev > 0) {
      const delta = conv14 - conv14prev;
      const pct = conv14prev === 0 ? (conv14 > 0 ? 100 : 0) : Math.round(((conv14 - conv14prev) / conv14prev) * 100);
      if (Math.abs(pct) >= 15 || delta !== 0) {
        items.push({
          id: 'momentum',
          tone: delta >= 0 ? 'positive' : 'warning',
          icon: delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
          title: `Conversions ${delta >= 0 ? 'up' : 'down'} ${Math.abs(pct)}% over the last 14 days`,
          detail: `${conv14} converted vs ${conv14prev} in the prior fortnight.`,
          action: { label: 'See insights', onClick: () => handleSidebarClick('insights') },
        });
      }
    }

    // 4. Treatment-plan completions imminent — clients on packageStatus='In progress' nearing end
    const planEndingSoon = filteredClients.filter(c => {
      const plan = c.treatmentPlan;
      if (!plan?.phases?.length) return false;
      const active = plan.phases.find((p: any) => p.status === 'Active');
      if (!active) return false;
      return active.sessionsCompleted >= active.sessionsPlanned - 1;
    });
    if (planEndingSoon.length > 0) {
      items.push({
        id: 'plan-ending',
        tone: 'gold',
        icon: <PackageCheck size={14} />,
        title: `${planEndingSoon.length} patient${planEndingSoon.length !== 1 ? 's' : ''} finishing their package`,
        detail: `Time to discuss the next phase — biggest LTV moment of the journey.`,
        action: { label: 'Review', onClick: () => handleSidebarClick('patients') },
      });
    }

    // 5. Pending feedback older than 48h
    const overdueFeedback = filteredClients.filter(c => {
      if (c.status !== 'Assessment Submitted') return false;
      const submittedAt = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return now - submittedAt > ms(2);
    });
    if (overdueFeedback.length > 0) {
      items.push({
        id: 'overdue-feedback',
        tone: 'danger',
        icon: <AlertTriangle size={14} />,
        title: `${overdueFeedback.length} assessment${overdueFeedback.length !== 1 ? 's' : ''} awaiting feedback for 48+ hours`,
        detail: `Clinic SLA: review within 24h. These patients are waiting.`,
        action: { label: 'Triage now', onClick: () => handleSidebarClick('inbox') },
      });
    }

    return items;
  }, [filteredClients, appointments, handleSidebarClick]);

  const friendlyDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.fullName || '').split(' ')[0];

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title={`${greeting}${firstName ? ', ' + firstName : ''}`}
        subtitle={friendlyDate}
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => openBookingModal()}>
            Book appointment
          </Button>
        }
      />

      {/* ── Up next hero (mobile-only, when there's an imminent appointment) ── */}
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
          <div className="lg:hidden">
            <Card tone="dark" className="!p-0 overflow-hidden">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-gold" />
                    Up next · {timing}
                  </span>
                  <span className="text-xs text-white/60">{next.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="avatar avatar-lg">{getInitials(next.clientName)}</div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-base font-medium text-white truncate">{next.clientName}</p>
                    <p className="text-xs text-white/70 truncate">{next.type}</p>
                  </div>
                </div>
                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {flags.map(f => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-white/10 text-white"
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
                      className="btn btn-secondary btn-sm flex-1 !border-white/30 !text-white hover:!bg-white/10"
                    >
                      <Phone size={13} /> Call
                    </a>
                  )}
                  <button
                    onClick={() => { setSelectedClientId(next.clientId); handleSidebarClick('patients'); }}
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

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Sessions today"
          value={todayAppointments.length}
          icon={<CalendarDays size={16} />}
          accent="info"
        />
        <Stat
          label="Revenue today"
          value={formatGBP(revenueToday)}
          icon={<CreditCard size={16} />}
          accent="sage"
        />
        <Stat
          label="New patients · 7d"
          value={newPatientsWeek}
          icon={<UsersIcon size={16} />}
          accent="gold"
        />
        <Stat
          label="Open tasks"
          value={openTasks.length}
          icon={<ListChecksIcon />}
          accent="warning"
          onClick={() => handleSidebarClick('inbox')}
        />
      </div>

      {/* ── AI: Today's briefing (Claude-generated each morning at 07:00) ── */}
      {briefing && (briefing.summary || briefing.bullets.length > 0) && (
        <Card tone="elevated" accent="gold">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-primary">Today's briefing</p>
                <Badge variant="ai" icon={<Sparkles size={9} />}>AI</Badge>
              </div>
              {briefing.summary && (
                <p className="text-sm text-obsidian leading-relaxed">{briefing.summary}</p>
              )}
              {briefing.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {briefing.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-muted flex items-start gap-2 leading-relaxed">
                      <span className="text-primary mt-1">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-hint mt-2.5">
                Generated {new Date(briefing.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {briefing.model}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── AI: Follow-up suggestions for cold leads ── */}
      {followUps.length > 0 && (
        <Card accent="warning">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-warning-bg text-warning-text flex items-center justify-center">
                <Hourglass size={14} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-obsidian">AI-drafted follow-ups ready</h3>
                <p className="text-xs text-muted">{followUps.length} cold lead{followUps.length > 1 ? 's' : ''} have a draft ready to send</p>
              </div>
            </div>
            <Badge variant="ai" icon={<Sparkles size={9} />}>AI</Badge>
          </div>
          <div className="space-y-2">
            {followUps.slice(0, 5).map(f => (
              <FollowUpRow key={f.clientId} suggestion={f} onOpenClient={(id) => { setSelectedClientId(id); handleSidebarClick('patients'); }} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Clinic Radar — forward-thinking signals (only renders if there's anything to flag) ── */}
      {radar.length > 0 && (
        <Card className="!bg-gradient-to-br !from-obsidian !to-[#27272A] !text-white !border-obsidian">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center text-primary">
                <Sparkles size={14} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Clinic radar</h3>
                <p className="text-xs text-white/60">{radar.length} signal{radar.length !== 1 ? 's' : ''} worth your attention</p>
              </div>
            </div>
            <Badge variant="ai" icon={<Lightbulb size={11} />}>Auto-detected</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {radar.map(item => (
              <button
                key={item.id}
                onClick={item.action?.onClick}
                className="text-left bg-white/5 hover:bg-white/10 transition-colors rounded-md p-3 border border-white/10 group"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                    item.tone === 'danger'   ? 'bg-danger/20 text-danger'   :
                    item.tone === 'warning'  ? 'bg-warning/20 text-warning' :
                    item.tone === 'positive' ? 'bg-success/20 text-success' :
                                               'bg-primary/20 text-primary'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{item.detail}</p>
                    {item.action && (
                      <p className="text-xs text-primary mt-2 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                        {item.action.label} <ArrowRight size={11} />
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Main: schedule + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Run sheet (2/3) */}
        <div className="lg:col-span-2">
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
                onClick={() => handleSidebarClick('calendar')}
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
                    <button
                      key={apt.id}
                      onClick={() => { setSelectedClientId(apt.clientId); handleSidebarClick('patients'); }}
                      className={`w-full text-left px-4 py-3 hover:bg-cream/50 transition-colors ${idx > 0 ? 'border-t border-cream' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Time column */}
                        <div className="text-center shrink-0 w-12 pt-0.5">
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
                            {flags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {flags.map(f => (
                                  <span
                                    key={f.id}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs ${
                                      f.tone === 'danger'  ? 'bg-danger-bg text-danger-text' :
                                      f.tone === 'warning' ? 'bg-warning-bg text-warning-text' :
                                                             'bg-cream text-muted'
                                    }`}
                                  >
                                    {f.icon}
                                    {f.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={apt.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Side: action queue + tomorrow */}
        <div className="flex flex-col gap-3">
          {/* Action queue */}
          <Card>
            <CardHeader
              title="Needs you"
              subtitle={`${pendingTriage.length + unreadFromClients.length + openTasks.length} item${(pendingTriage.length + unreadFromClients.length + openTasks.length) !== 1 ? 's' : ''}`}
              leadingIcon={<AlertTriangle size={14} />}
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight size={13} />}
                  onClick={() => handleSidebarClick('inbox')}
                >
                  Inbox
                </Button>
              }
            />
            {(pendingTriage.length + unreadFromClients.length + openTasks.length) === 0 ? (
              <p className="text-sm text-muted">You're all caught up.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {pendingTriage.length > 0 && (
                  <button
                    onClick={() => handleSidebarClick('inbox')}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-cream/60 transition-colors text-left"
                  >
                    <ClipboardList size={14} className="text-muted shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <p className="text-sm font-medium text-obsidian">{pendingTriage.length} assessment{pendingTriage.length !== 1 ? 's' : ''} to triage</p>
                      <p className="text-xs text-muted truncate">
                        {pendingTriage.slice(0, 2).map(c => c.name).join(', ')}
                        {pendingTriage.length > 2 && ` +${pendingTriage.length - 2}`}
                      </p>
                    </div>
                  </button>
                )}
                {unreadFromClients.length > 0 && (
                  <button
                    onClick={() => handleSidebarClick('inbox')}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-cream/60 transition-colors text-left"
                  >
                    <MessageSquare size={14} className="text-muted shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <p className="text-sm font-medium text-obsidian">{unreadFromClients.length} unread message{unreadFromClients.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-muted truncate">
                        {(() => {
                          const lastMsg = unreadFromClients[unreadFromClients.length - 1];
                          const client = filteredClients.find(c => c.id === lastMsg?.senderId);
                          return client?.name || 'Latest from client';
                        })()}
                      </p>
                    </div>
                  </button>
                )}
                {openTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => handleSidebarClick('inbox')}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-cream/60 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-danger' : 'bg-primary'}`} />
                    <div className="min-w-0 flex-grow">
                      <p className="text-sm font-medium text-obsidian truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted">
                          Due {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Tomorrow teaser */}
          <Card>
            <CardHeader
              title="Tomorrow"
              subtitle={new Date(Date.now() + 86400000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              leadingIcon={<Sun size={14} />}
            />
            {tomorrowAppointments.length === 0 ? (
              <p className="text-sm text-muted">No sessions scheduled.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-obsidian">
                  <span className="font-medium">{tomorrowAppointments.length}</span> appointment{tomorrowAppointments.length !== 1 ? 's' : ''}
                </p>
                {tomorrowAppointments.slice(0, 3).map(apt => (
                  <div key={apt.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted font-mono shrink-0 w-14">{apt.time}</span>
                    <span className="text-obsidian truncate flex-grow">{apt.clientName}</span>
                    <span className="text-hint truncate hidden sm:inline">{apt.type}</span>
                  </div>
                ))}
                {tomorrowAppointments.length > 3 && (
                  <p className="text-xs text-muted mt-1">+ {tomorrowAppointments.length - 3} more</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline ListChecks icon wrapper to avoid extra lucide import in stat row
function ListChecksIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
    </svg>
  );
}

export default memo(TodayPanel);

// ─────────────────────────────────────────────────────────────────────────────
// FollowUpRow — single AI-drafted follow-up suggestion with approve / dismiss.
// ─────────────────────────────────────────────────────────────────────────────

interface FollowUpRowProps {
  suggestion: FollowUpSuggestionDoc;
  onOpenClient: (id: string) => void;
}

const FollowUpRow: React.FC<FollowUpRowProps> = ({ suggestion: s, onOpenClient }) => {
  const [expanded, setExpanded] = useState(false);
  const [working, setWorking] = useState(false);

  const dismiss = async () => {
    setWorking(true);
    try {
      await updateDoc(doc(db, 'followup_suggestions', s.clientId), { status: 'dismissed' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="border border-cream rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-cream/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="avatar avatar-sm shrink-0">{(s.clientName || 'C').split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-obsidian truncate">{s.clientName}</p>
            <p className="text-xs text-muted">{s.hoursStale}h since feedback sent · {s.draftSubject}</p>
          </div>
        </div>
        <ArrowRight size={14} className={`text-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-cream bg-cream/30">
          <p className="text-sm text-obsidian leading-relaxed whitespace-pre-wrap mb-3">{s.draftBody}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Send size={12} />}
              onClick={() => onOpenClient(s.clientId)}
            >
              Open & review
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss} disabled={working} leadingIcon={<XIcon size={12} />}>
              Dismiss
            </Button>
            <p className="text-[10px] text-hint ml-auto">AI draft — review before sending</p>
          </div>
        </div>
      )}
    </div>
  );
};
