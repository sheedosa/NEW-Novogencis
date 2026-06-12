import React, { useMemo, useState, useRef, memo } from 'react';
import {
  Download, Search, CheckCircle, ChevronRight,
  Users as UsersIcon, User as UserIcon, ArrowLeft,
  UserPlus, Clock, Activity, Moon, AlertTriangle,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAdminContext } from '../context';
import { AssignedBadge } from '../AdminComponents';
import ClientRecord from '../ClientRecord';
import {
  PageHeader, Stat, Card, Button, StatusBadge, EmptyState,
} from '../../../components/ui';

function exportClientsToCSV(clients: { id: string; name: string; email: string; phone: string; status?: string; createdAt?: string }[]) {
  const header = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Created'];
  const rows = clients.map(c => [
    c.id,
    c.name || '',
    c.email || '',
    c.phone || '',
    c.status || 'Active',
    c.createdAt ? new Date(c.createdAt).toISOString() : '',
  ]);
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novogenics-clients-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ClientsPanel: React.FC = () => {
  const {
    user,
    filteredClients,
    appointments,
    selectedClientId, setSelectedClientId,
    showOnlyAssigned, setShowOnlyAssigned,
    getInitials, isAssignedToMe,
  } = useAdminContext();

  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'all' | 'new-leads' | 'due-followup' | 'active' | 'lapsed' | 'at-risk'>('all');

  // Smart-segment classifiers — computed once per client list.
  // Each client is independently checked against every segment.
  const segmentMatcher = useMemo(() => {
    const now = Date.now();
    const ms = (d: number) => d * 24 * 60 * 60 * 1000;
    const appointmentsByClient = appointments.reduce<Record<string, typeof appointments>>((acc, a) => {
      (acc[a.clientId] = acc[a.clientId] || []).push(a);
      return acc;
    }, {});

    const matchers: Record<string, (c: any) => boolean> = {
      'all': () => true,
      'new-leads': (c) => ['New Inquiry', 'Assessment Submitted'].includes(c.status || ''),
      'due-followup': (c) => {
        // Reviewed status with no follow-up booking, OR Contacted with no booking yet
        if (!['Reviewed', 'Contacted'].includes(c.status || '')) return false;
        const aps = appointmentsByClient[c.id] || [];
        const hasUpcoming = aps.some((a: any) => (a.status === 'Confirmed' || a.status === 'Pending') && new Date(a.date) >= new Date(new Date().toDateString()));
        return !hasUpcoming;
      },
      'active': (c) => ['Active', 'Ongoing', 'Converted'].includes(c.status || ''),
      'lapsed': (c) => {
        // Any patient with no activity in the last 90 days
        const aps = appointmentsByClient[c.id] || [];
        if (aps.length === 0) {
          // never booked: lapsed if created >90 days ago
          return c.createdAt ? now - new Date(c.createdAt).getTime() > ms(90) : false;
        }
        const lastActivity = Math.max(...aps.map((a: any) => new Date(a.date).getTime()));
        return now - lastActivity > ms(90);
      },
      'at-risk': (c) => {
        // Active patient with no upcoming and 60+ days since last visit
        if (!['Active', 'Ongoing', 'Converted'].includes(c.status || '')) return false;
        const aps = appointmentsByClient[c.id] || [];
        const upcoming = aps.find((a: any) => (a.status === 'Confirmed' || a.status === 'Pending') && new Date(a.date) >= new Date(new Date().toDateString()));
        if (upcoming) return false;
        const lastVisit = aps.filter((a: any) => a.status === 'Completed').sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return lastVisit ? now - new Date(lastVisit.date).getTime() > ms(60) : false;
      },
    };
    return matchers;
  }, [appointments]);

  // Counts per segment for the chips
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(segmentMatcher).forEach(k => {
      counts[k] = filteredClients.filter(segmentMatcher[k]).length;
    });
    return counts;
  }, [filteredClients, segmentMatcher]);

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const segMatch = segmentMatcher[segment];
    return filteredClients.filter(c => {
      if (segment !== 'all' && !segMatch(c)) return false;
      if (!q) return true;
      return [c.name, c.email, c.id, c.phone].some(v => v?.toLowerCase().includes(q));
    });
  }, [filteredClients, search, segment, segmentMatcher]);

  const stats = useMemo(() => {
    const now = Date.now();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const last30 = filteredClients.filter(c => c.createdAt && now - new Date(c.createdAt).getTime() < ms30d).length;
    const prev30 = filteredClients.filter(c => {
      if (!c.createdAt) return false;
      const t = new Date(c.createdAt).getTime();
      return now - t >= ms30d && now - t < 2 * ms30d;
    }).length;
    const growth = prev30 === 0 ? (last30 > 0 ? 100 : 0) : Math.round(((last30 - prev30) / prev30) * 100);
    const total = filteredClients.length;
    const converted = filteredClients.filter(c => c.status === 'Converted' || c.status === 'Active' || c.status === 'Ongoing').length;
    const conversionRate = total === 0 ? 0 : Math.round((converted / total) * 100);
    const pendingReview = filteredClients.filter(c => c.status === 'Assessment Submitted').length;
    const activeProtocols = filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing').length;
    return { last30, growth, total, converted, conversionRate, pendingReview, activeProtocols };
  }, [filteredClients]);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Desktop rows are 3 text lines tall (~90px); measureElement corrects per-row.
  const tableVirtualizer = useVirtualizer({
    count: visibleClients.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 90,
    overscan: 5,
  });
  const sidebarVirtualizer = useVirtualizer({
    count: visibleClients.length,
    getScrollElement: () => sidebarScrollRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });
  const mobileVirtualizer = useVirtualizer({
    count: visibleClients.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <PageHeader
        title="Clients"
        subtitle={`${stats.total} registered`}
        actions={
          <>
            {user?.adminType !== 'technical' && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={showOnlyAssigned ? <UserIcon size={13} /> : <UsersIcon size={13} />}
                onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
              >
                {showOnlyAssigned ? 'My clients' : 'All clients'}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Download size={13} />}
              onClick={() => exportClientsToCSV(visibleClients)}
              disabled={visibleClients.length === 0}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {!selectedClientId ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              label="Total registry"
              value={stats.total}
              icon={<UsersIcon size={16} />}
              accent="info"
              delta={stats.last30 > 0 ? { value: `${stats.growth >= 0 ? '+' : ''}${stats.growth}% · 30d`, direction: stats.growth >= 0 ? 'up' : 'down' } : undefined}
            />
            <Stat label="Active protocols" value={stats.activeProtocols} icon={<Activity size={16} />} accent="sage" />
            <Stat label="Pending review" value={stats.pendingReview} icon={<Clock size={16} />} accent="warning" />
            <Stat
              label="Booking rate"
              value={`${stats.conversionRate}%`}
              icon={<CheckCircle size={16} />}
              accent="gold"
              hint={`${stats.converted} of ${stats.total}`}
            />
          </div>

          {/* ── Smart segments — saved views that surface action.
              Wrap on phones so At-risk / Lapsed are never hidden off-screen. ── */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'all',           label: 'All',           icon: <UsersIcon size={13} /> },
              { id: 'new-leads',     label: 'New leads',     icon: <UserPlus size={13} /> },
              { id: 'due-followup',  label: 'Due follow-up', icon: <Clock size={13} /> },
              { id: 'active',        label: 'Active',        icon: <Activity size={13} /> },
              { id: 'at-risk',       label: 'At risk',       icon: <AlertTriangle size={13} /> },
              { id: 'lapsed',        label: 'Lapsed 90d+',   icon: <Moon size={13} /> },
            ] as const).map(seg => {
              const count = segmentCounts[seg.id] ?? 0;
              const isActive = segment === seg.id;
              return (
                <button
                  key={seg.id}
                  onClick={() => setSegment(seg.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-obsidian text-white font-medium'
                      : 'text-muted hover:bg-cream hover:text-obsidian'
                  }`}
                >
                  {seg.icon}
                  <span>{seg.label}</span>
                  {count > 0 && (
                    <span className={`text-xs ${isActive ? 'text-primary' : 'text-hint'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile cards */}
          <Card padded={false} className="lg:hidden">
            <div className="search-wrap p-3 border-b border-sand">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search registry…"
                className="search-input"
              />
            </div>
            {visibleClients.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={16} />}
                title={filteredClients.length === 0 ? 'No clients yet' : 'No matches'}
                compact
              />
            ) : (
              <div ref={mobileScrollRef} className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
                  {mobileVirtualizer.getVirtualItems().map(virtualRow => {
                    const c = visibleClients[virtualRow.index];
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClientId(c.id)}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-cream/60 border-b border-cream transition-colors text-left"
                      >
                        <div className="avatar avatar-md">{getInitials(c.name)}</div>
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-obsidian truncate">{c.name}</p>
                            <AssignedBadge isAssigned={isAssignedToMe(c)} />
                            {c.policiesAccepted && <CheckCircle size={12} className="text-success" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted min-w-0">
                            <span className="truncate">{c.email}</span>
                            <span className="shrink-0"><StatusBadge status={c.status || 'Active'} /></span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-hint shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Desktop table */}
          <Card padded={false} className="hidden lg:block overflow-hidden">
            {/* Search only — the smart segments above are the one filter system */}
            <div className="px-4 py-3 border-b border-sand">
              <div className="search-wrap max-w-md">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or ID…"
                  className="search-input"
                />
              </div>
            </div>

            {visibleClients.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={16} />}
                title={filteredClients.length === 0 ? 'No clients yet' : 'No matches'}
              />
            ) : (
              <div ref={tableScrollRef} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ height: tableVirtualizer.getTotalSize(), position: 'relative' }}>
                  {tableVirtualizer.getVirtualItems().map(virtualRow => {
                    const c = visibleClients[virtualRow.index];
                    return (
                      <div
                        key={c.id}
                        ref={tableVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        onClick={() => setSelectedClientId(c.id)}
                        className="grid grid-cols-[1fr_auto] hover:bg-cream/40 transition-colors cursor-pointer border-b border-cream items-center"
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
                      >
                        {/* One readable block per patient: who → how to reach them → where they are */}
                        <div className="px-4 py-3.5 flex items-center gap-3 min-w-0">
                          <div className="avatar avatar-md shrink-0">{getInitials(c.name)}</div>
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-obsidian truncate">{c.name}</p>
                              <AssignedBadge isAssigned={isAssignedToMe(c)} />
                            </div>
                            <p className="text-xs text-muted truncate">
                              {c.email}{c.phone ? ` · ${c.phone}` : ''}
                            </p>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={c.status || 'Active'} />
                              <span className="text-xs text-hint">
                                Added {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : 'recently'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3.5 flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setSelectedClientId(c.id); }}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <Card padded={false} className={`lg:col-span-4 flex flex-col lg:h-[calc(100vh-12rem)] overflow-hidden ${selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="px-3 py-2.5 border-b border-sand flex items-center justify-between shrink-0">
              <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={13} />} onClick={() => setSelectedClientId(null)}>
                Back to list
              </Button>
            </div>
            <div className="search-wrap p-3 border-b border-sand">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search registry…"
                className="search-input"
              />
            </div>
            <div ref={sidebarScrollRef} className="overflow-y-auto flex-grow" style={{ minHeight: 0 }}>
              <div style={{ height: sidebarVirtualizer.getTotalSize(), position: 'relative' }}>
                {sidebarVirtualizer.getVirtualItems().map(virtualRow => {
                  const c = visibleClients[virtualRow.index];
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-cream hover:bg-cream/60 transition-colors text-left relative ${
                        selectedClientId === c.id ? 'bg-primary/5' : ''
                      }`}
                    >
                      {selectedClientId === c.id && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                      <div className="avatar avatar-sm">{getInitials(c.name)}</div>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-obsidian truncate">{c.name}</p>
                          <AssignedBadge isAssigned={isAssignedToMe(c)} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-hint">
                          <span className="font-mono">{c.id}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
          <div className={`lg:col-span-8 ${selectedClientId ? 'block' : 'hidden lg:block'}`}>
            <ClientRecord />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ClientsPanel);
