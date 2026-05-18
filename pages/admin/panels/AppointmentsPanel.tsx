import React, { memo } from 'react';
import { useAdminContext } from '../context';
import {
  ChevronLeft, ChevronRight, CheckCircle, Trash2,
  CalendarDays, Users as UsersIcon, User as UserIcon, Plus,
} from 'lucide-react';
import {
  PageHeader, Card, Button, StatusBadge, EmptyState,
} from '../../../components/ui';

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

  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
  );

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} scheduled`}
        actions={
          <>
            {user?.adminType !== 'technical' && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={showOnlyAssigned ? <UserIcon size={13} /> : <UsersIcon size={13} />}
                onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
              >
                {showOnlyAssigned ? 'My appointments' : 'All appointments'}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={13} />}
              onClick={() => openBookingModal()}
            >
              Book appointment
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <div className="px-4 py-3 border-b border-sand flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="btn-icon" aria-label="Previous month">
              <ChevronLeft size={14} />
            </button>
            <h3 className="text-sm font-medium text-obsidian min-w-[140px] text-center">
              {currentCalendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => changeMonth(1)} className="btn-icon" aria-label="Next month">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-0.5 bg-cream p-0.5 rounded-md">
            <button
              onClick={() => setAppointmentView('list')}
              className={`px-3 py-1 rounded-sm text-sm transition-colors ${appointmentView === 'list' ? 'bg-white text-obsidian shadow-sm' : 'text-muted'}`}
            >
              List
            </button>
            <button
              onClick={() => setAppointmentView('calendar')}
              className={`px-3 py-1 rounded-sm text-sm transition-colors ${appointmentView === 'calendar' ? 'bg-white text-obsidian shadow-sm' : 'text-muted'}`}
            >
              Calendar
            </button>
          </div>
        </div>

        {appointmentView === 'list' ? (
          sortedAppointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={16} />}
              title="No appointments"
              description="Booked sessions will appear here."
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="lg:hidden flex flex-col">
                {sortedAppointments.map((apt) => (
                  <div key={apt.id} className="px-4 py-3 border-b border-cream flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="avatar avatar-md">{getInitials(apt.clientName)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">{apt.clientName}</p>
                          <p className="text-xs text-muted truncate">{apt.type}</p>
                        </div>
                      </div>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-cream">
                      <div className="text-xs text-muted">
                        <span className="text-obsidian font-medium">
                          {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                        {' · '}{apt.time}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onUpdateAppointment(apt.id, { status: apt.status === 'Confirmed' ? 'Completed' : 'Confirmed' })}
                          className="btn-icon"
                          aria-label="Toggle status"
                        >
                          <CheckCircle size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteAppointment(apt.id)}
                          className="btn-icon hover:!text-danger"
                          aria-label="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Client & treatment</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAppointments.map((apt) => (
                      <tr key={apt.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="avatar avatar-sm">{getInitials(apt.clientName)}</div>
                            <div>
                              <p className="text-sm font-medium text-obsidian">{apt.clientName}</p>
                              <p className="text-xs text-muted">{apt.type}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-obsidian">
                            {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-muted ml-2">{apt.time}</span>
                        </td>
                        <td>
                          <StatusBadge status={apt.status} />
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => onUpdateAppointment(apt.id, { status: apt.status === 'Confirmed' ? 'Completed' : 'Confirmed' })}
                              className="btn-icon"
                              title="Toggle status"
                            >
                              <CheckCircle size={13} />
                            </button>
                            <button
                              onClick={() => onDeleteAppointment(apt.id)}
                              className="btn-icon hover:!text-danger"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : (
          <div className="p-2 overflow-x-auto">
            <div className="min-w-[600px] grid grid-cols-7 gap-px bg-sand border border-sand rounded-md overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-cream py-2 text-center">
                  <span className="text-xs font-medium text-muted">{day}</span>
                </div>
              ))}
              {getCalendarDays().map((dateObj, i) => {
                const dateStr = `${dateObj.year}-${String(dateObj.month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
                const dayAppointments = appointments.filter(a => a.date === dateStr);
                const isToday =
                  dateObj.day === new Date().getDate() &&
                  dateObj.month === new Date().getMonth() &&
                  dateObj.year === new Date().getFullYear();
                return (
                  <div
                    key={i}
                    className={`bg-white min-h-[100px] p-2 transition-colors hover:bg-cream/40 ${!dateObj.currentMonth ? 'opacity-40' : ''}`}
                  >
                    <span className={`text-xs ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-obsidian text-white font-medium' : 'text-muted'}`}>
                      {dateObj.day}
                    </span>
                    <div className="mt-1.5 flex flex-col gap-1">
                      {dayAppointments.map(apt => {
                        const variant =
                          apt.status === 'Completed' ? 'bg-info-bg text-info-text' :
                          apt.status === 'Confirmed' ? 'bg-success-bg text-success-text' :
                          'bg-warning-bg text-warning-text';
                        return (
                          <div
                            key={apt.id}
                            className={`px-1.5 py-0.5 rounded-sm text-xs truncate ${variant}`}
                            title={`${apt.time} - ${apt.clientName} (${apt.type})`}
                          >
                            {apt.time?.split(' ')[0] || apt.time} {getFirstName(apt.clientName)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default memo(AppointmentsPanel);
