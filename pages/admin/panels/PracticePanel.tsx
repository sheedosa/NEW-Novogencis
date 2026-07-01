/**
 * Practice — single business-intelligence section.
 *
 * Replaces the previous separate Money / Insights / Marketing top-level tabs.
 * Doctors visit this rarely; founder visits weekly. Collapsing them into one
 * surface frees three sidebar slots that were used for things doctors don't
 * touch daily.
 *
 * Sub-tabs:
 *   - Overview     — high-level snapshot (KPIs + What Changed)
 *   - Money        — payments ledger (formerly MoneyPanel)
 *   - Insights     — analytics dashboards (formerly InsightsPanel)
 *   - Marketing    — acquisition & attribution (formerly MarketingPanel)
 *   - Operations   — workload heatmap + future staff utilisation
 */

import React, { memo, Suspense, lazy } from 'react';
import { useAdminContext } from '../context';
import {
  Receipt, BarChart3, TrendingUp, Activity, LayoutDashboard,
} from 'lucide-react';
import MoneyPanel from './MoneyPanel';
import PracticeOverviewSubPanel from './PracticeOverviewSubPanel';
import OperationsSubPanel from './OperationsSubPanel';

// Insights + Marketing pull in Recharts (heavy). Lazy-load them so the chart
// library only downloads when a user actually opens those sub-tabs — it's no
// longer in the always-loaded admin bundle.
const InsightsPanel = lazy(() => import('./InsightsPanel'));
const MarketingPanel = lazy(() => import('./MarketingPanel'));

const TABS: { id: 'overview' | 'money' | 'insights' | 'marketing' | 'operations'; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={14} /> },
  { id: 'money',      label: 'Money',      icon: <Receipt size={14} /> },
  { id: 'insights',   label: 'Insights',   icon: <BarChart3 size={14} /> },
  { id: 'marketing',  label: 'Marketing',  icon: <TrendingUp size={14} /> },
  { id: 'operations', label: 'Operations', icon: <Activity size={14} /> },
];

const PracticePanel: React.FC = () => {
  const { practiceTab, setPracticeTab } = useAdminContext();

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      {/* Sub-tab bar — horizontal scroll on mobile, fixed on desktop */}
      <div className="-mx-3 sm:-mx-0 px-3 sm:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 bg-cream p-0.5 rounded-md min-w-max sm:min-w-0 w-fit">
          {TABS.map((t) => {
            const isActive = practiceTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setPracticeTab(t.id)}
                className={`px-3 py-1.5 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  isActive ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted hover:text-obsidian'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-panel content */}
      <div>
        {practiceTab === 'overview' && <PracticeOverviewSubPanel />}
        {practiceTab === 'money' && <MoneyPanel />}
        {(practiceTab === 'insights' || practiceTab === 'marketing') && (
          <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading…</div>}>
            {practiceTab === 'insights' && <InsightsPanel />}
            {practiceTab === 'marketing' && <MarketingPanel />}
          </Suspense>
        )}
        {practiceTab === 'operations' && <OperationsSubPanel />}
      </div>
    </div>
  );
};

export default memo(PracticePanel);
