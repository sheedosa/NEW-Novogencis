import React from 'react';
import { Client } from '../../../types';
import { useAdminContext } from '../context';
import { StatusBadge, FeedbackEditor } from '../AdminComponents';
import { logClinicalAction } from '../../../utils/auditLogger';
import { notifyFeedbackReceived } from '../../../utils/notificationService';

export default function AssessmentsPanel() {
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-4xl font-black text-text-main tracking-tight">Triage Queue</h2>
            {pendingTriage.length > 0 && (
              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[11px] font-black uppercase tracking-widest animate-pulse">
                {pendingTriage.length} Pending
              </span>
            )}
          </div>
          <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mt-2">
            Review new intake forms and submit clinical feedback in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-bg-soft p-1 rounded-full border border-black/5 text-[10px] font-black uppercase tracking-widest">
            <span className="px-4 py-2 text-red-500">● {pendingTriage.length} Pending</span>
            <span className="px-4 py-2 text-green-600">✓ {reviewedTriage.length} Reviewed</span>
          </div>
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex-grow grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0 overflow-hidden">

        {/* LEFT: Queue List */}
        <div className="xl:col-span-4 flex flex-col card-clinical overflow-hidden">
          <div className="p-5 border-b border-black/5 bg-bg-soft/30 shrink-0">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Awaiting Clinical Review</p>
          </div>
          <div className="flex-grow overflow-y-auto no-scrollbar">
            {pendingTriage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center gap-4">
                <span className="material-symbols-outlined text-5xl text-primary/20">inbox</span>
                <p className="text-sm font-black text-text-muted">Queue is clear</p>
                <p className="text-xs text-text-muted/60">No pending assessments</p>
              </div>
            ) : (
              pendingTriage.map(client => {
                const flags = getRedFlags(client);
                const isSelected = effectiveTriageId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left p-4 border-b border-black/[0.03] transition-all hover:bg-bg-soft/50 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-clinical-dark flex items-center justify-center text-white font-black text-[10px] shrink-0">
                          {getInitials(client.name)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-text-main">{client.name}</p>
                          <p className="text-[9px] font-bold text-text-muted capitalize">{client.gender} · {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'Recently'}</p>
                        </div>
                      </div>
                      {flags.length > 0 && (
                        <span className="shrink-0 flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">
                          <span className="material-symbols-outlined text-[10px]">warning</span>
                          {flags.length} Flag{flags.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 line-clamp-2 font-medium">
                      {client.assessmentData?.answers?.['f1']?.value || client.assessmentData?.answers?.['m1']?.value || 'General hair loss concern'}
                    </p>
                  </button>
                );
              })
            )}

            {/* Reviewed section */}
            {reviewedTriage.length > 0 && (
              <>
                <div className="px-5 py-3 bg-bg-soft/50 border-y border-black/5">
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Recently Reviewed</p>
                </div>
                {reviewedTriage.slice(0, 5).map(client => (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left p-5 border-b border-black/5 transition-all hover:bg-bg-soft/50 opacity-60 ${effectiveTriageId === client.id ? 'bg-primary/5 border-l-4 border-l-primary opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700 font-black text-sm shrink-0">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-text-main">{client.name}</p>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Reviewed</p>
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
              <div className="w-16 h-16 bg-bg-soft rounded-xl flex items-center justify-center text-primary/30">
                <span className="material-symbols-outlined text-3xl">assignment</span>
              </div>
              <h3 className="text-base font-black text-text-main">Select an Assessment</h3>
              <p className="text-xs text-text-muted font-medium max-w-xs">Choose a client from the queue to review their submission and provide clinical feedback.</p>
            </div>
          ) : (
            <div className="space-y-5 h-full overflow-y-auto no-scrollbar pb-10">
              {/* Patient Header Card */}
              <div className="bg-clinical-dark text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg">
                    {getInitials(triageSelected.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-black">{triageSelected.name}</h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${triageSelected.gender === 'male' ? 'bg-blue-500/20 text-blue-300' : 'bg-pink-500/20 text-pink-300'}`}>{triageSelected.gender}</span>
                      <span className="text-[9px] text-gray-400 font-bold">{triageSelected.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={triageSelected.status || 'Assessment Submitted'} />
                  <button
                    onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                    Full Record
                  </button>
                </div>
              </div>

              {/* Red Flags Alert */}
              {getRedFlags(triageSelected).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
                  <span className="material-symbols-outlined text-red-500 mt-0.5">emergency</span>
                  <div>
                    <p className="text-[11px] font-black text-red-700 uppercase tracking-widest mb-2">Clinical Red Flags Detected</p>
                    <div className="flex flex-wrap gap-2">
                      {getRedFlags(triageSelected).map((flag: string, i: number) => (
                        <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black">{flag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Assessment Answers Summary */}
              <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm p-6 md:p-8">
                <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-6">Assessment Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {triageSelected.assessmentData?.answers && Object.entries(triageSelected.assessmentData.answers).slice(0, 8).map(([key, val]: [string, any]) => (
                    <div key={key} className="bg-bg-soft/50 rounded-xl p-4">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Q{key.replace(/[fm]/, '')}</p>
                      <p className="text-[11px] font-bold text-text-main leading-relaxed">
                        {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                  className="mt-6 text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                >
                  View all answers <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              {/* Inline Quick Feedback */}
              <div className="bg-clinical-dark rounded-[2rem] p-6 md:p-8">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Submit Clinical Feedback</h4>
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
