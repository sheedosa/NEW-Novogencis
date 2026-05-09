import React, { memo } from 'react';
import { useAdminContext } from '../context';
import { Card } from '../../../components/Card';
import { FORMS } from '../../../constants';
import { CalendarDays, CalendarX2, AlertCircle, MessageSquare, ArrowRight, UserPlus, Send } from 'lucide-react';

function OverviewPanel() {
  const {
    filteredClients,
    filteredAppointments,
    appointments,
    messages,
    mockStats,
    handleSidebarClick,
    notifications,
    setSelectedClientId,
    setActiveTab,
    setClientRecordTab,
    getInitials,
    setTriageSelectedId,
    openBookingModal,
  } = useAdminContext();

  return (
    <div className="animate-fade-up space-y-6 md:space-y-10">
      {/* Clinical Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-medium text-obsidian">Clinic Overview</h1>
          <p className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-[0.2em] mt-1">Status Report for {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex bg-cream p-1 rounded-xl border border-black/5">
              <div className="px-4 py-2 flex flex-col items-center border-r border-black/5">
                 <span className="text-[8px] font-medium text-muted uppercase mb-0.5">Queue</span>
                 <span className="text-xs font-medium text-primary">{filteredClients.filter(c => c.status === 'Assessment Submitted').length}</span>
              </div>
              <div className="px-4 py-2 flex flex-col items-center">
                 <span className="text-[8px] font-medium text-muted uppercase mb-0.5">Today</span>
                 <span className="text-xs font-medium text-clinical-dark">{appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length}</span>
              </div>
           </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {mockStats.map((stat, i) => (
          <button
            key={i}
            onClick={() => handleSidebarClick(stat.tab)}
            className="card-clinical p-4 md:p-6 flex flex-col gap-3 md:gap-4 text-left group hover:translate-y-[-2px] transition-all"
          >
            <div className="w-10 h-10 bg-cream rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-xl">{stat.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-medium text-obsidian leading-none mb-1">{stat.value}</p>
              <p className="text-[9px] font-medium text-muted uppercase truncate">{stat.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* Left Column: Schedule & Tasks */}
        <div className="lg:col-span-8 space-y-6 md:space-y-10">
          <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
            <div className="p-6 md:p-8 border-b border-gray-50 flex justify-between items-center bg-cream/30">
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-primary" />
                <h3 className="text-[10px] md:text-xs font-medium text-obsidian uppercase">Today's Appointments</h3>
              </div>
              <button onClick={() => setActiveTab('appointments')} className="text-[10px] font-medium text-primary uppercase hover:underline flex items-center gap-2">
                Full Schedule
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {appointments
                .filter(a => a.date === new Date().toISOString().split('T')[0])
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                .map((apt, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-cream rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-black/5">
                    <div className="flex items-center gap-6 md:gap-8 min-w-0">
                      <div className="text-center shrink-0 w-14">
                        <p className="text-[11px] font-medium text-primary font-mono leading-none">{apt.time?.split(' ')[0]}</p>
                        <p className="text-[8px] font-bold text-muted uppercase tracking-tighter">{apt.time?.split(' ')[1]}</p>
                      </div>
                      <div className="h-8 w-[1px] bg-black/5 shrink-0" />
                      <div className="min-w-0">
                         <p className="text-sm font-medium text-obsidian group-hover:text-primary transition-colors truncate">{apt.clientName}</p>
                         <p className="text-[9px] font-bold text-muted uppercase truncate">{apt.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-medium uppercase ${apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-cream text-muted'}`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              {appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length === 0 && (
                <div className="py-20 text-center">
                  <CalendarX2 size={40} className="text-primary/10 mb-3 mx-auto" />
                  <p className="text-2xs font-medium text-hint text-muted">No clinical sessions today</p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6 md:p-8 bg-obsidian text-white rounded-[2rem]">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <AlertCircle size={18} className="text-primary" />
                   </div>
                   <h3 className="text-2xs font-medium text-hint text-gray-400">High Priority Triage</h3>
                </div>
                <div className="space-y-4">
                   {filteredClients.filter(c => c.status === 'Assessment Submitted').slice(0, 3).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                         <div className="min-w-0">
                            <p className="text-[11px] font-medium truncate">{c.name}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">ID: {c.id}</p>
                         </div>
                         <button onClick={() => { setSelectedClientId(c.id); setActiveTab('clients'); setClientRecordTab('assessment'); }} className="text-[9px] font-medium text-primary uppercase">Review</button>
                      </div>
                   ))}
                   {filteredClients.filter(c => c.status === 'Assessment Submitted').length === 0 && (
                      <p className="text-[10px] text-gray-500 font-bold italic">No pending assessments</p>
                   )}
                </div>
             </Card>

             <Card className="p-6 md:p-8 bg-cream rounded-[2rem] border-black/5">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                      <MessageSquare size={18} />
                   </div>
                   <h3 className="text-2xs font-medium text-hint text-muted">Recent Messages</h3>
                </div>
                <div className="space-y-4">
                   {messages.filter(m => m.senderId !== 'admin' && !m.read).slice(0, 3).map(m => (
                      <div key={m.id} className="flex flex-col p-3 bg-white rounded-xl border border-black/5">
                         <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-medium text-obsidian">{m.subject || 'Message'}</p>
                            <span className="text-[8px] text-muted font-bold">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                         <p className="text-[10px] text-muted line-clamp-1">{m.body}</p>
                      </div>
                   ))}
                   {messages.filter(m => m.senderId !== 'admin' && !m.read).length === 0 && (
                      <p className="text-[10px] text-muted font-bold italic">No unread messages</p>
                   )}
                </div>
             </Card>
          </div>
        </div>

        {/* Right Column: Action Center */}
        <div className="lg:col-span-4 space-y-6">
           <div className="card-clinical p-8 flex flex-col gap-8 h-full bg-gradient-to-br from-white to-bg-soft/50">
              <div>
                 <h3 className="text-xs font-medium text-muted mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Action Center
                 </h3>
                 <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => openBookingModal()} className="w-full flex items-center gap-4 p-5 bg-white hover:bg-primary transition-all rounded-2xl border border-black/5 group shadow-sm">
                       <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-white group-hover:text-primary transition-colors">
                          <CalendarDays size={18} />
                       </div>
                       <span className="text-xs font-medium group-hover:text-clinical-dark transition-colors">Book Appointment</span>
                    </button>
                    <button onClick={() => setActiveTab('clients')} className="w-full flex items-center gap-4 p-5 bg-white hover:bg-obsidian hover:text-white transition-all rounded-2xl border border-black/5 group shadow-sm">
                       <div className="w-12 h-12 bg-cream rounded-xl flex items-center justify-center text-muted group-hover:bg-white/10 group-hover:text-white transition-colors">
                          <UserPlus size={18} />
                       </div>
                       <span className="text-xs font-medium">Client Registry</span>
                    </button>
                    <button onClick={() => setActiveTab('messages')} className="w-full flex items-center gap-4 p-5 bg-white hover:bg-obsidian hover:text-white transition-all rounded-2xl border border-black/5 group shadow-sm">
                       <div className="w-12 h-12 bg-cream rounded-xl flex items-center justify-center text-muted group-hover:bg-white/10 group-hover:text-white transition-colors">
                          <Send size={18} />
                       </div>
                       <span className="text-xs font-medium">Messages</span>
                    </button>
                 </div>
              </div>

              <div className="mt-auto">
                 <h3 className="text-2xs font-medium text-hint text-muted mb-4">This Week</h3>
                 <div className="p-5 bg-white rounded-2xl border border-black/5 space-y-3">
                    {(() => {
                       const now = Date.now();
                       const ms7d = 7 * 24 * 60 * 60 * 1000;
                       const newClients7d = filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() < ms7d).length;
                       const apt7d = filteredAppointments.filter(a => a.createdAt && now - new Date(a.createdAt).getTime() < ms7d).length;
                       const msg7d = messages.filter(m => m.createdAt && now - new Date(m.createdAt).getTime() < ms7d).length;
                       return (
                          <>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-muted uppercase">New Clients</span>
                                <span className="text-[10px] font-medium text-obsidian">{newClients7d}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-muted uppercase">Bookings</span>
                                <span className="text-[10px] font-medium text-obsidian">{apt7d}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-muted uppercase">Messages</span>
                                <span className="text-[10px] font-medium text-obsidian">{msg7d}</span>
                             </div>
                          </>
                       );
                    })()}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default memo(OverviewPanel);
