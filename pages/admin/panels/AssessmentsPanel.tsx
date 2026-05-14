import React, { memo } from 'react';
import { Client } from '../../../types';
import { useAdminContext } from '../context';
import { StatusBadge, FeedbackEditor } from '../AdminComponents';
import { logClinicalAction } from '../../../utils/auditLogger';
import { notifyFeedbackReceived } from '../../../utils/notificationService';
import { Inbox, AlertTriangle, Check, ClipboardList, ExternalLink, Siren, ArrowRight } from 'lucide-react';

function AssessmentsPanel() {
  const {
    filteredClients,
    triageSelectedId,
    setTriageSelectedId,
    getInitials,
    onUpdateClient,
    setSelectedClientId,
    setActiveTab,
    setClientRecordTab,
    user,
  } = useAdminContext();

  const pendingTriage = filteredClients.filter(c => c.status === 'Assessment Submitted');
  const reviewedTriage = filteredClients.filter(c => c.status === 'Reviewed');
  const effectiveTriageId = triageSelectedId ?? (pendingTriage[0]?.id || null);
  const triageSelected = filteredClients.find(c => c.id === effectiveTriageId);

  const getRedFlags = (client: Client) => {
    const flags = client.assessmentData?.answers?.['f9']?.value || client.assessmentData?.answers?.['m9']?.value;
    if (Array.isArray(flags) && flags.length > 0 && !flags.includes('None') && !flags.includes('None of the above')) return flags;
    return [];
  };

  return (
    <div className="animate-fade-up flex flex-col gap-6 h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
        <div className="flex items-baseline gap-3">
          <div>
            <p className="page-eyebrow">Triage</p>
            <h2 className="page-title">Assessments</h2>
          </div>
          {pendingTriage.length > 0 && (
            <span className="status-pill urgent ml-2"><span className="status-dot" />{pendingTriage.length} pending</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="status-pill urgent"><span className="status-dot" />{pendingTriage.length} pending</span>
          <span className="status-pill live"><span className="status-dot" />{reviewedTriage.length} reviewed</span>
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex-grow grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 overflow-hidden">

        {/* LEFT: Queue List */}
        <div className="xl:col-span-4 flex flex-col card-clinical overflow-hidden">
          <div className="p-5 border-b border-black/5 bg-cream/30 shrink-0">
            <p className="text-[10px] font-medium text-muted uppercase">Awaiting Clinical Review</p>
          </div>
          <div className="flex-grow overflow-y-auto no-scrollbar">
            {pendingTriage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center gap-4">
                <Inbox size={48} className="text-primary/20" />
                <p className="text-sm font-medium text-muted">Queue is clear</p>
                <p className="text-xs text-muted/60">No pending assessments</p>
              </div>
            ) : (
              pendingTriage.map(client => {
                const flags = getRedFlags(client);
                const isSelected = effectiveTriageId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left p-4 border-b border-black/[0.03] transition-all hover:bg-cream/50 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-obsidian flex items-center justify-center text-white font-medium text-[10px] shrink-0">
                          {getInitials(client.name)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-obsidian">{client.name}</p>
                          <p className="text-[9px] font-bold text-muted capitalize">{client.gender} · {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'Recently'}</p>
                        </div>
                      </div>
                      {flags.length > 0 && (
                        <span className="shrink-0 flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[8px] font-medium uppercase">
                          <AlertTriangle size={10} />
                          {flags.length} Flag{flags.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted mt-2 line-clamp-2 font-medium">
                      {client.assessmentData?.answers?.['f1']?.value || client.assessmentData?.answers?.['m1']?.value || 'General hair loss concern'}
                    </p>
                  </button>
                );
              })
            )}

            {/* Reviewed section */}
            {reviewedTriage.length > 0 && (
              <>
                <div className="px-5 py-3 bg-cream/50 border-y border-black/5">
                  <p className="text-[9px] font-medium text-muted uppercase">Recently Reviewed</p>
                </div>
                {reviewedTriage.slice(0, 5).map(client => (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left p-5 border-b border-black/5 transition-all hover:bg-cream/50 opacity-60 ${effectiveTriageId === client.id ? 'bg-primary/5 border-l-4 border-l-primary opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700 font-medium text-sm shrink-0">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-obsidian">{client.name}</p>
                        <p className="text-[10px] font-bold text-green-600 uppercase">Reviewed</p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="xl:col-span-8 flex flex-col min-h-0">
          {!triageSelected ? (
            <div className="flex flex-col items-center justify-center h-full card-clinical p-16 text-center gap-4">
              <div className="w-16 h-16 bg-cream rounded-xl flex items-center justify-center text-primary/30">
                <ClipboardList size={32} className="text-primary/30" />
              </div>
              <h3 className="text-base font-medium text-obsidian">Select an Assessment</h3>
              <p className="text-xs text-muted font-medium max-w-xs">Choose a client from the queue to review their submission and provide clinical feedback.</p>
            </div>
          ) : (
            <div className="space-y-5 h-full overflow-y-auto no-scrollbar pb-10">
              {/* Patient Header Card */}
              <div className="bg-obsidian text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-medium text-lg">
                    {getInitials(triageSelected.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-medium">{triageSelected.name}</h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-medium uppercase ${triageSelected.gender === 'male' ? 'bg-blue-500/20 text-blue-300' : 'bg-pink-500/20 text-pink-300'}`}>{triageSelected.gender}</span>
                      <span className="text-[9px] text-gray-400 font-bold">{triageSelected.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={triageSelected.status || 'Assessment Submitted'} />
                  <button
                    onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-2xs font-medium text-hint transition-all"
                  >
                    <ExternalLink size={14} />
                    Full Record
                  </button>
                </div>
              </div>

              {/* Red Flags Alert */}
              {getRedFlags(triageSelected).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
                  <Siren size={18} className="text-red-500 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-medium text-red-700 uppercase mb-2">Clinical Red Flags Detected</p>
                    <div className="flex flex-wrap gap-2">
                      {getRedFlags(triageSelected).map((flag: string, i: number) => (
                        <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-medium">{flag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Assessment Answers Summary */}
              <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm p-6 md:p-8">
                <h4 className="text-[10px] font-medium text-muted uppercase mb-6">Assessment Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {triageSelected.assessmentData?.answers && Object.entries(triageSelected.assessmentData.answers).slice(0, 8).map(([key, val]: [string, any]) => (
                    <div key={key} className="bg-cream/50 rounded-xl p-4">
                      <p className="text-[9px] font-medium text-primary uppercase mb-1">Q{key.replace(/[fm]/, '')}</p>
                      <p className="text-[11px] font-bold text-obsidian leading-relaxed">
                        {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                  className="mt-6 text-[10px] font-medium text-primary uppercase flex items-center gap-1 hover:gap-2 transition-all"
                >
                  View all answers <ArrowRight size={16} />
                </button>
              </div>

              {/* Inline Quick Feedback */}
              <div className="bg-obsidian rounded-[2rem] p-6 md:p-8">
                <h4 className="text-[10px] font-medium text-gray-400 uppercase mb-4">Submit Clinical Feedback</h4>
                <FeedbackEditor
                  initialFeedback={triageSelected.assessmentData?.clinicalFeedback || ''}
                  onSave={async (feedback) => {
                    if (!feedback.trim()) return;
                    try {
                      await onUpdateClient(triageSelected.id, {
                        assessmentData: { ...triageSelected.assessmentData, clinicalFeedback: feedback, reviewDate: new Date().toISOString() },
                        status: 'Reviewed'
                      });
                      await logClinicalAction(user?.id || 'admin', 'triage_feedback', triageSelected.id, 'Submitted triage feedback');
                      notifyFeedbackReceived(triageSelected.id, triageSelected.email, triageSelected.name);
                      const next = pendingTriage.find(c => c.id !== triageSelected.id);
                      setTriageSelectedId(next?.id || reviewedTriage[0]?.id || null);
                    } catch (e) {
                      console.error('Feedback error:', e);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AssessmentsPanel);
