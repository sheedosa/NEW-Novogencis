/**
 * Practice → Overview sub-panel.
 *
 * High-level business snapshot: 4 headline KPIs plus a "what changed" narrative.
 * Doctors who only glance at the practice numbers get everything in one screen.
 */

import React, { memo, useMemo } from 'react';
import { useAdminContext } from '../context';
import { PageHeader, Stat, Card } from '../../../components/ui';
import { TrendingUp, Users, Receipt, ClipboardList } from 'lucide-react';

const PracticeOverviewSubPanel: React.FC = () => {
  const { clients, appointments } = useAdminContext();

  const stats = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const newPatientsLast30 = clients.filter(
      c => c.createdAt && new Date(c.createdAt) >= thirtyDaysAgo,
    ).length;
    const newPatientsPrev30 = clients.filter(c => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    }).length;

    const completedLast30 = appointments.filter(
      a => a.status === 'Completed' && a.date && new Date(a.date) >= thirtyDaysAgo,
    ).length;

    const allPayments = clients.flatMap(c => c.payments || []);
    const revenueLast30 = allPayments
      .filter(p => p.status === 'Paid' && p.paidDate && new Date(p.paidDate) >= thirtyDaysAgo)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const outstanding = allPayments
      .filter(p => p.status === 'Pending' || p.status === 'Overdue')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      newPatientsLast30,
      newPatientsPrev30,
      completedLast30,
      revenueLast30,
      outstanding,
      activePatients: clients.filter(c => c.status === 'Active' || c.status === 'Ongoing').length,
    };
  }, [clients, appointments]);

  const formatGBP = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  const newPatientsTrend = stats.newPatientsPrev30 > 0
    ? Math.round(((stats.newPatientsLast30 - stats.newPatientsPrev30) / stats.newPatientsPrev30) * 100)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Practice"
        subtitle="A high-level view of clinic performance over the last 30 days."
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Revenue (30d)"
          value={formatGBP(stats.revenueLast30)}
          icon={<Receipt size={16} />}
          accent="sage"
        />
        <Stat
          label="New patients (30d)"
          value={stats.newPatientsLast30}
          icon={<Users size={16} />}
          hint={newPatientsTrend !== null ? `${newPatientsTrend >= 0 ? '+' : ''}${newPatientsTrend}% vs prev 30d` : 'No prior data'}
          accent={newPatientsTrend !== null && newPatientsTrend >= 0 ? 'sage' : 'default'}
        />
        <Stat
          label="Sessions completed (30d)"
          value={stats.completedLast30}
          icon={<ClipboardList size={16} />}
        />
        <Stat
          label="Outstanding"
          value={formatGBP(stats.outstanding)}
          icon={<TrendingUp size={16} />}
          accent={stats.outstanding > 0 ? 'warning' : 'sage'}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-obsidian">What this view tells you</h3>
          <p className="text-sm text-muted leading-relaxed">
            This is the high-level snapshot. For deeper analytics — funnel,
            cohort retention, treatment-mix breakdown, marketing attribution —
            open the <span className="font-medium text-obsidian">Insights</span> or{' '}
            <span className="font-medium text-obsidian">Marketing</span> sub-tabs above.
            For payment-by-payment details, see <span className="font-medium text-obsidian">Money</span>.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default memo(PracticeOverviewSubPanel);
