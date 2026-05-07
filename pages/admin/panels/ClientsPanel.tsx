import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/Card';
import { useAdminContext } from '../context';
import { AssignedBadge } from '../AdminComponents';
import ClientRecord from '../ClientRecord';

const STATUS_OPTIONS = ['All', 'New Inquiry', 'Assessment Submitted', 'Reviewed', 'Contacted', 'Converted', 'Active', 'Ongoing', 'Not Suitable'];

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
    selectedClientId, setSelectedClientId,
    showOnlyAssigned, setShowOnlyAssigned,
    getInitials, isAssignedToMe,
  } = useAdminContext();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filteredClients.filter(c => {
      if (statusFilter !== 'All' && (c.status || 'Active') !== statusFilter) return false;
      if (!q) return true;
      return [c.name, c.email, c.id, c.phone].some(v => v?.toLowerCase().includes(q));
    });
  }, [filteredClients, search, statusFilter]);

  // Real metrics (replace hardcoded 68% / +4%)
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
    return { last30, growth, total, converted, conversionRate, pendingReview };
  }, [filteredClients]);

  return (
    <div className="animate-fade-up space-y-4 md:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-3xl font-black text-text-main">Client Registry</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          {user?.adminType !== 'technical' && (
            <button
              onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${showOnlyAssigned ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-black/5 hover:border-primary/30'}`}
            >
              <span className="material-symbols-outlined text-sm">{showOnlyAssigned ? 'person' : 'group'}</span>
              {showOnlyAssigned ? 'My Assignments' : 'All Clients'}
            </button>
          )}
          <button
            onClick={() => exportClientsToCSV(visibleClients)}
            disabled={visibleClients.length === 0}
            className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {!selectedClientId ? (
        <>
          {/* Desktop Stats — computed from real data */}
          <div className="hidden lg:grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Total Registry</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-text-main leading-none">{stats.total}</p>
                {stats.last30 > 0 && (
                  <span className={`text-[10px] font-bold mb-1 ${stats.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.growth >= 0 ? '+' : ''}{stats.growth}% / 30d
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Active Protocols</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-text-main leading-none">{filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing').length}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Pending Review</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-text-main leading-none">{stats.pendingReview}</p>
                {stats.pendingReview > 0 && <span className="text-[10px] font-bold text-red-500 mb-1">Action Required</span>}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Conversion Rate</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-text-main leading-none">{stats.conversionRate}%</p>
                <span className="text-[10px] font-bold text-text-muted mb-1">{stats.converted}/{stats.total}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-8">
            {/* Mobile View */}
            <div className="lg:hidden">
              <Card className="p-4 md:p-6">
                <div className="relative mb-4 md:mb-6">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search registry..."
                    className="w-full bg-bg-soft border-transparent rounded-xl px-10 py-3.5 md:py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">search</span>
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  {visibleClients.length === 0 && (
                    <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-widest py-8">
                      {filteredClients.length === 0 ? 'No clients yet' : 'No matches'}
                    </p>
                  )}
                  {visibleClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-2xl transition-all text-left group border ${selectedClientId === c.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-bg-soft hover:border-black/5'}`}
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] md:text-xs group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-text-main truncate">{c.name}</p>
                          <AssignedBadge isAssigned={isAssignedToMe(c)} />
                          {c.policiesAccepted && (
                            <span className="material-symbols-outlined text-green-500 text-sm font-black" title="Policies Accepted">check_circle</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{c.id}</p>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{c.status || 'Active'}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-text-muted/30 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Card className="overflow-hidden border-none shadow-sm rounded-[2.5rem]">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white">
                  <div className="relative w-96">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, email or ID..."
                      className="w-full bg-bg-soft border-transparent rounded-2xl px-12 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <button
                      onClick={() => exportClientsToCSV(visibleClients)}
                      disabled={visibleClients.length === 0}
                      className="px-6 py-3 bg-bg-soft text-text-muted rounded-xl text-[10px] font-black uppercase tracking-widest border border-black/5 hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Export CSV
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowFilterMenu(s => !s)}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${statusFilter !== 'All' ? 'bg-primary text-clinical-dark border-primary' : 'bg-bg-soft text-text-muted border-black/5 hover:border-primary/30'}`}
                      >
                        Filter{statusFilter !== 'All' ? `: ${statusFilter}` : ''}
                      </button>
                      {showFilterMenu && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-black/5 z-20 overflow-hidden">
                          {STATUS_OPTIONS.map(s => (
                            <button
                              key={s}
                              onClick={() => { setStatusFilter(s); setShowFilterMenu(false); }}
                              className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${statusFilter === s ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-bg-soft'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-bg-soft/50 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-black/5">
                      <tr>
                        <th className="px-8 py-6">Profile &amp; Contact</th>
                        <th className="px-8 py-6">Status &amp; Activity</th>
                        <th className="px-8 py-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {visibleClients.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-8 py-16 text-center">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                              {filteredClients.length === 0 ? 'No clients in registry yet' : 'No clients match your search'}
                            </p>
                          </td>
                        </tr>
                      )}
                      {visibleClients.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedClientId(c.id)}
                          className="hover:bg-bg-soft/40 transition-colors cursor-pointer group"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs group-hover:bg-primary group-hover:text-white transition-all">
                                {getInitials(c.name)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-text-main">{c.name}</p>
                                  <AssignedBadge isAssigned={isAssignedToMe(c)} />
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1">
                                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">ID: {c.id}</p>
                                  <div className="flex items-center gap-2 text-text-muted mt-1">
                                    <div className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[10px]">mail</span>
                                      <span className="text-[9px] font-bold">{c.email}</span>
                                    </div>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <div className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[10px]">call</span>
                                      <span className="text-[9px] font-bold">{c.phone}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-2">
                              <span className={`w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                c.status === 'Active' || !c.status ? 'bg-green-100 text-green-700' :
                                c.status === 'Assessment Submitted' ? 'bg-blue-100 text-blue-700' :
                                c.status === 'Consultation Pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {c.status || 'Active'}
                              </span>
                              <div>
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">Last Interaction</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-text-main">
                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                                  </p>
                                  <p className="text-[10px] text-text-muted font-medium">
                                    {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:45 AM'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedClientId(c.id); }}
                              className="bg-clinical-dark text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-clinical-dark transition-all shadow-sm"
                            >
                              View Record
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
          <div className={`lg:col-span-4 ${selectedClientId ? 'hidden lg:block' : 'block'}`}>
            <Card className="p-4 md:p-6 h-full lg:h-[calc(100vh-16rem)] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Registry</h3>
                <button onClick={() => setSelectedClientId(null)} className="text-[10px] font-black text-primary uppercase hover:underline">
                  Back to Table
                </button>
              </div>
              <div className="relative mb-4 md:mb-6">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search registry..."
                  className="w-full bg-bg-soft border-transparent rounded-xl px-10 py-3.5 md:py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">search</span>
              </div>
              <div className="space-y-1.5 md:space-y-2 overflow-y-auto no-scrollbar flex-grow">
                {visibleClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-2xl transition-all text-left group border ${selectedClientId === c.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-bg-soft hover:border-black/5'}`}
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] md:text-xs group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-text-main truncate">{c.name}</p>
                        <AssignedBadge isAssigned={isAssignedToMe(c)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{c.id}</p>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{c.status || 'Active'}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-text-muted/30 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
          <div className={`lg:col-span-8 ${selectedClientId ? 'block' : 'hidden lg:block'}`}>
            <ClientRecord />
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPanel;
