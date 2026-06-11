/**
 * Practice → Operations sub-panel.
 *
 * Workload heatmap (utilisation by day) + room for future operational metrics
 * (staff utilisation, no-show rates, treatment-mix throughput).
 *
 * The week-workload heatmap was previously tucked inside CalendarPanel where
 * it didn't belong — Schedule is for scheduling, Operations is for measuring.
 */

import React, { memo, useMemo } from 'react';
import { useAdminContext } from '../context';
import { PageHeader, Card } from '../../../components/ui';
import { BarChart3, Activity } from 'lucide-react';

const SLOTS_PER_DAY = 14; // 09:00 – 22:00

/** Get the Monday-anchored 7-day range that contains `date`. */
function getWeekDates(date: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(date);
  const dayIdx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayIdx);
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    out.push(x);
  }
  return out;
}

const OperationsSubPanel: React.FC = () => {
  const { filteredAppointments } = useAdminContext();
  const today = useMemo(() => new Date(), []);
  const weekDates = useMemo(() => getWeekDates(today), [today]);

  const days = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    const byDate: Record<string, typeof filteredAppointments> = {};
    filteredAppointments.forEach(a => {
      if (!a.date) return;
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });
    return weekDates.map(d => {
      const ds = d.toISOString().split('T')[0];
      const count = (byDate[ds] || []).filter(a => a.status !== 'Cancelled').length;
      const pct = Math.min(100, Math.round((count / SLOTS_PER_DAY) * 100));
      return { date: d, dateStr: ds, count, pct, isToday: ds === todayStr };
    });
  }, [filteredAppointments, weekDates, today]);

  const totalWeek = days.reduce((s, d) => s + d.count, 0);
  const weekCap = SLOTS_PER_DAY * 7;
  const weekPct = Math.round((totalWeek / weekCap) * 100);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Operations"
        subtitle="Clinic capacity and throughput — measure when you're full vs quiet."
      />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-muted" />
            <h3 className="text-sm font-medium text-obsidian">This week's workload</h3>
          </div>
          <p className="text-xs text-muted">
            <span className="text-obsidian font-medium">{totalWeek}</span> session{totalWeek !== 1 ? 's' : ''} ·{' '}
            <span className="text-obsidian font-medium">{weekPct}%</span> capacity
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map(d => {
            const tone = d.pct >= 90 ? 'bg-danger'
                       : d.pct >= 60 ? 'bg-warning'
                       : d.pct >= 30 ? 'bg-primary'
                       : d.pct > 0   ? 'bg-success/60'
                                     : 'bg-cream';
            return (
              <div key={d.dateStr} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] sm:text-xs ${d.isToday ? 'text-obsidian font-medium' : 'text-hint'}`}>
                  {d.date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <div className="w-full h-14 bg-cream/60 rounded-md overflow-hidden relative">
                  <div className={`absolute bottom-0 left-0 right-0 ${tone} transition-all`} style={{ height: `${Math.max(d.pct, 6)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-medium text-obsidian">
                    {d.count || ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 text-center py-4">
          <span className="w-10 h-10 rounded-md bg-cream text-muted inline-flex items-center justify-center mx-auto">
            <Activity size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-obsidian">More operations metrics coming</p>
            <p className="text-xs text-muted mt-1">Staff utilisation, no-show rates, average session times, and treatment-mix throughput will appear here as the clinic accumulates more data.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default memo(OperationsSubPanel);
