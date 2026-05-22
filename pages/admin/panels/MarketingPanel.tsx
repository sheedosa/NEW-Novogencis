import React, { memo, useMemo, useState } from 'react';
import { useAdminContext } from '../context';
import {
  TrendingUp, Users, Target, BarChart2, ExternalLink,
  CheckCircle, Globe, Instagram, Star, Plug, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  PageHeader, Card, CardHeader, Stat, Badge, EmptyState,
} from '../../../components/ui';
import { aggregateBySource, aggregateByCampaign, computeFunnel } from '../../../utils/marketingService';

const COLORS = {
  primary:  '#C9A86A',
  sage:     '#7FA288',
  terra:    '#C49072',
  indigo:   '#6B7FB8',
  slate:    '#94A3B8',
  obsidian: '#1A1916',
  muted:    '#6E6A65',
};

// Stable colour mapping for source slices so re-renders don't reshuffle them.
const SOURCE_PALETTE = [COLORS.primary, COLORS.sage, COLORS.indigo, COLORS.terra, COLORS.slate, COLORS.obsidian];

type Range = '30d' | '90d' | 'all';

function MarketingPanel() {
  const { filteredClients } = useAdminContext();
  const [range, setRange] = useState<Range>('30d');

  // ── Range filter ───────────────────────────────────────────────────────────
  const clientsInRange = useMemo(() => {
    if (range === 'all') return filteredClients;
    const cutoff = Date.now() - (range === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000;
    return filteredClients.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= cutoff);
  }, [filteredClients, range]);

  // ── Computed metrics ───────────────────────────────────────────────────────
  const totalLeads = clientsInRange.length;
  const attributed = clientsInRange.filter(c => c.leadSource).length;
  const attributionRate = totalLeads === 0 ? 0 : Math.round((attributed / totalLeads) * 100);

  const sourceBreakdown = useMemo(() => aggregateBySource(clientsInRange), [clientsInRange]);
  const campaignBreakdown = useMemo(() => aggregateByCampaign(clientsInRange), [clientsInRange]);
  const funnel = useMemo(() => computeFunnel(clientsInRange), [clientsInRange]);
  const submitted = funnel[0]?.count ?? 0;
  const converted = funnel[funnel.length - 1]?.count ?? 0;
  const overallConversion = submitted === 0 ? 0 : Math.round((converted / submitted) * 100);

  // Top source for the headline KPI
  const topSource = sourceBreakdown[0]?.source ?? '—';

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        eyebrow="Marketing"
        title="Acquisition & funnel"
        subtitle="Where patients come from, how they move through the funnel, and which campaigns are working."
        actions={
          <div className="inline-flex bg-cream rounded-md p-1 gap-1">
            {(['30d', '90d', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                  range === r ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted hover:text-obsidian'
                }`}
              >
                {r === 'all' ? 'All time' : r}
              </button>
            ))}
          </div>
        }
      />

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Leads captured"
          value={totalLeads}
          icon={<Users size={16} />}
          accent="info"
        />
        <Stat
          label="Top source"
          value={<span className="capitalize">{topSource}</span>}
          hint={`${sourceBreakdown[0]?.count ?? 0} leads`}
          icon={<TrendingUp size={16} />}
          accent="sage"
        />
        <Stat
          label="Funnel conversion"
          value={`${overallConversion}%`}
          hint="Submitted → Converted"
          icon={<Target size={16} />}
          accent="gold"
        />
        <Stat
          label="Attribution rate"
          value={`${attributionRate}%`}
          hint={`${attributed} of ${totalLeads} traced`}
          icon={<BarChart2 size={16} />}
          accent={attributionRate < 50 ? 'warning' : 'default'}
        />
      </div>

      {/* ── Funnel + source breakdown ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Funnel chart — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Conversion funnel"
            subtitle={`${submitted} submitted in ${range === 'all' ? 'all time' : `last ${range}`}`}
            leadingIcon={<BarChart2 size={15} className="text-primary" />}
          />
          {submitted === 0 ? (
            <EmptyState
              icon={<BarChart2 size={16} />}
              title="No funnel data yet"
              description="Once patients complete the assessment, you'll see them flow through the funnel here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" horizontal={false} />
                <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fill: COLORS.obsidian, fontSize: 11 }} axisLine={false} tickLine={false} width={85} />
                <Tooltip
                  cursor={{ fill: 'rgba(201, 168, 106, 0.08)' }}
                  contentStyle={{ background: '#fff', border: `1px solid ${COLORS.slate}`, borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Source donut — 1/3 width */}
        <Card>
          <CardHeader
            title="Lead sources"
            subtitle="First-touch attribution"
            leadingIcon={<Users size={15} className="text-primary" />}
          />
          {sourceBreakdown.length === 0 ? (
            <EmptyState
              icon={<Users size={16} />}
              title="No sources yet"
              description="Drive paid traffic with UTM tags to start tracking."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sourceBreakdown}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {sourceBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={SOURCE_PALETTE[idx % SOURCE_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${COLORS.slate}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Campaign performance table ─────────────────────────────────────── */}
      <Card padded={false}>
        <div className="px-4 py-3 border-b border-sand flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-obsidian">Campaign performance</h3>
            <p className="text-xs text-muted mt-0.5">Tagged campaigns from UTM params on assessment landings</p>
          </div>
        </div>
        {campaignBreakdown.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Target size={16} />}
              title="No campaigns tagged yet"
              description="Add ?utm_campaign=spring_2026_prp to your ad URLs to track campaign performance. Same for utm_source, utm_medium."
            />
          </div>
        ) : (
          <>
            {/* Desktop: proper table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream/60">
                    <th className="text-left px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Campaign</th>
                    <th className="text-right px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Leads</th>
                    <th className="text-right px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Converted</th>
                    <th className="text-right px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignBreakdown.map(row => (
                    <tr key={row.campaign} className="border-t border-cream hover:bg-cream/40">
                      <td className="px-4 py-3 text-obsidian font-medium">{row.campaign}</td>
                      <td className="px-4 py-3 text-right text-obsidian">{row.leads}</td>
                      <td className="px-4 py-3 text-right text-obsidian">{row.converted}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={row.conversionRate >= 25 ? 'active' : row.conversionRate >= 10 ? 'pending' : 'inactive'}>
                          {row.conversionRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile: stacked card rows so 4 columns don't require horizontal scroll */}
            <div className="md:hidden flex flex-col">
              {campaignBreakdown.map(row => (
                <div key={row.campaign} className="px-4 py-3 border-t border-cream first:border-t-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-obsidian min-w-0 truncate">{row.campaign}</p>
                    <Badge variant={row.conversionRate >= 25 ? 'active' : row.conversionRate >= 10 ? 'pending' : 'inactive'}>
                      {row.conversionRate}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span><span className="text-obsidian font-medium">{row.leads}</span> leads</span>
                    <span><span className="text-obsidian font-medium">{row.converted}</span> converted</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── Source breakdown table ─────────────────────────────────────────── */}
      {sourceBreakdown.length > 0 && (
        <Card padded={false}>
          <div className="px-4 py-3 border-b border-sand">
            <h3 className="text-sm font-medium text-obsidian">Source detail</h3>
            <p className="text-xs text-muted mt-0.5">Where every traced lead came from</p>
          </div>
          <>
            {/* Desktop: proper 4-column table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream/60">
                    <th className="text-left px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Source</th>
                    <th className="text-left px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Medium</th>
                    <th className="text-right px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Leads</th>
                    <th className="text-right px-4 py-2 text-xs text-hint uppercase tracking-wider font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceBreakdown.map(row => {
                    const share = Math.round((row.count / totalLeads) * 100);
                    return (
                      <tr key={`${row.source}-${row.medium}`} className="border-t border-cream hover:bg-cream/40">
                        <td className="px-4 py-3 text-obsidian font-medium capitalize">{row.source}</td>
                        <td className="px-4 py-3 text-muted capitalize">{row.medium}</td>
                        <td className="px-4 py-3 text-right text-obsidian">{row.count}</td>
                        <td className="px-4 py-3 text-right text-muted">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile: card rows */}
            <div className="md:hidden flex flex-col">
              {sourceBreakdown.map(row => {
                const share = Math.round((row.count / totalLeads) * 100);
                return (
                  <div key={`${row.source}-${row.medium}`} className="px-4 py-3 border-t border-cream first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-obsidian capitalize">{row.source}</p>
                      <span className="text-xs text-muted">{share}% share</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-1">
                      <span className="capitalize">{row.medium}</span>
                      <span className="text-hint">·</span>
                      <span><span className="text-obsidian font-medium">{row.count}</span> leads</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        </Card>
      )}

      {/* ── Connection cards — external integrations not yet wired ─────────── */}
      <div>
        <h3 className="text-sm font-medium text-obsidian mb-3 flex items-center gap-2">
          <Plug size={14} className="text-primary" />
          Connect external sources
          <Badge variant="inactive">Coming soon</Badge>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ConnectionCard
            icon={<Globe size={18} />}
            name="Google Analytics 4"
            description="Pull sessions, top pages, bounce rate, and conversions from your GA4 property."
            href="https://analytics.google.com"
            accent="info"
          />
          <ConnectionCard
            icon={<Instagram size={18} />}
            name="Meta / Instagram"
            description="Instagram follower growth, post reach, ad spend & ROAS via Meta Business API."
            href="https://business.facebook.com"
            accent="gold"
          />
          <ConnectionCard
            icon={<Star size={18} />}
            name="Google Business Profile"
            description="Aggregate your Google Reviews + rating into the Marketing tab."
            href="https://business.google.com"
            accent="warning"
          />
        </div>
      </div>

      {/* ── How attribution works ──────────────────────────────────────────── */}
      <Card tone="subtle" className="!bg-cream/40">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CheckCircle size={16} />
          </div>
          <div className="flex-grow">
            <h4 className="text-sm font-medium text-obsidian mb-1">How attribution works</h4>
            <p className="text-xs text-muted leading-relaxed">
              When a patient lands on the site, the URL's UTM parameters (or the referring domain) are captured to their browser.
              When they later submit an assessment, that first-touch source is attached to their patient record permanently.
              Tag your ad URLs with{' '}
              <code className="px-1.5 py-0.5 rounded bg-obsidian/5 text-obsidian font-mono text-[11px]">?utm_source=google&utm_medium=cpc&utm_campaign=spring_prp</code>
              {' '}for full attribution.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Connection card sub-component ────────────────────────────────────────────

const ACCENT_BG: Record<string, string> = {
  info:    'bg-info-light text-info-text',
  gold:    'bg-primary/10 text-primary',
  warning: 'bg-warning-bg text-warning-text',
};

interface ConnectionCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  href: string;
  accent: 'info' | 'gold' | 'warning';
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({ icon, name, description, href, accent }) => (
  <Card className="flex flex-col gap-3 h-full">
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${ACCENT_BG[accent]}`}>
        {icon}
      </div>
      <Badge variant="inactive">Not connected</Badge>
    </div>
    <div className="flex-grow">
      <h4 className="text-sm font-medium text-obsidian">{name}</h4>
      <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
    </div>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dim transition-colors"
    >
      Open admin <ExternalLink size={11} />
    </a>
  </Card>
);

export default memo(MarketingPanel);
