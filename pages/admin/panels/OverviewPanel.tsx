import React, { memo, useMemo } from 'react';
import { useAdminContext } from '../context';
import {
  ArrowRight, CalendarX2, MailX, ChevronRight, Clock, MapPin,
} from 'lucide-react';

const formatTimeAgo = (iso: string, nowMs: number) => {
  const diff = nowMs - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
};

function OverviewPanel() {
  const {
    filteredClients,
    appointments,
    messages,
    clients,
    setSelectedClientId,
    setActiveTab,
    setClientRecordTab,
    getInitials,
    openBookingModal,
  } = useAdminContext();

  // ── Derived metrics ───────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = useMemo(
    () => appointments
      .filter(a => a.date === today && a.status !== 'Cancelled')
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, today],
  );

  const activeClients = filteredClients.filter(c =>
    c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted',
  ).length;

  const sessionsRemaining = todayAppts.filter(a => {
    const [hh] = (a.time || '00:00 AM').match(/\d{1,2}/) || ['0'];
    const isPM = (a.time || '').toUpperCase().includes('PM');
    const hour = parseInt(hh, 10) + (isPM && parseInt(hh, 10) !== 12 ? 12 : 0);
    return hour >= new Date().getHours();
  }).length;

  const newAssessments = filteredClients.filter(
    c => c.status === 'Assessment Submitted' || c.status === 'New',
  ).length;

  const unreadInbox = messages.filter(
    m => !m.read && clients.some(c => c.id === m.senderId),
  ).length;

  const recentMessages = useMemo(() =>
    messages
      .filter(m => !m.read && clients.some(c => c.id === m.senderId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4),
    [messages, clients],
  );

  const recentClients = useMemo(
    () => [...filteredClients]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5),
    [filteredClients],
  );

  const liveAppt = todayAppts.find(a => {
    const [hh, mm] = (a.time || '00:00 AM').split(/[: ]/);
    const isPM = (a.time || '').toUpperCase().includes('PM');
    const start = (parseInt(hh, 10) + (isPM && parseInt(hh, 10) !== 12 ? 12 : 0)) * 60 + parseInt(mm || '0', 10);
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    return Math.abs(start - now) < 30;
  }) || todayAppts[0];

  // Snapshot of the wall clock used for relative-time labels. Recomputed
  // whenever messages change, which is good enough — labels round to minutes/hours.
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const nowMs = useMemo(() => Date.now(), [messages]);

  return (
    <div className="animate-fade-up space-y-5">
      {/* ─── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => setActiveTab('clients')} className="kpi-tile text-left hover:border-clinical/40 transition-colors">
          <span className="kpi-label">Active patients</span>
          <span className="kpi-value">{activeClients}</span>
          {newAssessments > 0 && <span className="kpi-delta up">+{newAssessments} new</span>}
          <span className="kpi-sub">{newAssessments} pending assessment · {filteredClients.length} total</span>
        </button>

        <button onClick={() => setActiveTab('appointments')} className="kpi-tile text-left hover:border-clinical/40 transition-colors">
          <span className="kpi-label">Sessions today</span>
          <span className="kpi-value">{todayAppts.length}<span className="kpi-unit">· {sessionsRemaining} remaining</span></span>
          <span className="kpi-delta flat">{todayAppts.filter(a => a.status === 'Confirmed').length} confirmed</span>
          <span className="kpi-sub">{new Set(todayAppts.map(a => a.doctorId)).size || 0} clinician{(new Set(todayAppts.map(a => a.doctorId)).size || 0) === 1 ? '' : 's'} on shift</span>
        </button>

        <button onClick={() => setActiveTab('messages')} className="kpi-tile text-left hover:border-clinical/40 transition-colors">
          <span className="kpi-label">Inbox</span>
          <span className="kpi-value">{unreadInbox}<span className="kpi-unit">unread</span></span>
          {unreadInbox > 4
            ? <span className="kpi-delta down">SLA at risk</span>
            : <span className="kpi-delta up">SLA on track</span>}
          <span className="kpi-sub">Target response under 4 h</span>
        </button>

        <button onClick={() => setActiveTab('assessments')} className="kpi-tile text-left hover:border-clinical/40 transition-colors">
          <span className="kpi-label">Assessments</span>
          <span className="kpi-value">{newAssessments}</span>
          {newAssessments > 0
            ? <span className="kpi-delta up">awaiting review</span>
            : <span className="kpi-delta flat">all triaged</span>}
          <span className="kpi-sub">{filteredClients.filter(c => c.status === 'Reviewed').length} reviewed · {filteredClients.filter(c => c.status === 'Contacted').length} contacted</span>
        </button>
      </div>

      {/* ─── Main two-column area ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Patient pulse — most recent clients */}
        <div className="lg:col-span-2 surface overflow-hidden">
          <div className="surface-pad-sm border-b border-sand">
            <div className="section-header" style={{ marginBottom: 0 }}>
              <div>
                <p className="section-title">Patient pulse</p>
                <p className="section-sub">{recentClients.length} most recently active patients</p>
              </div>
              <button onClick={() => setActiveTab('clients')} className="section-action flex items-center gap-1">
                View all <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div>
            {recentClients.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-hint">No patients yet</p>
              </div>
            ) : recentClients.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedClientId(c.id); setActiveTab('clients'); }}
                className="w-full list-row px-4"
              >
                <div className="avatar avatar-sm bg-clinical-bg text-clinical">{getInitials(c.name)}</div>
                <div className="flex-grow min-w-0 text-left">
                  <p className="text-sm font-medium text-obsidian truncate">{c.name}</p>
                  <p className="text-xs text-hint truncate">
                    {c.email || c.phone || '—'}
                  </p>
                </div>
                <span className={`status-pill ${
                  c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted' ? 'live'
                  : c.status === 'Assessment Submitted' || c.status === 'New' ? 'amber'
                  : ''
                }`}>
                  <span className="status-dot" />
                  {c.status || 'No status'}
                </span>
                <ChevronRight size={14} className="text-hint" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Feature card + Schedule + Inbox stacks */}
        <div className="space-y-4">
          {/* Next / live appointment as feature card */}
          {liveAppt ? (
            <div className="feature-card">
              <div className="flex items-center justify-between">
                <span className="feature-label">
                  {(() => {
                    const [hh, mm] = (liveAppt.time || '00:00').split(/[: ]/);
                    const isPM = (liveAppt.time || '').toUpperCase().includes('PM');
                    const start = (parseInt(hh, 10) + (isPM && parseInt(hh, 10) !== 12 ? 12 : 0)) * 60 + parseInt(mm || '0', 10);
                    const now = new Date().getHours() * 60 + new Date().getMinutes();
                    return Math.abs(start - now) < 30 ? 'In room now · ' + liveAppt.time : 'Next up · ' + liveAppt.time;
                  })()}
                </span>
                <span className="text-2xs uppercase tracking-wider opacity-60">Suite</span>
              </div>
              <div className="flex items-start gap-3 mt-1">
                <div className="avatar avatar-md" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                  {getInitials(liveAppt.clientName)}
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="feature-value truncate">{liveAppt.clientName}</p>
                  <p className="feature-meta truncate">{liveAppt.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="flex items-center gap-1"><Clock size={12} /> {liveAppt.time}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {liveAppt.doctorName || 'Unassigned'}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setSelectedClientId(liveAppt.clientId || null); setActiveTab('clients'); }}
                  className="flex-1 text-2xs font-medium text-obsidian bg-white rounded-md px-3 py-2 hover:bg-cream transition-colors"
                >
                  Open chart
                </button>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="flex-1 text-2xs font-medium rounded-md px-3 py-2 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                >
                  Schedule
                </button>
              </div>
            </div>
          ) : (
            <div className="surface surface-pad text-center text-xs text-hint">
              <CalendarX2 size={24} className="mx-auto mb-2 text-hint" />
              No sessions scheduled today
              <button onClick={() => openBookingModal()} className="block mx-auto mt-3 btn btn-secondary btn-sm">
                Book one
              </button>
            </div>
          )}

          {/* Today's schedule (compact list) */}
          <div className="surface overflow-hidden">
            <div className="surface-pad-sm border-b border-sand">
              <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                  <p className="section-title">Today's schedule</p>
                  <p className="section-sub">{sessionsRemaining} remaining</p>
                </div>
                <button onClick={() => setActiveTab('appointments')} className="section-action">View all</button>
              </div>
            </div>
            <div>
              {todayAppts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-hint">Clear day</p>
                </div>
              ) : todayAppts.slice(0, 4).map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedClientId(a.clientId || null); setActiveTab('clients'); }}
                  className="w-full list-row px-4"
                >
                  <div className="timeslot">
                    <span className="time">{a.time?.split(' ')[0]}</span>
                    <span className="duration">{a.time?.split(' ')[1] || ''}</span>
                  </div>
                  <div className="flex-grow min-w-0 text-left">
                    <p className="text-sm font-medium text-obsidian truncate">{a.clientName}</p>
                    <p className="text-xs text-hint truncate">{a.type}</p>
                  </div>
                  {a.status === 'Confirmed' && <span className="status-pill clinical"><span className="status-dot" />Confirmed</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Inbox preview */}
          <div className="surface overflow-hidden">
            <div className="surface-pad-sm border-b border-sand">
              <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                  <p className="section-title">Inbox</p>
                  <p className="section-sub">{unreadInbox} unread</p>
                </div>
                <button onClick={() => setActiveTab('messages')} className="section-action">Open <ArrowRight size={11} className="inline-block ml-0.5" /></button>
              </div>
            </div>
            <div>
              {recentMessages.length === 0 ? (
                <div className="py-10 text-center">
                  <MailX size={20} className="mx-auto mb-2 text-hint" />
                  <p className="text-xs text-hint">No new messages</p>
                </div>
              ) : recentMessages.map(m => {
                const sender = clients.find(c => c.id === m.senderId);
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedClientId(m.senderId); setActiveTab('clients'); setClientRecordTab('communications'); }}
                    className="w-full list-row px-4"
                  >
                    <div className="avatar avatar-sm bg-clinical-bg text-clinical">{getInitials(sender?.name || '??')}</div>
                    <div className="flex-grow min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-obsidian truncate">{sender?.name || 'Unknown'}</p>
                        <span className="text-2xs text-hint shrink-0">{formatTimeAgo(m.createdAt, nowMs)}</span>
                      </div>
                      <p className="text-xs text-muted truncate">{m.body || m.subject}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(OverviewPanel);
