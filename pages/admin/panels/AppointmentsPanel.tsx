import React, { memo } from 'react';
import { Card } from '../../../components/Card';
import { useAdminContext } from '../context';
import { StatusBadge } from '../AdminComponents';
import { ChevronLeft, ChevronRight, CheckCircle, Trash2 } from 'lucide-react';

const AppointmentsPanel: React.FC = () => {
  const {
    user,
    appointments,
    showOnlyAssigned, setShowOnlyAssigned,
    appointmentView, setAppointmentView,
    currentCalendarDate,
    getInitials, getFirstName,
    openBookingModal,
    onUpdateAppointment, onDeleteAppointment,
    changeMonth, getCalendarDays,
  } = useAdminContext();

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="page-eyebrow">Schedule</p>
          <h2 className="page-title">Appointments</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {user?.adminType !== 'technical' && (
            <button
              onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
              className={`btn btn-sm ${showOnlyAssigned ? 'btn-primary' : 'btn-ghost'}`}
            >
              {showOnlyAssigned ? 'My assignments' : 'All appointments'}
            </button>
          )}
          <button onClick={() => openBookingModal()} className="btn btn-primary btn-sm">
            Book appointment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        <div className="lg:col-span-12">
          <Card className="md:border-none md:bg-transparent md:shadow-none">
            <div className="flex p-4 md:p-8 bg-white rounded-t-2xl md:rounded-t-[2.5rem] border border-black/5 md:border-b-0 justify-between items-center gap-4 mb-2 md:mb-0">
              <div className="flex items-center gap-2 md:gap-4">
                <button onClick={() => changeMonth(-1)} className="p-1.5 md:p-2 hover:bg-cream rounded-lg transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-[10px] md:text-sm font-medium uppercase text-obsidian">
                  {currentCalendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeMonth(1)} className="p-1.5 md:p-2 hover:bg-cream rounded-lg transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex bg-cream p-1 rounded-xl">
                <button
                  onClick={() => setAppointmentView('list')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-2xs font-medium text-hint transition-all ${appointmentView === 'list' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                >List</button>
                <button
                  onClick={() => setAppointmentView('calendar')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-2xs font-medium text-hint transition-all ${appointmentView === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                >Cal</button>
              </div>
            </div>

            {appointmentView === 'list' ? (
              <>
                {/* Mobile Card View */}
                <div className="grid grid-cols-1 gap-4 lg:hidden">
                  {appointments
                    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                    .map((apt) => (
                      <div key={apt.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-[10px]">
                              {getInitials(apt.clientName)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-obsidian">{apt.clientName}</p>
                              <p className="text-[9px] font-bold text-muted uppercase">{apt.type}</p>
                            </div>
                          </div>
                          <StatusBadge status={apt.status} />
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-medium text-primary uppercase">Schedule</span>
                            <span className="text-[11px] font-bold text-obsidian">
                              {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {apt.time}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => onUpdateAppointment(apt.id, { status: apt.status === 'Confirmed' ? 'Completed' : 'Confirmed' })}
                              className="p-2 bg-cream text-muted rounded-xl hover:text-primary transition-colors"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button
                              onClick={() => onDeleteAppointment(apt.id)}
                              className="p-2 bg-cream text-muted rounded-xl hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white rounded-b-[2.5rem] border border-black/5 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-cream text-[10px] font-medium text-muted uppercase border-b border-black/5">
                        <tr>
                          <th className="px-8 py-5">Client &amp; Treatment</th>
                          <th className="px-8 py-5">Schedule &amp; Status</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {appointments
                          .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                          .map((apt) => (
                            <tr key={apt.id} className="hover:bg-cream/40 transition-colors group">
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-[9px]">
                                    {getInitials(apt.clientName)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-obsidian">{apt.clientName}</span>
                                    <span className="text-[10px] font-bold text-muted uppercase mt-1">{apt.type}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex flex-col items-start gap-2">
                                  <div>
                                    <span className="text-sm font-medium text-obsidian">
                                      {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className="text-[10px] font-bold text-muted uppercase ml-2">{apt.time}</span>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-[8px] font-medium uppercase ${
                                    apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                    apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                    apt.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {apt.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => onUpdateAppointment(apt.id, { status: apt.status === 'Confirmed' ? 'Completed' : 'Confirmed' })}
                                    className="p-2 text-muted hover:text-primary transition-colors"
                                    title="Toggle Status"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                  <button
                                    onClick={() => onDeleteAppointment(apt.id)}
                                    className="p-2 text-muted hover:text-red-500 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-b-2xl md:rounded-b-[2.5rem] border border-black/5 shadow-sm p-2 md:p-8 overflow-x-auto no-scrollbar">
                <div className="min-w-[600px] md:min-w-0 grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-cream py-3 text-center">
                      <span className="text-[9px] md:text-2xs font-medium text-hint text-muted">{day}</span>
                    </div>
                  ))}
                  {getCalendarDays().map((dateObj, i) => {
                    const dateStr = `${dateObj.year}-${String(dateObj.month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
                    const dayAppointments = appointments.filter(a => a.date === dateStr);
                    return (
                      <div
                        key={i}
                        className={`bg-white min-h-[80px] md:min-h-[140px] p-1.5 md:p-4 transition-all hover:bg-cream/50 ${!dateObj.currentMonth ? 'opacity-30' : ''}`}
                      >
                        <span className={`text-[10px] md:text-xs font-medium ${
                          dateObj.day === new Date().getDate() &&
                          dateObj.month === new Date().getMonth() &&
                          dateObj.year === new Date().getFullYear()
                            ? 'text-primary' : 'text-muted'
                        }`}>
                          {dateObj.day}
                        </span>
                        <div className="mt-1 md:mt-2 space-y-1">
                          {dayAppointments.map(apt => (
                            <div
                              key={apt.id}
                              className={`p-1 rounded-lg text-[7px] md:text-[8px] font-bold truncate border ${
                                apt.status === 'Completed' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                apt.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-100' :
                                'bg-yellow-50 text-yellow-700 border-yellow-100'
                              }`}
                              title={`${apt.time} - ${apt.clientName}`}
                            >
                              {apt.time?.split(' ')[0] || apt.time} {getFirstName(apt.clientName)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default memo(AppointmentsPanel);
