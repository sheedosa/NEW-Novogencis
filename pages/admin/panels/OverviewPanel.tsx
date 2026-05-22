import React, { memo } from 'react';
import { useAdminContext } from '../context';
import {
  CalendarDays, CalendarX2, AlertCircle, MessageSquare, ArrowRight,
  UserPlus, Send, ClipboardList, Calendar as CalendarIcon, Users,
} from 'lucide-react';
import {
  Card, CardHeader, Stat, Badge, Button, PageHeader, EmptyState, StatusBadge,
} from '../../../components/ui';

function OverviewPanel() {
  const {
    filteredClients,
    filteredAppointments,
    appointments,
    messages,
    handleSidebarClick,
    setSelectedClientId,
    setActiveTab,
    setClientRecordTab,
    openBookingModal,
  } = useAdminContext();

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments
    .filter(a => a.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const assessmentQueue = filteredClients.filter(c => c.status === 'Assessment Submitted');
  const activeClients = filteredClients.filter(c =>
    c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted',
  );
  const unreadFromClients = messages.filter(m => m.senderId !== 'admin' && !m.read);

  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const newClients7d = filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() < ms7d).length;
  const bookings7d = filteredAppointments.filter(a => a.createdAt && now - new Date(a.createdAt).getTime() < ms7d).length;
  const messages7d = messages.filter(m => m.createdAt && now - new Date(m.createdAt).getTime() < ms7d).length;

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <PageHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Button variant="primary" leadingIcon={<CalendarDays size={14} />} onClick={() => openBookingModal()}>
            Book appointment
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Assessments to review"
          value={assessmentQueue.length}
          icon={<ClipboardList size={16} />}
          onClick={() => handleSidebarClick('assessments')}
        />
        <Stat
          label="Appointments today"
          value={todayAppointments.length}
          icon={<CalendarIcon size={16} />}
          onClick={() => handleSidebarClick('appointments')}
        />
        <Stat
          label="Active clients"
          value={activeClients.length}
          icon={<Users size={16} />}
          onClick={() => handleSidebarClick('clients')}
        />
        <Stat
          label="Unread messages"
          value={unreadFromClients.length}
          icon={<MessageSquare size={16} />}
          onClick={() => handleSidebarClick('messages')}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's schedule */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Today's appointments"
              subtitle={`${todayAppointments.length} session${todayAppointments.length !== 1 ? 's' : ''} scheduled`}
              leadingIcon={<CalendarDays size={16} />}
              trailing={
                <Button variant="ghost" size="sm" trailingIcon={<ArrowRight size={13} />} onClick={() => setActiveTab('appointments')}>
                  Full schedule
                </Button>
              }
            />
            {todayAppointments.length > 0 ? (
              <div className="flex flex-col">
                {todayAppointments.map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => { setSelectedClientId(apt.clientId); setActiveTab('clients'); }}
                    className="flex items-center justify-between gap-4 p-2.5 -mx-2 rounded-md hover:bg-cream transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center shrink-0 w-12">
                        <p className="text-sm font-medium text-obsidian leading-tight font-mono">{apt.time?.split(' ')[0]}</p>
                        <p className="text-xs text-hint">{apt.time?.split(' ')[1]}</p>
                      </div>
                      <div className="divider-v h-7" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-obsidian truncate">{apt.clientName}</p>
                        <p className="text-xs text-muted truncate">{apt.type}</p>
                      </div>
                    </div>
                    <StatusBadge status={apt.status} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarX2 size={16} />}
                title="No sessions today"
                description="Booked appointments will appear here."
                compact
              />
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card tone="dark">
              <CardHeader
                title={<span className="text-white">Triage queue</span>}
                subtitle={<span className="text-white/60">Awaiting clinical review</span>}
                leadingIcon={<AlertCircle size={16} className="text-primary" />}
                className="!text-white"
              />
              <div className="flex flex-col gap-2">
                {assessmentQueue.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name}</p>
                      <p className="text-xs text-white/50 font-mono">{c.id}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedClientId(c.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                      className="text-xs text-primary hover:text-white transition-colors font-medium shrink-0"
                    >
                      Review →
                    </button>
                  </div>
                ))}
                {assessmentQueue.length === 0 && (
                  <p className="text-xs text-white/40">No pending assessments.</p>
                )}
                {assessmentQueue.length > 3 && (
                  <button
                    onClick={() => setActiveTab('assessments')}
                    className="text-xs text-primary hover:text-white transition-colors text-left mt-1"
                  >
                    View all {assessmentQueue.length} →
                  </button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Recent messages"
                subtitle={`${unreadFromClients.length} unread`}
                leadingIcon={<MessageSquare size={16} />}
              />
              <div className="flex flex-col gap-2">
                {unreadFromClients.slice(0, 3).map(m => (
                  <div key={m.id} className="border border-sand rounded-md px-3 py-2.5 bg-ivory">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-obsidian truncate">{m.subject || 'Message'}</p>
                      <span className="text-xs text-hint shrink-0 ml-2">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2">{m.body}</p>
                  </div>
                ))}
                {unreadFromClients.length === 0 && (
                  <p className="text-xs text-muted">All caught up.</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right column: Quick actions + week stats */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="flex flex-col gap-1.5">
              <Button variant="ghost" fullWidth leadingIcon={<CalendarDays size={14} />} onClick={() => openBookingModal()} className="!justify-start">
                Book appointment
              </Button>
              <Button variant="ghost" fullWidth leadingIcon={<UserPlus size={14} />} onClick={() => setActiveTab('clients')} className="!justify-start">
                Open client registry
              </Button>
              <Button variant="ghost" fullWidth leadingIcon={<Send size={14} />} onClick={() => setActiveTab('messages')} className="!justify-start">
                Send a message
              </Button>
              <Button variant="ghost" fullWidth leadingIcon={<ClipboardList size={14} />} onClick={() => setActiveTab('assessments')} className="!justify-start">
                Review assessments
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="This week" subtitle="Past 7 days" />
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">New clients</span>
                <span className="text-sm font-medium text-obsidian">{newClients7d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Bookings</span>
                <span className="text-sm font-medium text-obsidian">{bookings7d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Messages</span>
                <span className="text-sm font-medium text-obsidian">{messages7d}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default memo(OverviewPanel);
