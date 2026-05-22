import React, { memo, useState, useMemo } from 'react';
import { useAdminContext } from '../context';
import type { Appointment } from '../../../types';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  List, LayoutGrid, Users as UsersIcon, User as UserIcon, Filter,
  Clock, CheckCircle, X as XIcon, Trash2, BarChart3,
} from 'lucide-react';
import {
  PageHeader, Card, Button, StatusBadge, EmptyState, Badge,
} from '../../../components/ui';

type View = 'week' | 'day' | 'list';
type DoctorFilter = 'all' | 'female' | 'male' | 'mine';
type TypeFilter = 'all' | 'PRP Session' | 'EV-Enriched Plasma Session' | 'Microneedling Session' | 'Initial Consultation' | 'Follow-up Consultation' | 'Hair Assessment';

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

function parseTime12h(t: string): { h: number; m: number } | null {
  // "09:30 AM" → { h: 9, m: 30 }
  const match = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

function CalendarPanel() {
  const {
    user,
    filteredAppointments,
    openBookingModal,
    onUpdateAppointment,
    onDeleteAppointment,
    getFirstName,
  } = useAdminContext();

  // Default to day view on mobile (week view is too dense for <640px viewports).
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
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

  const todayStr = new Date().toISOString().split('T')[0];

  // Bucket appointments by date for the visible week
  const byDate = useMemo(() => {
    const buckets: Record<string, typeof visible> = {};
    weekDates.forEach(d => {
      const key = d.toISOString().split('T')[0];
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

  const dayDateStr = cursor.toISOString().split('T')[0];
  const dayAppointments = (byDate[dayDateStr] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <div className="animate-fade-up flex flex-col gap-3">
      <PageHeader
        title="Calendar"
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
            className={`px-3 py-1 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 ${
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
            <option value="Initial Consultation">Initial</option>
            <option value="Follow-up Consultation">Follow-up</option>
            <option value="PRP Session">PRP</option>
            <option value="EV-Enriched Plasma Session">Exosomes</option>
            <option value="Microneedling Session">Microneedling</option>
            <option value="Hair Assessment">Assessment</option>
          </select>
        </div>
      </div>

      {/* ── Workload heatmap (week-view only) — quick read of utilisation ── */}
      {view === 'week' && (() => {
        const SLOTS_PER_DAY = HOURS.length;  // 14 hours (09:00–22:00) = 14 slots per day
        const todayStr = new Date().toISOString().split('T')[0];
        const days = weekDates.map(d => {
          const ds = d.toISOString().split('T')[0];
          const count = (byDate[ds] || []).filter(a => a.status !== 'Cancelled').length;
          const pct = Math.min(100, Math.round((count / SLOTS_PER_DAY) * 100));
          return { date: d, dateStr: ds, count, pct };
        });
        const totalWeek = days.reduce((s, d) => s + d.count, 0);
        const weekCap = SLOTS_PER_DAY * 7;
        const weekPct = Math.round((totalWeek / weekCap) * 100);
        return (
          <Card>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-muted" />
                <h3 className="text-sm font-medium text-obsidian">This week's workload</h3>
              </div>
              <p className="text-xs text-muted">
                <span className="text-obsidian font-medium">{totalWeek}</span> session{totalWeek !== 1 ? 's' : ''} · <span className="text-obsidian font-medium">{weekPct}%</span> capacity
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(d => {
                const isToday = d.dateStr === todayStr;
                const tone = d.pct >= 90 ? 'bg-danger'  :
                             d.pct >= 60 ? 'bg-warning' :
                             d.pct >= 30 ? 'bg-primary' :
                             d.pct > 0   ? 'bg-success/60' : 'bg-cream';
                return (
                  <div key={d.dateStr} className="flex flex-col items-center gap-1">
                    <span className={`text-xs ${isToday ? 'text-obsidian font-medium' : 'text-hint'}`}>
                      {d.date.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <div className="w-full h-12 bg-cream/60 rounded-md overflow-hidden relative">
                      <div className={`absolute bottom-0 left-0 right-0 ${tone} transition-all`} style={{ height: `${Math.max(d.pct, 6)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-obsidian">
                        {d.count || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* ── Week view ──────────────────────────────────────────────────── */}
      {view === 'week' && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <div className="min-w-[640px] sm:min-w-[800px]">
              {/* Header row: days */}
              <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b border-sand">
                <div className="px-2 py-2 text-xs text-hint"></div>
                {weekDates.map((d, i) => {
                  const dStr = d.toISOString().split('T')[0];
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
                            const dateStr = targetDate.toISOString().split('T')[0];
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
                  const dStr = date.toISOString().split('T')[0];
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
                        onClick={() => openBookingModal(apt.clientId)}
                        title={`${apt.clientName} · ${apt.type} · ${apt.time}`}
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
                  onClick={() => openBookingModal(apt.clientId)}
                  title={apt.clientName}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-obsidian truncate">{apt.time} · {apt.clientName}</p>
                      <p className="text-xs text-muted truncate">{apt.type} {apt.doctorName ? `· ${apt.doctorName}` : ''}</p>
                    </div>
                    <StatusBadge status={apt.status} />
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
                    onChange={(e) => onUpdateAppointment(apt.id, { status: e.target.value as Appointment['status'] })}
                    className="text-xs bg-cream/60 border border-sand/40 rounded-lg px-2 py-1 font-medium focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {['Confirmed','Pending','Awaiting deposit','Completed','Cancelled','No-Show'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onDeleteAppointment(apt.id)}
                      className="btn-icon hover:!text-danger"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
    </div>
  );
}

export default memo(CalendarPanel);
