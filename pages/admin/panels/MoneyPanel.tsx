import React, { memo, useMemo, useState } from 'react';
import { useAdminContext } from '../context';
import { Payment } from '../../../types';
import {
  CreditCard, ArrowRight, Search, Check, AlertTriangle, Download,
  Receipt, TrendingUp, Clock, Hourglass,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Button, Stat, EmptyState, Badge, useToast,
} from '../../../components/ui';
import { localTodayISO } from '../../../utils/time';

type Filter = 'outstanding' | 'paid' | 'all';

interface Row {
  payment: Payment;
  clientId: string;
  clientName: string;
}

function MoneyPanel() {
  const {
    filteredClients,
    appointments,
    onUpdatePayment,
    onUpdateAppointment,
    openPatient,
  } = useAdminContext();

  const [filter, setFilter] = useState<Filter>('outstanding');
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  // Payment currently being marked paid — disables its button so a slow
  // write can't be double-fired, and failures surface instead of silently
  // leaving the row unchanged while the doctor believes it saved.
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  const handleMarkPaid = async (clientId: string, paymentId: string) => {
    if (busyPaymentId) return;
    setBusyPaymentId(paymentId);
    try {
      await onUpdatePayment(clientId, paymentId, {
        status: 'Paid',
        paidDate: localTodayISO(),
      });
      // Mirror the Stripe webhook: a deposit marked paid also confirms its
      // linked appointment (previously the manual path left the appointment
      // stuck on "Awaiting deposit" until a second manual step).
      const client = filteredClients.find(c => c.id === clientId);
      const pay = (client?.payments || []).find(p => p.id === paymentId);
      if (pay?.appointmentId) {
        const apt = appointments.find(a => a.id === pay.appointmentId);
        if (apt?.status === 'Awaiting deposit') {
          await onUpdateAppointment(apt.id, { status: 'Confirmed' });
        }
      }
      toast.success('Marked as paid');
    } catch {
      toast.error('Could not mark as paid', { description: 'Please check your connection and try again.' });
    } finally {
      setBusyPaymentId(null);
    }
  };

  const formatGBP = (n: number, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);

  // Build flat list of all payments across all patients
  const allRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    filteredClients.forEach(c => {
      (c.payments || []).forEach(p => {
        rows.push({ payment: p, clientId: c.id, clientName: c.name });
      });
    });
    return rows;
  }, [filteredClients]);

  // Stats: month-to-date received, total outstanding, total overdue, aging, projection
  const stats = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const ms = (d: number) => d * 24 * 60 * 60 * 1000;
    const now = today.getTime();

    const receivedMtd = allRows
      .filter(r => r.payment.status === 'Paid' && r.payment.paidDate && new Date(r.payment.paidDate) >= monthStart)
      .reduce((s, r) => s + r.payment.amount, 0);
    const receivedLastMonth = allRows
      .filter(r => r.payment.status === 'Paid' && r.payment.paidDate && new Date(r.payment.paidDate) >= lastMonthStart && new Date(r.payment.paidDate) < monthStart)
      .reduce((s, r) => s + r.payment.amount, 0);
    const outstanding = allRows
      .filter(r => r.payment.status === 'Pending' || r.payment.status === 'Overdue')
      .reduce((s, r) => s + r.payment.amount, 0);
    const overdue = allRows
      .filter(r => {
        if (r.payment.status === 'Overdue') return true;
        if (r.payment.status === 'Pending' && r.payment.dueDate && new Date(r.payment.dueDate) < today) return true;
        return false;
      })
      .reduce((s, r) => s + r.payment.amount, 0);

    // Aging buckets — only for unpaid items (Pending/Overdue)
    const unpaidRows = allRows.filter(r => r.payment.status === 'Pending' || r.payment.status === 'Overdue');
    const aging = {
      current:  { count: 0, amount: 0 },   // not yet due, or due ≤ today
      _0_7:     { count: 0, amount: 0 },   // 1-7d overdue
      _8_30:    { count: 0, amount: 0 },   // 8-30d overdue
      _30plus:  { count: 0, amount: 0 },   // 30+d overdue
    };
    unpaidRows.forEach(r => {
      const dueTime = r.payment.dueDate ? new Date(r.payment.dueDate).getTime() : new Date(r.payment.createdAt).getTime();
      const daysOverdue = (now - dueTime) / ms(1);
      if (daysOverdue <= 0) {
        aging.current.count++;
        aging.current.amount += r.payment.amount;
      } else if (daysOverdue <= 7) {
        aging._0_7.count++;
        aging._0_7.amount += r.payment.amount;
      } else if (daysOverdue <= 30) {
        aging._8_30.count++;
        aging._8_30.amount += r.payment.amount;
      } else {
        aging._30plus.count++;
        aging._30plus.amount += r.payment.amount;
      }
    });

    // Average days-to-pay (Paid items with both paidDate and createdAt)
    const paidWithCycles = allRows
      .filter(r => r.payment.status === 'Paid' && r.payment.paidDate && r.payment.createdAt)
      .map(r => (new Date(r.payment.paidDate!).getTime() - new Date(r.payment.createdAt).getTime()) / ms(1));
    const avgDaysToPay = paidWithCycles.length === 0 ? 0 : Math.round(paidWithCycles.reduce((s, n) => s + n, 0) / paidWithCycles.length);

    // Month-over-month delta
    const momPct = receivedLastMonth === 0
      ? (receivedMtd > 0 ? 100 : 0)
      : Math.round(((receivedMtd - receivedLastMonth) / receivedLastMonth) * 100);

    return { receivedMtd, receivedLastMonth, outstanding, overdue, aging, avgDaysToPay, momPct };
  }, [allRows]);

  // Projected revenue from confirmed appointments this month — uses default
  // pricing per treatment type since the data model has no per-appointment price.
  // Heuristic pricing (sensible defaults; can be refined later in Settings).
  const TREATMENT_PRICES: Record<string, number> = {
    'Initial Consultation':       100,
    'Follow-up Consultation':     60,
    'PRP Session':                250,
    'EV-Enriched Plasma Session': 600,
    'Hair Assessment':            0,
    'Microneedling Session':      180,
  };
  const projected = useMemo(() => {
    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const upcoming = appointments.filter(a => {
      const d = new Date(a.date);
      return (a.status === 'Confirmed' || a.status === 'Pending') && d >= today && d <= monthEnd;
    });
    const completedThisMonth = appointments.filter(a => {
      const d = new Date(a.date);
      return a.status === 'Completed' && d >= monthStart && d <= monthEnd;
    });
    const upcomingValue = upcoming.reduce((s, a) => s + (TREATMENT_PRICES[a.type] ?? 100), 0);
    const completedValue = completedThisMonth.reduce((s, a) => s + (TREATMENT_PRICES[a.type] ?? 100), 0);
    return {
      monthForecast: stats.receivedMtd + upcomingValue,
      upcomingCount: upcoming.length,
      upcomingValue,
      completedThisMonthValue: completedValue,
    };
  }, [appointments, stats.receivedMtd]);

  // Apply filter + search
  const visible = useMemo(() => {
    let rows = allRows.slice();
    if (filter === 'outstanding') {
      rows = rows.filter(r => r.payment.status === 'Pending' || r.payment.status === 'Overdue');
    } else if (filter === 'paid') {
      rows = rows.filter(r => r.payment.status === 'Paid');
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(r =>
        r.clientName.toLowerCase().includes(q) ||
        r.payment.description.toLowerCase().includes(q) ||
        r.payment.reference?.toLowerCase().includes(q),
      );
    }
    // Sort: outstanding by due date asc (urgent first), paid by paidDate desc
    rows.sort((a, b) => {
      if (a.payment.status === 'Paid' && b.payment.status === 'Paid') {
        return new Date(b.payment.paidDate || b.payment.createdAt).getTime() - new Date(a.payment.paidDate || a.payment.createdAt).getTime();
      }
      const aDate = a.payment.dueDate || a.payment.createdAt;
      const bDate = b.payment.dueDate || b.payment.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
    return rows;
  }, [allRows, filter, search]);

  const exportCSV = () => {
    const header = ['Date', 'Patient', 'Description', 'Amount', 'Currency', 'Status', 'Due', 'Paid', 'Reference'];
    const rows = visible.map(r => [
      r.payment.createdAt,
      r.clientName,
      r.payment.description,
      r.payment.amount.toFixed(2),
      r.payment.currency || 'GBP',
      r.payment.status,
      r.payment.dueDate || '',
      r.payment.paidDate || '',
      r.payment.reference || '',
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novogenics-money-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const counts = {
    outstanding: allRows.filter(r => r.payment.status === 'Pending' || r.payment.status === 'Overdue').length,
    paid: allRows.filter(r => r.payment.status === 'Paid').length,
    all: allRows.length,
  };

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title="Money"
        subtitle="Payments across all patients this month"
        actions={
          <Button variant="ghost" size="sm" leadingIcon={<Download size={13} />} onClick={exportCSV}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Received this month"
          value={formatGBP(stats.receivedMtd)}
          delta={stats.receivedLastMonth > 0 || stats.receivedMtd > 0 ? {
            value: `${stats.momPct >= 0 ? '+' : ''}${stats.momPct}% vs last month`,
            direction: stats.momPct >= 0 ? 'up' : 'down',
          } : undefined}
          icon={<TrendingUp size={16} />}
          accent="sage"
        />
        <Stat
          label="Outstanding"
          value={formatGBP(stats.outstanding)}
          hint={stats.outstanding > 0 ? `${counts.outstanding} item${counts.outstanding !== 1 ? 's' : ''}` : undefined}
          icon={<Clock size={16} />}
          accent="info"
        />
        <Stat
          label="Overdue"
          value={formatGBP(stats.overdue)}
          icon={<AlertTriangle size={16} />}
          accent={stats.overdue > 0 ? 'danger' : 'default'}
        />
        <Stat
          label="Avg days to pay"
          value={stats.avgDaysToPay === 0 ? '—' : `${stats.avgDaysToPay}d`}
          icon={<Clock size={16} />}
          accent="gold"
        />
      </div>

      {/* ── Aging + Projection — the forward-thinking row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Aging buckets */}
        <Card>
          <CardHeader
            title="Aging"
            subtitle="Where outstanding money is sitting"
            leadingIcon={<Hourglass size={14} />}
          />
          {(() => {
            const total = stats.aging.current.amount + stats.aging._0_7.amount + stats.aging._8_30.amount + stats.aging._30plus.amount;
            const buckets = [
              { key: 'current', label: 'Not yet due', bucket: stats.aging.current,  tone: 'bg-success/80' },
              { key: '_0_7',    label: '1–7 days',    bucket: stats.aging._0_7,     tone: 'bg-warning/80' },
              { key: '_8_30',   label: '8–30 days',   bucket: stats.aging._8_30,    tone: 'bg-warning' },
              { key: '_30plus', label: '30+ days',    bucket: stats.aging._30plus,  tone: 'bg-danger' },
            ];
            if (total === 0) {
              return <p className="text-sm text-muted py-2">Nothing outstanding — clean books.</p>;
            }
            return (
              <>
                <div className="flex h-2 w-full rounded-full overflow-hidden bg-cream mb-3">
                  {buckets.map(b => {
                    const pct = total === 0 ? 0 : (b.bucket.amount / total) * 100;
                    if (pct === 0) return null;
                    return <div key={b.key} className={b.tone} style={{ width: `${pct}%` }} title={`${b.label}: ${formatGBP(b.bucket.amount)}`} />;
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {buckets.map(b => {
                    const pct = total === 0 ? 0 : Math.round((b.bucket.amount / total) * 100);
                    return (
                      <div key={b.key} className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${b.tone}`} />
                          <span className="text-xs text-muted truncate">{b.label}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-medium text-obsidian">{formatGBP(b.bucket.amount)}</span>
                          <span className="text-xs text-hint ml-1.5">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </Card>

        {/* Projected revenue */}
        <Card>
          <CardHeader
            title="This month forecast"
            subtitle="Received + value of confirmed appointments"
            leadingIcon={<TrendingUp size={14} />}
          />
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-medium text-obsidian">{formatGBP(projected.monthForecast)}</p>
            <p className="text-xs text-muted">projected</p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Received</span>
              <span className="text-obsidian font-medium">{formatGBP(stats.receivedMtd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{projected.upcomingCount} upcoming session{projected.upcomingCount !== 1 ? 's' : ''}</span>
              <span className="text-obsidian font-medium">{formatGBP(projected.upcomingValue)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-cream">
              <span className="text-xs text-hint">Last month total</span>
              <span className="text-xs text-hint">{formatGBP(stats.receivedLastMonth)}</span>
            </div>
          </div>
          <p className="text-xs text-hint mt-3 leading-relaxed">
            Forecast uses standard list pricing per treatment type. Customise rates in Settings.
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex gap-1">
          {(['outstanding', 'paid', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-obsidian text-white font-medium'
                  : 'text-muted hover:bg-cream hover:text-obsidian'
              }`}
            >
              <span className="capitalize">{f}</span>
              <span className={`text-xs ${filter === f ? 'text-primary' : 'text-hint'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="search-wrap flex-grow max-w-md">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, description, reference…"
            className="search-input"
          />
        </div>
      </div>

      <Card padded={false}>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Receipt size={16} />}
            title={filter === 'outstanding' ? 'Nothing outstanding' : filter === 'paid' ? 'No payments yet' : 'No records'}
            description={filter === 'outstanding' ? 'Everyone is up to date.' : 'When payments are added on a patient record they show up here.'}
          />
        ) : (
          <div className="flex flex-col">
            {visible.map((row, idx) => {
              const p = row.payment;
              const today = new Date();
              const due = p.dueDate ? new Date(p.dueDate) : null;
              const isOverdue = p.status === 'Overdue' || (p.status === 'Pending' && due && due < today);
              const dateLabel = p.status === 'Paid'
                ? `Paid ${p.paidDate ? new Date(p.paidDate).toLocaleDateString('en-GB') : ''}`
                : p.dueDate
                  ? `Due ${new Date(p.dueDate).toLocaleDateString('en-GB')}`
                  : `Created ${new Date(p.createdAt).toLocaleDateString('en-GB')}`;
              return (
                <div
                  key={`${row.clientId}-${p.id}`}
                  className={`px-4 py-3 hover:bg-cream/40 transition-colors ${idx > 0 ? 'border-t border-cream' : ''} ${isOverdue ? 'bg-danger-bg/30' : ''}`}
                >
                  {/* Mobile stacked card */}
                  <div className="md:hidden flex flex-col gap-2">
                    <button
                      onClick={() => openPatient(row.clientId, 'financials')}
                      className="flex items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-grow">
                        <p className="text-sm font-medium text-obsidian truncate">{row.clientName}</p>
                        <p className="text-xs text-muted mt-0.5 line-clamp-1">{p.description}</p>
                      </div>
                      <p className="text-base font-medium text-obsidian shrink-0">{formatGBP(p.amount, p.currency || 'GBP')}</p>
                    </button>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={p.status === 'Paid' ? 'active' : isOverdue ? 'danger' : 'pending'}>
                          {isOverdue && p.status !== 'Overdue' ? 'Overdue' : p.status}
                        </Badge>
                        <span className="text-xs text-muted truncate">{dateLabel}</span>
                      </div>
                      {p.status !== 'Paid' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Check size={13} />}
                          onClick={() => handleMarkPaid(row.clientId, p.id)}
                          disabled={busyPaymentId === p.id}
                        >
                          {busyPaymentId === p.id ? 'Saving…' : 'Mark paid'}
                        </Button>
                      )}
                    </div>
                    {p.reference && (
                      <p className="text-xs text-hint font-mono">{p.reference}</p>
                    )}
                  </div>

                  {/* Desktop inline row */}
                  <div className="hidden md:flex items-center gap-3">
                    <button
                      onClick={() => openPatient(row.clientId, 'financials')}
                      className="flex items-center gap-3 min-w-0 flex-grow text-left"
                    >
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-obsidian truncate">{row.clientName}</p>
                          <span className="text-xs text-hint shrink-0">·</span>
                          <p className="text-xs text-muted truncate">{p.description}</p>
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {p.reference && <span className="font-mono mr-2">{p.reference}</span>}
                          {dateLabel}
                        </p>
                      </div>
                      <p className="text-base font-medium text-obsidian shrink-0">{formatGBP(p.amount, p.currency || 'GBP')}</p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={p.status === 'Paid' ? 'active' : isOverdue ? 'danger' : 'pending'}>
                        {isOverdue && p.status !== 'Overdue' ? 'Overdue' : p.status}
                      </Badge>
                      {p.status !== 'Paid' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Check size={13} />}
                          onClick={() => handleMarkPaid(row.clientId, p.id)}
                          disabled={busyPaymentId === p.id}
                        >
                          {busyPaymentId === p.id ? 'Saving…' : 'Mark paid'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default memo(MoneyPanel);
