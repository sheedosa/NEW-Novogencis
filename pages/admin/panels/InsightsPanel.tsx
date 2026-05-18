import React, { memo, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAdminContext } from '../context';
import {
  BarChart3, Users as UsersIcon, ClipboardList, MessageCircle,
  CheckCircle, Calendar as CalendarIcon, TrendingUp, Receipt, Sparkles,
} from 'lucide-react';
import { PageHeader, Card, CardHeader, Stat } from '../../../components/ui';

const COLORS = {
  // Warm-premium SaaS palette — matches the design system tokens
  obsidian:   '#1A1916',
  gold:       '#C9A86A',
  goldDim:    '#A8894F',
  goldSoft:   '#F4EDD9',
  cream:      '#F4F3EF',
  sand:       '#E8E6E1',
  muted:      '#6E6A65',
  // Coordinated organic chart hues
  sage:       '#7FA288',
  terracotta: '#C49072',
  indigo:     '#6B7FB8',
  slate:      '#94A3B8',
  // Muted semantic
  success:    '#3B8C5F',
  warning:    '#C68726',
  danger:     '#C04A4A',
  info:       '#3B6FB8',
};

// Treatment palette — each treatment gets a distinct organic colour, so the
// treatment mix donut & per-treatment bars read as a coherent series.
const TREATMENT_COLORS: Record<string, string> = {
  'PRP Session':                COLORS.gold,
  'EV-Enriched Plasma Session': COLORS.obsidian,
  'Microneedling Session':      COLORS.sage,
  'Initial Consultation':       COLORS.indigo,
  'Follow-up Consultation':     COLORS.terracotta,
  'Hair Assessment':            COLORS.slate,
};

