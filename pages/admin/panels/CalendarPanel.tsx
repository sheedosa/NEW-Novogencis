import React, { memo, useState, useMemo } from 'react';
import { useAdminContext } from '../context';
import type { Appointment } from '../../../types';
import { parseTime12hParts as parseTime12h, localTodayISO } from '../../../utils/time';

/** Local YYYY-MM-DD for a Date — matches how appointment.date is stored, and
 *  avoids the UTC roll-back toISOString() causes near midnight during BST. */
const isoLocal = (d: Date) => d.toLocaleDateString('en-CA');
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  List, LayoutGrid, Users as UsersIcon, User as UserIcon, Filter,
  Clock, CheckCircle, X as XIcon, Trash2, StickyNote, Pencil,
} from 'lucide-react';
import AppointmentNotesDrawer from '../AppointmentNotesDrawer';
import {
  PageHeader, Card, Button, StatusBadge, EmptyState, Badge, Modal, useConfirm, useToast, RowActions,
} from '../../../components/ui';
import type { RowAction } from '../../../components/ui';

type View = 'week' | 'day' | 'list';
type DoctorFilter = 'all' | 'female' | 'male' | 'mine';
type TypeFilter = 'all' | 'PRP + Microneedling' | 'PRF + Microneedling' | 'EV Enriched Plasma / Autologous Exosomes + Microneedling' | 'Face to Face Consultation' | 'Initial Consultation' | 'Follow-up Consultation';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];  // 09:00–22:00
const SLOT_HEIGHT = 60;                                     // px per hour row
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Get the Monday-anchored 7-day range that contains `date`.
 */
function getWeekDates(date: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(date);
  const dayIdx = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dayIdx);
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    out.push(x);
  }
  return out;
}

// parseTime12h (returns { h, m }) is imported from utils/time as parseTime12hParts.