function InsightsPanel() {
  const { filteredClients, filteredAppointments } = useAdminContext();

  // ── Funnel (cumulative through lifecycle) ───────────────────────────
  const funnelCounts = useMemo(() => {
    const buckets = {
      'new inquiry':           0,
      'assessment submitted':  0,
      'reviewed':              0,
      'contacted':             0,
      'converted':             0,
    };
    filteredClients.forEach(c => {
      const s = (c.status || '').toLowerCase();
      if (s === 'converted' || s === 'active' || s === 'ongoing' || s === 'completed') {
        buckets['new inquiry']++;
        buckets['assessment submitted']++;
        buckets['reviewed']++;
        buckets['contacted']++;
        buckets['converted']++;
      } else if (s === 'contacted') {
        buckets['new inquiry']++;
        buckets['assessment submitted']++;
        buckets['reviewed']++;
        buckets['contacted']++;
      } else if (s === 'reviewed') {
        buckets['new inquiry']++;
        buckets['assessment submitted']++;
        buckets['reviewed']++;
      } else if (s === 'assessment submitted') {
        buckets['new inquiry']++;
        buckets['assessment submitted']++;
      } else if (s === 'new inquiry') {
        buckets['new inquiry']++;
      } else if (s === 'not suitable') {
        buckets['new inquiry']++;
        buckets['assessment submitted']++;
        buckets['reviewed']++;
      }
    });
    return buckets;
  }, [filteredClients]);

  const funnelData = [
    { stage: 'New inquiry',          count: funnelCounts['new inquiry'] },
    { stage: 'Assessment',            count: funnelCounts['assessment submitted'] },
    { stage: 'Reviewed',              count: funnelCounts['reviewed'] },
    { stage: 'Contacted',             count: funnelCounts['contacted'] },
    { stage: 'Converted',             count: funnelCounts['converted'] },
  ];

  const conversionRate = funnelCounts['new inquiry'] === 0 ? 0
    : Math.round((funnelCounts['converted'] / funnelCounts['new inquiry']) * 100);

  // ── Revenue trend (12-week rolling) ─────────────────────────────────
  const revenueData = useMemo(() => {
    const weeks: { week: string; revenue: number }[] = [];
    const now = new Date();
    // Find the Monday of the current week
    const dayIdx = (now.getDay() + 6) % 7;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - dayIdx);
    currentWeekStart.setHours(0, 0, 0, 0);

    for (let w = 11; w >= 0; w--) {
      const start = new Date(currentWeekStart);
      start.setDate(currentWeekStart.getDate() - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const weekRevenue = filteredClients.reduce((sum, c) => {
        return sum + (c.payments || [])
          .filter(p => {
            if (p.status !== 'Paid' || !p.paidDate) return false;
            const d = new Date(p.paidDate);
            return d >= start && d < end;
          })
          .reduce((s, p) => s + p.amount, 0);
      }, 0);
      const label = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      weeks.push({ week: label, revenue: weekRevenue });
    }
    return weeks;
  }, [filteredClients]);

  // ── Treatment mix (by completed appointment type) ───────────────────
  const treatmentMix = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments
      .filter(a => a.status === 'Completed' || a.status === 'Confirmed')
      .forEach(a => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([type, count]) => ({ name: type, value: count, fill: TREATMENT_COLORS[type] || COLORS.muted }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAppointments]);

  // ── Weekly bookings (last 8 weeks) ──────────────────────────────────
  const bookingsData = useMemo(() => {
    const weeks: { week: string; bookings: number; completed: number }[] = [];
    const now = new Date();
    const dayIdx = (now.getDay() + 6) % 7;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - dayIdx);
    currentWeekStart.setHours(0, 0, 0, 0);

    for (let w = 7; w >= 0; w--) {
      const start = new Date(currentWeekStart);
      start.setDate(currentWeekStart.getDate() - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const inWeek = filteredAppointments.filter(a => {
        const d = new Date(a.date);
        return d >= start && d < end;
      });
      const completed = inWeek.filter(a => a.status === 'Completed').length;
      const label = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      weeks.push({ week: label, bookings: inWeek.length, completed });
    }
    return weeks;
  }, [filteredAppointments]);

  // ── Period analytics — current 30d vs prior 30d ─────────────────────
  const periodStats = useMemo(() => {
    const now = Date.now();
    const ms = (d: number) => d * 24 * 60 * 60 * 1000;
    const start30 = now - ms(30);
    const start60 = now - ms(60);

    const inRange = (iso: string | undefined, from: number, to: number) =>
      iso ? new Date(iso).getTime() >= from && new Date(iso).getTime() < to : false;

    // Revenue (Paid payments by paidDate)
    const revenueCurrent = filteredClients.reduce((s, c) =>
      s + (c.payments || []).filter(p => p.status === 'Paid' && inRange(p.paidDate, start30, now)).reduce((x, p) => x + p.amount, 0), 0);
    const revenuePrev = filteredClients.reduce((s, c) =>
      s + (c.payments || []).filter(p => p.status === 'Paid' && inRange(p.paidDate, start60, start30)).reduce((x, p) => x + p.amount, 0), 0);

    // New patients (by createdAt)
    const newClientsCurrent = filteredClients.filter(c => inRange(c.createdAt, start30, now)).length;
    const newClientsPrev    = filteredClients.filter(c => inRange(c.createdAt, start60, start30)).length;

    // Sessions completed
    const sessionsCurrent = filteredAppointments.filter(a => a.status === 'Completed' && inRange(a.date, start30, now)).length;
    const sessionsPrev    = filteredAppointments.filter(a => a.status === 'Completed' && inRange(a.date, start60, start30)).length;

    // Cancellations (no-show + cancelled)
    const cancelsCurrent  = filteredAppointments.filter(a =>
      (a.status === 'Cancelled' || a.status === 'No-Show') && inRange(a.date, start30, now)).length;
    const cancelsPrev     = filteredAppointments.filter(a =>
      (a.status === 'Cancelled' || a.status === 'No-Show') && inRange(a.date, start60, start30)).length;

    // Treatment-mix shift: top growing treatment by % change
    const mixThis: Record<string, number> = {};
    const mixPrev: Record<string, number> = {};
    filteredAppointments.forEach(a => {
      if (a.status === 'Completed' || a.status === 'Confirmed') {
        if (inRange(a.date, start30, now)) mixThis[a.type] = (mixThis[a.type] || 0) + 1;
        if (inRange(a.date, start60, start30)) mixPrev[a.type] = (mixPrev[a.type] || 0) + 1;
      }
    });
    const mixDeltas = Object.keys({ ...mixThis, ...mixPrev }).map(type => {
      const cur = mixThis[type] || 0;
      const prev = mixPrev[type] || 0;
      const pct = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
      return { type, cur, prev, pct };
    });

    const pct = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

    return {
      revenueCurrent, revenuePrev, revenuePct: pct(revenueCurrent, revenuePrev),
      newClientsCurrent, newClientsPrev, newClientsPct: pct(newClientsCurrent, newClientsPrev),
      sessionsCurrent, sessionsPrev, sessionsPct: pct(sessionsCurrent, sessionsPrev),
      cancelsCurrent, cancelsPrev, cancelsPct: pct(cancelsCurrent, cancelsPrev),
      mixDeltas,
    };
  }, [filteredClients, filteredAppointments]);

  // ── Side stats ──────────────────────────────────────────────────────
  const completedAppointments = filteredAppointments.filter(a => a.status === 'Completed').length;
  const cancelled = filteredAppointments.filter(a => a.status === 'Cancelled' || a.status === 'No-Show').length;
  const noShowRate = (completedAppointments + cancelled) === 0 ? 0
    : Math.round((cancelled / (completedAppointments + cancelled)) * 100);
  const totalRevenue30 = periodStats.revenueCurrent;

  // ── What changed — auto-narrative insight cards ──────────────────────
  const whatChanged = useMemo(() => {
    const insights: { id: string; tone: 'positive' | 'warning' | 'neutral'; title: string; detail: string }[] = [];

    if (Math.abs(periodStats.revenuePct) >= 10 && (periodStats.revenueCurrent + periodStats.revenuePrev) > 0) {
      insights.push({
        id: 'rev',
        tone: periodStats.revenuePct >= 0 ? 'positive' : 'warning',
        title: `Revenue ${periodStats.revenuePct >= 0 ? 'up' : 'down'} ${Math.abs(periodStats.revenuePct)}% over the last 30 days`,
        detail: `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(periodStats.revenueCurrent)} vs ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(periodStats.revenuePrev)} the prior month.`,
      });
    }
    if (Math.abs(periodStats.newClientsPct) >= 15 && (periodStats.newClientsCurrent + periodStats.newClientsPrev) > 0) {
      insights.push({
        id: 'new',
        tone: periodStats.newClientsPct >= 0 ? 'positive' : 'warning',
        title: `New patient acquisition ${periodStats.newClientsPct >= 0 ? 'accelerated' : 'slowed'} (${periodStats.newClientsPct >= 0 ? '+' : ''}${periodStats.newClientsPct}%)`,
        detail: `${periodStats.newClientsCurrent} new patients vs ${periodStats.newClientsPrev} the prior 30 days.`,
      });
    }
    if (periodStats.cancelsPct > 50 && periodStats.cancelsCurrent > 1) {
      insights.push({
        id: 'cancels',
        tone: 'warning',
        title: `Cancellations spiked +${periodStats.cancelsPct}%`,
        detail: `${periodStats.cancelsCurrent} sessions cancelled or missed (was ${periodStats.cancelsPrev}). Consider reminder cadence.`,
      });
    }
    // Top mover in treatment mix
    const mover = periodStats.mixDeltas
      .filter(m => (m.cur + m.prev) >= 2)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
    if (mover && Math.abs(mover.pct) >= 25) {
      insights.push({
        id: 'mix',
        tone: 'neutral',
        title: `Treatment mix shifted toward ${mover.type} (${mover.pct >= 0 ? '+' : ''}${mover.pct}%)`,
        detail: `${mover.cur} sessions this period vs ${mover.prev} prior.`,
      });
    }
    return insights;
  }, [periodStats]);

  const formatGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  const deltaFor = (pct: number): { value: string; direction: 'up' | 'down' | 'neutral' } | undefined => {
    if (pct === 0) return undefined;
    return {
      value: `${pct > 0 ? '+' : ''}${pct}% vs prior 30d`,
      direction: pct > 0 ? 'up' : 'down',
    };
  };

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title="Insights"
        subtitle="Conversion, revenue and clinic operations"
      />

      {/* KPI row — each KPI now compared against the prior 30 days */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Conversion rate"
          value={`${conversionRate}%`}
          icon={<TrendingUp size={16} />}
          accent="gold"
        />
        <Stat
          label="Revenue · 30d"
          value={formatGBP(periodStats.revenueCurrent)}
          delta={deltaFor(periodStats.revenuePct)}
          icon={<Receipt size={16} />}
          accent="sage"
        />
        <Stat
          label="Sessions done · 30d"
          value={periodStats.sessionsCurrent}
          delta={deltaFor(periodStats.sessionsPct)}
          icon={<CalendarIcon size={16} />}
          accent="info"
        />
        <Stat
          label="No-show rate"
          value={`${noShowRate}%`}
          icon={<ClipboardList size={16} />}
          accent={noShowRate > 10 ? 'danger' : 'default'}
        />
      </div>

      {/* ── What changed — auto-narrated insights from the period comparison ── */}
      {whatChanged.length > 0 && (
        <Card className="!bg-gradient-to-br !from-obsidian !to-[#27272A] !text-white !border-obsidian">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center text-primary">
                <Sparkles size={14} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">What changed this period</h3>
                <p className="text-xs text-white/60">Last 30 days vs the prior 30</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {whatChanged.map(i => (
              <div key={i.id} className="bg-white/5 rounded-md p-3 border border-white/10">
                <div className="flex items-start gap-2">
                  <div className={`w-1 h-full self-stretch rounded-full ${
                    i.tone === 'positive' ? 'bg-success' :
                    i.tone === 'warning'  ? 'bg-warning' :
                                            'bg-primary'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{i.title}</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{i.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 2x2 chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Funnel as horizontal bar chart */}
        <Card>
          <CardHeader
            title="Conversion funnel"
            subtitle="Cumulative count at each stage"
            leadingIcon={<UsersIcon size={14} />}
          />
          {funnelCounts['new inquiry'] === 0 ? (
            <p className="text-sm text-muted py-12 text-center">No patient data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="2 3" stroke={COLORS.sand} horizontal={false} />
                <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: COLORS.obsidian, fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  cursor={{ fill: 'rgba(28,25,23,0.04)' }}
                  contentStyle={{ background: '#fff', border: `1px solid ${COLORS.sand}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: COLORS.obsidian, fontWeight: 500 }}
                />
                <Bar dataKey="count" fill={COLORS.obsidian} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Revenue trend */}
        <Card>
          <CardHeader
            title="Revenue trend"
            subtitle="Last 12 weeks"
            leadingIcon={<Receipt size={14} />}
          />
          {revenueData.every(d => d.revenue === 0) ? (
            <p className="text-sm text-muted py-12 text-center">No payment data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={COLORS.gold} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 3" stroke={COLORS.sand} vertical={false} />
                <XAxis dataKey="week" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `£${(v/1000).toFixed(1)}k` : `£${v}`} />
                <Tooltip
                  cursor={{ stroke: COLORS.gold, strokeWidth: 1 }}
                  contentStyle={{ background: '#fff', border: `1px solid ${COLORS.sand}`, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [formatGBP(Number(v)), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke={COLORS.gold} strokeWidth={2} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Treatment mix donut */}
        <Card>
          <CardHeader
            title="Treatment mix"
            subtitle="Booked & completed sessions by type"
            leadingIcon={<ClipboardList size={14} />}
          />
          {treatmentMix.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">No appointment data yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={treatmentMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {treatmentMix.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#fff', border: `1px solid ${COLORS.sand}`, borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 min-w-0 flex-shrink w-full sm:w-44">
                {treatmentMix.slice(0, 5).map(t => {
                  const pct = treatmentMix.reduce((s, x) => s + x.value, 0);
                  const share = pct === 0 ? 0 : Math.round((t.value / pct) * 100);
                  return (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.fill }} />
                      <span className="text-obsidian truncate flex-grow">{t.name.replace(' Session', '').replace(' Consultation', '')}</span>
                      <span className="text-muted shrink-0">{share}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Weekly bookings */}
        <Card>
          <CardHeader
            title="Weekly bookings"
            subtitle="Last 8 weeks — booked vs completed"
            leadingIcon={<CalendarIcon size={14} />}
          />
          {bookingsData.every(d => d.bookings === 0) ? (
            <p className="text-sm text-muted py-12 text-center">No appointment data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bookingsData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }} barGap={4}>
                <CartesianGrid strokeDasharray="2 3" stroke={COLORS.sand} vertical={false} />
                <XAxis dataKey="week" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(28,25,23,0.04)' }}
                  contentStyle={{ background: '#fff', border: `1px solid ${COLORS.sand}`, borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
                <Bar dataKey="bookings"  name="Booked"    fill={COLORS.obsidian} radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="completed" name="Completed" fill={COLORS.gold}      radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

export default memo(InsightsPanel);