function CalendarPanel() {
  const {
    user,
    filteredAppointments,
    openBookingModal,
    onUpdateAppointment,
    onDeleteAppointment,
    appointments,
    clinicians,
    getFirstName,
    openPatient,
    onAddPayment,
  } = useAdminContext();

  // Jump straight to a patient's Money tab when their deposit-pending badge
  // is clicked. Saves the doctor a navigation when chasing deposits.
  const jumpToPatientMoney = (clientId: string) => openPatient(clientId, 'financials');

  const { confirm, ConfirmHost } = useConfirm();
  const { toast } = useToast();
  const [notesAppt, setNotesAppt] = useState<Appointment | null>(null);

  // Edit-appointment modal (date/time/clinician/notes) straight from the schedule.
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ date: '', time: '', clinicianId: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);
  const openEdit = (apt: Appointment) => {
    setEditAppt(apt);
    setEditForm({ date: apt.date, time: apt.time, clinicianId: apt.clinicianId || '', notes: apt.notes || '' });
  };
  const timeToMins = (t: string) => { const p = parseTime12h(t); return p ? p.h * 60 + p.m : null; };
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAppt || !editForm.date || !editForm.time || editSaving) return;
    const clinicianId = editForm.clinicianId || editAppt.clinicianId;
    const start = timeToMins(editForm.time);
    if (clinicianId && start !== null) {
      const end = start + (editAppt.durationMin ?? 30);
      const clash = appointments.find(a => {
        if (a.id === editAppt.id || a.clinicianId !== clinicianId || a.date !== editForm.date) return false;
        if (a.status === 'Cancelled' || a.status === 'No-Show') return false;
        const aStart = timeToMins(a.time);
        return aStart !== null && start < aStart + (a.durationMin ?? 30) && end > aStart;
      });
      if (clash) {
        toast.error('Scheduling conflict', { description: `${clash.doctorName ?? 'This clinician'} already has ${clash.time} on ${clash.date}. Pick another time.`, duration: 8000 });
        return;
      }
    }
    setEditSaving(true);
    try {
      const clin = clinicians.find(c => c.id === editForm.clinicianId);
      await onUpdateAppointment(editAppt.id, {
        date: editForm.date,
        time: editForm.time,
        clinicianId: editForm.clinicianId || undefined,
        ...(clin ? { doctorId: clin.id, doctorName: clin.name } : {}),
        notes: editForm.notes,
      });
      setEditAppt(null);
    } catch {
      toast.error('Could not save the changes', { description: 'Please try again.' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string, clientName: string) => {
    const ok = await confirm({
      title: 'Delete this appointment?',
      description: `This will permanently remove ${clientName}'s appointment. This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await onDeleteAppointment(id);
    } catch {
      toast.error('Could not delete the appointment', { description: 'It is still on the schedule — please try again.' });
    }
  };

  // Soft-cancel: keeps the booking in the record but marks it Cancelled and
  // frees the slot. This is the clear, reversible alternative to a hard delete.
  const cancelBooking = async (apt: Appointment) => {
    if (apt.status === 'Cancelled') return;
    const ok = await confirm({
      title: 'Cancel this booking?',
      description: `${apt.clientName}'s ${apt.type} on ${apt.date} at ${apt.time} will be marked Cancelled and the slot freed. The booking stays in the record.`,
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

  // One consistent action set for every appointment surface (grid rows, list, agenda).
  const apptActions = (apt: Appointment): RowAction[] => [
    { label: 'Edit / reschedule', icon: <Pencil size={13} />, onClick: () => openEdit(apt) },
    { label: 'Notes & status', icon: <StickyNote size={13} />, onClick: () => setNotesAppt(apt) },
    ...(apt.status !== 'Cancelled'
      ? [{ label: 'Cancel booking', icon: <XIcon size={13} />, onClick: () => cancelBooking(apt), danger: true } as RowAction]
      : []),
    { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => handleDelete(apt.id, apt.clientName), danger: true },
  ];

  // Default to day view below 768px — matches the Week toggle's `md:` visibility
  // so a small-tablet user is never defaulted into a view whose button is hidden.
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return 'day';
    }
    return 'week';
  });
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [cursor, setCursor] = useState(new Date());

  // Apply filters
  const visible = useMemo(() => {
    return filteredAppointments.filter(a => {
      if (a.status === 'Cancelled') return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (doctorFilter === 'mine' && a.doctorId !== user?.id) return false;
      if (doctorFilter === 'female') {
        // Match doctor by name fallback (no adminType on appointment record)
        const isFemale = a.doctorName?.toLowerCase().includes('aminah');
        if (!isFemale) return false;
      }
      if (doctorFilter === 'male') {
        const isMale = a.doctorName?.toLowerCase().includes('waqas');
        if (!isMale) return false;
      }
      return true;
    });
  }, [filteredAppointments, doctorFilter, typeFilter, user]);

  const weekDates = useMemo(() => getWeekDates(cursor), [cursor]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const todayStr = localTodayISO();

  // Bucket appointments by date for the visible week
  const byDate = useMemo(() => {
    const buckets: Record<string, typeof visible> = {};
    weekDates.forEach(d => {
      const key = isoLocal(d);
      buckets[key] = visible.filter(a => a.date === key);
    });
    return buckets;
  }, [visible, weekDates]);

  // List view (when view === 'list'): sorted forward from today
  const listView = useMemo(() => {
    return visible
      .filter(a => new Date(a.date) >= new Date(todayStr))
      .sort((a, b) => {
        const ka = `${a.date} ${a.time}`;
        const kb = `${b.date} ${b.time}`;
        return ka.localeCompare(kb);
      });
  }, [visible, todayStr]);

  const colorFor = (doctorName?: string) => {
    // Two-doctor differentiation using the organic chart palette.
    // Sage for Aminah, terracotta for Waqas, cream for unassigned.
    if (!doctorName) return { bg: 'bg-cream', text: 'text-obsidian', border: 'border-sand' };
    if (doctorName.toLowerCase().includes('aminah')) {
      return { bg: 'bg-chart-sage/15', text: 'text-obsidian', border: 'border-chart-sage/35' };
    }
    if (doctorName.toLowerCase().includes('waqas')) {
      return { bg: 'bg-chart-terracotta/15', text: 'text-obsidian', border: 'border-chart-terracotta/35' };
    }
    return { bg: 'bg-cream', text: 'text-obsidian', border: 'border-sand' };
  };

  const stepWeek = (offset: number) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + offset * 7);
    setCursor(d);
  };

  const stepDay = (offset: number) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + offset);
    setCursor(d);
  };

  const dayDateStr = isoLocal(cursor);
  const dayAppointments = (byDate[dayDateStr] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <div className="animate-fade-up page-stack">
      {ConfirmHost}
      <PageHeader
        title="Schedule"
        subtitle={
          view === 'week'
            ? `${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : view === 'day'
              ? cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Upcoming appointments'
        }
        actions={
          <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => openBookingModal()}>
            Book appointment
          </Button>
        }
      />

      {/* Toolbar: nav + view switcher + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Date nav + Today */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => view === 'day' ? stepDay(-1) : stepWeek(-1)}
            className="btn-icon"
            aria-label="Previous"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="btn btn-ghost btn-sm"
          >
            Today
          </button>
          <button
            onClick={() => view === 'day' ? stepDay(1) : stepWeek(1)}
            className="btn-icon"
            aria-label="Next"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* View switcher */}
        <div className="flex gap-0.5 bg-cream p-0.5 rounded-md">
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 ${
              view === 'day' ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted'
            }`}
          >
            <CalendarIcon size={13} /> Day
          </button>
          <button
            onClick={() => setView('week')}
            className={`hidden md:inline-flex px-3 py-1 rounded-sm text-sm transition-colors items-center gap-1.5 ${
              view === 'week' ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted'
            }`}
          >
            <LayoutGrid size={13} /> Week
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 ${
              view === 'list' ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted'
            }`}
          >
            <List size={13} /> List
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1 sm:ml-auto">
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value as DoctorFilter)}
            className="text-sm rounded-md border-sand bg-white px-2 py-1.5 cursor-pointer"
          >
            <option value="all">All clinicians</option>
            <option value="mine">My patients</option>
            <option value="female">Dr Aminah</option>
            <option value="male">Dr Waqas</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="text-sm rounded-md border-sand bg-white px-2 py-1.5 cursor-pointer"
          >
            <option value="all">All types</option>
            <option value="PRP + Microneedling">PRP + Microneedling</option>
            <option value="PRF + Microneedling">PRF + Microneedling</option>
            <option value="EV Enriched Plasma / Autologous Exosomes + Microneedling">Exosome + Microneedling</option>
            <option value="Face to Face Consultation">Consultation</option>
            <option value="Initial Consultation">Initial consult</option>
            <option value="Follow-up Consultation">Follow-up consult</option>
          </select>
        </div>
      </div>

      {/* Load strap — answers "how busy am I" at a glance without leaving Schedule */}
      {(() => {
        const todayStr = new Date().toDateString();
        const sow = new Date(); sow.setHours(0, 0, 0, 0); sow.setDate(sow.getDate() - ((sow.getDay() + 6) % 7));
        const eow = new Date(sow); eow.setDate(sow.getDate() + 7);
        const todayCount = visible.filter(a => new Date(a.date).toDateString() === todayStr).length;
        const weekCount = visible.filter(a => { const d = new Date(a.date); return d >= sow && d < eow; }).length;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted px-1">
            <span><span className="text-obsidian font-medium">{todayCount}</span> {todayCount === 1 ? 'session' : 'sessions'} today</span>
            <span className="text-hint">·</span>
            <span><span className="text-obsidian font-medium">{weekCount}</span> this week</span>
          </div>
        );
      })()}

      {/* Workload heatmap moved to Practice → Operations (single source of truth).
          Schedule is for scheduling; Operations is for measuring capacity. */}

      {/* ── Week view (desktop only) ───────────────────────────────────── */}
      {view === 'week' && (
        <Card padded={false} className="hidden md:block">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] sm:min-w-[800px]">
              {/* Header row: days */}
              <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b border-sand">
                <div className="px-2 py-2 text-xs text-hint"></div>
                {weekDates.map((d, i) => {
                  const dStr = isoLocal(d);
                  const isToday = dStr === todayStr;
                  return (
                    <div key={i} className={`px-2 py-2 text-center border-l border-cream ${isToday ? 'bg-primary/5' : ''}`}>
                      <p className="text-xs text-muted">{DAY_NAMES[i]}</p>
                      <p className={`text-base font-medium leading-tight mt-0.5 ${isToday ? 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-obsidian text-white' : 'text-obsidian'}`}>
                        {d.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Grid: hours × days */}
              <div className="relative" style={{ height: `${HOURS.length * SLOT_HEIGHT}px` }}>
                {/* Hour rows (background) */}
                <div className="absolute inset-0 grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] grid-rows-[repeat(14,60px)]">
                  {HOURS.map((h, hi) =>
                    [-1, 0, 1, 2, 3, 4, 5, 6].map(col =>
                      col === -1 ? (
                        <div key={`time-${hi}`} className="text-xs text-hint pr-2 text-right pt-1 -translate-y-1.5">
                          {h <= 12 ? `${h}:00 ${h < 12 ? 'am' : 'pm'}` : `${h - 12}:00 pm`}
                        </div>
                      ) : (
                        <div
                          key={`cell-${hi}-${col}`}
                          className="border-t border-l border-cream cursor-pointer hover:bg-cream/40 transition-colors"
                          onClick={() => {
                            const targetDate = weekDates[col];
                            const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            const dateStr = isoLocal(targetDate);
                            const timeStr = `${String(hour12).padStart(2, '0')}:00 ${ampm}`;
                            openBookingModal(undefined, { date: dateStr, time: timeStr });
                          }}
                          title={`${weekDates[col].toLocaleDateString('en-GB')} ${h}:00`}
                        />
                      ),
                    ),
                  )}
                </div>

                {/* Appointment blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dStr = isoLocal(date);
                  return (byDate[dStr] || []).map(apt => {
                    const t = parseTime12h(apt.time);
                    if (!t) return null;
                    const topPct = ((t.h - HOURS[0]) * 60 + t.m) / (HOURS.length * 60);
                    if (topPct < 0 || topPct > 1) return null;
                    const colWidth = `calc((100% - 60px) / 7)`;
                    const colors = colorFor(apt.doctorName);
                    return (
                      <div
                        key={apt.id}
                        className={`absolute ${colors.bg} ${colors.text} border ${colors.border} rounded-md px-1.5 py-1 cursor-pointer hover:shadow-card transition-all overflow-hidden`}
                        style={{
                          top: `${topPct * 100}%`,
                          left: `calc(60px + ${dayIdx} * ${colWidth} + 2px)`,
                          width: `calc(${colWidth} - 4px)`,
                          height: `${Math.max(24, ((apt.durationMin ?? 30) / 60) * SLOT_HEIGHT)}px`,
                        }}
                        onClick={() => openEdit(apt)}
                        title={`${apt.clientName} · ${apt.type} · ${apt.time} — click to edit, reschedule or cancel`}
                      >
                        <p className="text-xs font-medium truncate">{apt.time?.split(' ')[0]} {getFirstName(apt.clientName)}</p>
                        <p className="text-[10px] text-muted truncate">{apt.type}</p>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Week view (mobile agenda — stacked by day) ─────────────────── */}
      {view === 'week' && (
        <div className="md:hidden flex flex-col gap-3">
          {weekDates.map(d => {
            const ds = isoLocal(d);
            const toMinutes = (t: string) => {
              const p = parseTime12h(t);
              return p ? p.h * 60 + p.m : 0;
            };
            const dayAppts = (byDate[ds] || []).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
            const isToday = ds === localTodayISO();
            return (
              <Card key={ds} padded={false}>
                <div className={`px-4 py-2.5 border-b border-sand flex items-center justify-between ${isToday ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-obsidian'}`}>
                      {d.toLocaleDateString('en-GB', { weekday: 'long' })}
                    </span>
                    <span className="text-xs text-muted">
                      {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    {isToday && <span className="text-2xs uppercase tracking-wider text-primary font-medium">Today</span>}
                  </div>
                  <span className="text-xs text-hint">
                    {dayAppts.length} session{dayAppts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {dayAppts.length === 0 ? (
                  <div className="px-4 py-3 text-center">
                    <p className="text-xs text-hint">No appointments</p>
                  </div>
                ) : (
                  <div className="divide-y divide-cream">
                    {dayAppts.map(apt => (
                      <div key={apt.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="text-xs font-medium text-obsidian w-16 shrink-0">{apt.time}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">{apt.clientName}</p>
                          <p className="text-xs text-muted truncate">{apt.type}</p>
                        </div>
                        {apt.status === 'Awaiting deposit' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); jumpToPatientMoney(apt.clientId); }}
                            title="Open this patient's Money tab to chase the deposit"
                          >
                            <StatusBadge status={apt.status} />
                          </button>
                        ) : (
                          <StatusBadge status={apt.status} />
                        )}
                        <RowActions actions={apptActions(apt)} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Day view ───────────────────────────────────────────────────── */}
      {view === 'day' && (
        <Card padded={false}>
          {dayAppointments.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon size={16} />}
              title="No sessions on this day"
              description="Tap a slot below to start a new booking."
            />
          ) : null}
          <div className="relative" style={{ height: `${HOURS.length * SLOT_HEIGHT}px` }}>
            <div className="absolute inset-0 grid grid-cols-[40px_1fr] sm:grid-cols-[60px_1fr] grid-rows-[repeat(14,60px)]">
              {HOURS.map((h, hi) => (
                <React.Fragment key={hi}>
                  <div className="text-xs text-hint pr-2 text-right pt-1 -translate-y-1.5">
                    {h <= 12 ? `${h}:00 ${h < 12 ? 'am' : 'pm'}` : `${h - 12}:00 pm`}
                  </div>
                  <div
                    className="border-t border-l border-cream cursor-pointer hover:bg-cream/40 transition-colors"
                    onClick={() => {
                      const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      openBookingModal(undefined, {
                        date: dayDateStr,
                        time: `${String(hour12).padStart(2, '0')}:00 ${ampm}`,
                      });
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
            {dayAppointments.map(apt => {
              const t = parseTime12h(apt.time);
              if (!t) return null;
              const topPct = ((t.h - HOURS[0]) * 60 + t.m) / (HOURS.length * 60);
              if (topPct < 0 || topPct > 1) return null;
              const colors = colorFor(apt.doctorName);
              return (
                <div
                  key={apt.id}
                  className={`absolute ${colors.bg} ${colors.text} border ${colors.border} rounded-md px-3 py-2 cursor-pointer hover:shadow-card transition-all`}
                  style={{
                    top: `${topPct * 100}%`,
                    left: '64px',
                    right: '8px',
                    height: `${Math.max(36, ((apt.durationMin ?? 30) / 60) * SLOT_HEIGHT)}px`,
                  }}
                  onClick={() => openEdit(apt)}
                  title={`${apt.clientName} — click to edit, reschedule or cancel`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-obsidian truncate">{apt.time} · {apt.clientName}</p>
                      <p className="text-xs text-muted truncate">{apt.type} {apt.doctorName ? `· ${apt.doctorName}` : ''}</p>
                    </div>
                    {apt.status === 'Awaiting deposit' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); jumpToPatientMoney(apt.clientId); }}
                        title="Open this patient's Money tab to chase the deposit"
                      >
                        <StatusBadge status={apt.status} />
                      </button>
                    ) : (
                      <StatusBadge status={apt.status} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── List view ──────────────────────────────────────────────────── */}
      {view === 'list' && (
        <Card padded={false}>
          {listView.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon size={16} />}
              title="No upcoming appointments"
              description="Booked sessions from today onwards will appear here."
              action={
                <Button variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => openBookingModal()}>
                  Book appointment
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col">
              {listView.map((apt, idx) => (
                <div
                  key={apt.id}
                  className={`px-4 py-3 flex items-center gap-3 hover:bg-cream/40 transition-colors ${idx > 0 ? 'border-t border-cream' : ''}`}
                >
                  <div className="text-center shrink-0 w-14">
                    <p className="text-xs text-hint leading-none">{new Date(apt.date).toLocaleString('default', { month: 'short' })}</p>
                    <p className="text-base font-medium text-obsidian leading-tight">{new Date(apt.date).getDate()}</p>
                    <p className="text-xs text-muted mt-0.5">{apt.time}</p>
                  </div>
                  <div className="divider-v h-9" />
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-medium text-obsidian truncate">{apt.clientName}</p>
                    <p className="text-xs text-muted truncate">{apt.type}{apt.doctorName ? ` · ${apt.doctorName}` : ''}</p>
                  </div>
                  <select
                    value={apt.status}
                    onChange={async (e) => {
                      const next = e.target.value as Appointment['status'];
                      const wasCompleted = apt.status === 'Completed';
                      try {
                        await onUpdateAppointment(apt.id, { status: next });
                        // When the doctor flips status to Completed, immediately
                        // open the notes drawer so SOAP notes get captured in
                        // the moment (closes the long-standing notes-skipped gap).
                        // Only after the write succeeds — a failed write must not
                        // open the drawer against a stale status.
                        if (next === 'Completed' && !wasCompleted) {
                          setNotesAppt({ ...apt, status: next });
                        }
                      } catch {
                        toast.error('Could not update the appointment status', { description: 'The change was not saved — please try again.' });
                      }
                    }}
                    className="text-base sm:text-sm bg-cream/60 border border-sand/40 rounded-lg px-2 py-2 font-medium focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {['Confirmed','Pending','Awaiting deposit','Completed','Cancelled','No-Show'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <RowActions actions={apptActions(apt)} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Edit appointment modal (from the schedule) */}
      <Modal
        open={!!editAppt}
        onClose={() => setEditAppt(null)}
        title="Edit appointment"
        subtitle={editAppt ? `${editAppt.clientName} · ${editAppt.type}` : undefined}
        size="md"
        footer={
          <div className="flex items-center gap-2">
            {editAppt && editAppt.status !== 'Cancelled' && (
              <button type="button" onClick={() => { const a = editAppt; setEditAppt(null); cancelBooking(a); }} className="px-3 py-2 text-sm font-medium text-danger hover:bg-danger-bg rounded-md transition-colors">Cancel booking</button>
            )}
            {editAppt && (
              <button type="button" onClick={() => { const a = editAppt; setEditAppt(null); handleDelete(a.id, a.clientName); }} className="px-3 py-2 text-sm font-medium text-danger hover:bg-danger-bg rounded-md transition-colors">Delete</button>
            )}
            <div className="flex gap-3 justify-end ml-auto">
              <button type="button" onClick={() => setEditAppt(null)} className="px-4 py-2 text-sm text-muted hover:text-obsidian">Close</button>
              <button type="submit" form="cal-edit-form" disabled={editSaving || !editForm.date || !editForm.time} className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        }
      >
        {editAppt && (
          <form id="cal-edit-form" onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-2">Date</label>
                <input type="date" required value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-3 py-2.5 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">Time</label>
                <select required value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-3 py-2.5 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20">
                  {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-2">Clinician</label>
              <select value={editForm.clinicianId} onChange={e => setEditForm(p => ({ ...p, clinicianId: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-3 py-2.5 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20">
                <option value="">Unassigned</option>
                {clinicians.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-2">Notes</label>
              <textarea rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional appointment notes" className="w-full bg-cream border-transparent rounded-md px-3 py-2.5 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
          </form>
        )}
      </Modal>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs text-muted pt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-chart-sage/15 border border-chart-sage/35" />
          Dr Aminah
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-chart-terracotta/15 border border-chart-terracotta/35" />
          Dr Waqas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-cream border border-sand" />
          Unassigned
        </span>
      </div>

      {/* Appointment notes + status drawer (modal) */}
      <AppointmentNotesDrawer
        appointment={notesAppt}
        onClose={() => setNotesAppt(null)}
        onSave={(id, updates) => onUpdateAppointment(id, updates)}
        onRecordPayment={onAddPayment}
      />
    </div>
  );
}

export default memo(CalendarPanel);
