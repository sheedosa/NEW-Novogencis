import React, { memo, useState } from 'react';
import { Client, AITriage } from '../../../types';
import { useAdminContext } from '../context';
import { FeedbackEditor } from '../AdminComponents';
import { logClinicalAction } from '../../../utils/auditLogger';
import { notifyFeedbackReceived } from '../../../utils/notificationService';
import {
  Inbox, AlertTriangle, Check, ClipboardList, ExternalLink,
  Siren, ArrowRight, Sparkles, RefreshCw, Brain, FileText,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Badge, StatusBadge, Button, EmptyState,
} from '../../../components/ui';

const SUITABILITY_VARIANT: Record<AITriage['suitability'], 'active' | 'pending' | 'danger'> = {
  'strong-candidate': 'active',
  'suitable-with-caveats': 'pending',
  'not-suitable': 'danger',
};

const SUITABILITY_LABEL: Record<AITriage['suitability'], string> = {
  'strong-candidate': 'Strong candidate',
  'suitable-with-caveats': 'Suitable with caveats',
  'not-suitable': 'Not suitable',
};

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

  // Lets the doctor click "Use this draft" to load the AI draft into the editor.
  const [useAiDraftForClientId, setUseAiDraftForClientId] = useState<string | null>(null);

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
    <div className="animate-fade-up flex flex-col gap-4 h-[calc(100vh-9rem)]">
      <PageHeader
        title="Assessments"
        subtitle="Review intake forms and submit clinical feedback"
        actions={
          <div className="flex items-center gap-1.5">
            <Badge variant="pending">{pendingTriage.length} pending</Badge>
            <Badge variant="active">{reviewedTriage.length} reviewed</Badge>
          </div>
        }
      />

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Queue list */}
        <Card padded={false} className="lg:col-span-4 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-sand shrink-0">
            <p className="text-sm font-medium text-obsidian">Awaiting review</p>
          </div>
          <div className="flex-grow overflow-y-auto">
            {pendingTriage.length === 0 ? (
              <EmptyState
                icon={<Inbox size={16} />}
                title="Queue is clear"
                description="No assessments awaiting review."
              />
            ) : (
              pendingTriage.map(client => {
                const flags = getRedFlags(client);
                const isSelected = effectiveTriageId === client.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left px-4 py-3 border-b border-cream hover:bg-cream/50 transition-colors relative ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="avatar avatar-sm shrink-0">{getInitials(client.name)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">{client.name}</p>
                          <p className="text-xs text-muted capitalize">
                            {client.gender} · {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                      {flags.length > 0 && (
                        <Badge variant="danger" icon={<AlertTriangle size={10} />}>
                          {flags.length} flag{flags.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                      {client.assessmentData?.answers?.['f1']?.value || client.assessmentData?.answers?.['m1']?.value || 'General hair loss concern'}
                    </p>
                  </button>
                );
              })
            )}

            {reviewedTriage.length > 0 && (
              <>
                <div className="px-4 py-2 bg-cream/60 border-y border-sand">
                  <p className="text-xs font-medium text-muted">Recently reviewed</p>
                </div>
                {reviewedTriage.slice(0, 5).map(client => (
                  <button
                    key={client.id}
                    onClick={() => setTriageSelectedId(client.id)}
                    className={`w-full text-left px-4 py-3 border-b border-cream hover:bg-cream/50 transition-colors flex items-center gap-2.5 relative ${effectiveTriageId === client.id ? 'bg-primary/5' : 'opacity-70'}`}
                  >
                    {effectiveTriageId === client.id && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                    <div className="w-7 h-7 rounded-md bg-success-bg flex items-center justify-center text-success shrink-0">
                      <Check size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-obsidian truncate">{client.name}</p>
                      <p className="text-xs text-success">Reviewed</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </Card>

        {/* Detail */}
        <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden">
          {!triageSelected ? (
            <Card className="h-full flex items-center justify-center">
              <EmptyState
                icon={<ClipboardList size={16} />}
                title="Select an assessment"
                description="Choose a client from the queue to review their submission."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
              {/* Patient header */}
              <Card tone="dark">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="avatar avatar-lg">{getInitials(triageSelected.name)}</div>
                    <div>
                      <h3 className="text-base font-medium text-white">{triageSelected.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-white/60">
                        <span className="capitalize">{triageSelected.gender}</span>
                        <span className="w-1 h-1 bg-white/30 rounded-full" />
                        <span>{triageSelected.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={triageSelected.status || 'Assessment Submitted'} />
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<ExternalLink size={13} />}
                      onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                      className="!text-white !border-white/20 hover:!bg-white/10"
                    >
                      Full record
                    </Button>
                  </div>
                </div>
              </Card>

              {/* AI Triage card */}
              <AITriageCard
                client={triageSelected}
                onUseDraft={() => setUseAiDraftForClientId(triageSelected.id)}
              />

              {/* Red flags (multi-select question answer) */}
              {getRedFlags(triageSelected).length > 0 && (
                <Card className="!bg-danger-bg !border-danger/20">
                  <div className="flex items-start gap-3">
                    <Siren size={16} className="text-danger mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-danger-text mb-2">Patient-reported red flags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {getRedFlags(triageSelected).map((flag: string, i: number) => (
                          <Badge key={i} variant="danger">{flag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Answer summary */}
              <Card>
                <CardHeader
                  title="Assessment summary"
                  trailing={
                    <Button
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ArrowRight size={13} />}
                      onClick={() => { setSelectedClientId(triageSelected.id); setActiveTab('clients'); setClientRecordTab('assessment'); }}
                    >
                      View all
                    </Button>
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {triageSelected.assessmentData?.answers && Object.entries(triageSelected.assessmentData.answers).slice(0, 8).map(([key, val]: [string, any]) => (
                    <div key={key} className="bg-cream/60 rounded-md px-3 py-2">
                      <p className="text-xs text-hint mb-0.5">Q{key.replace(/[fm]/, '')}</p>
                      <p className="text-sm text-obsidian leading-snug">
                        {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Feedback */}
              <Card tone="dark">
                <CardHeader
                  title={<span className="text-white">Submit clinical feedback</span>}
                  subtitle={<span className="text-white/60">Client will be notified by email and in-portal.</span>}
                />
                <FeedbackEditor
                  key={useAiDraftForClientId === triageSelected.id ? `ai-${triageSelected.id}` : triageSelected.id}
                  initialFeedback={
                    useAiDraftForClientId === triageSelected.id
                      ? triageSelected.aiTriage?.draftFeedback || ''
                      : triageSelected.assessmentData?.clinicalFeedback || ''
                  }
                  onSave={async (feedback) => {
                    if (!feedback.trim()) return;
                    try {
                      const updates: Partial<Client> = {
                        assessmentData: { ...triageSelected.assessmentData, clinicalFeedback: feedback, reviewDate: new Date().toISOString() },
                        status: 'Reviewed',
                      };
                      // Mark AI triage as sent if it informed this feedback.
                      if (triageSelected.aiTriage) {
                        updates.aiTriage = { ...triageSelected.aiTriage, status: 'sent' };
                      }
                      await onUpdateClient(triageSelected.id, updates);
                      await logClinicalAction(user?.id || 'admin', 'triage_feedback', triageSelected.id, 'Submitted triage feedback');
                      notifyFeedbackReceived(triageSelected.id, triageSelected.email, triageSelected.name);
                      setUseAiDraftForClientId(null);
                      const next = pendingTriage.find(c => c.id !== triageSelected.id);
                      setTriageSelectedId(next?.id || reviewedTriage[0]?.id || null);
                    } catch (e) {
                      console.error('Feedback error:', e);
                      alert('Failed to submit feedback. Please try again.');
                    }
                  }}
                />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AssessmentsPanel);

// ─────────────────────────────────────────────────────────────────────────────
// AI Triage Card
// ─────────────────────────────────────────────────────────────────────────────
// Renders the structured AI triage (clinical impression, red flags, suitability,
// recommended treatments, draft feedback) produced by the Cloud Function.
// Doctor uses "Use this draft" to populate the feedback editor with the AI text.

interface AITriageCardProps {
  client: Client;
  onUseDraft: () => void;
}

const AITriageCard: React.FC<AITriageCardProps> = ({ client, onUseDraft }) => {
  const triage = client.aiTriage;

  // No triage yet — either still being generated or the function never ran.
  // Show a "generating" state if the client is recent, otherwise a quiet hint.
  if (!triage) {
    const isRecent = client.createdAt
      ? Date.now() - new Date(client.createdAt).getTime() < 5 * 60 * 1000
      : false;
    return (
      <Card className="!border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {isRecent ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
          </div>
          <div className="flex-grow">
            <p className="text-sm font-medium text-obsidian">
              {isRecent ? 'AI is analysing this assessment…' : 'AI triage not available'}
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              {isRecent
                ? 'Clinical impression, red flag check and draft feedback will appear in a few seconds.'
                : 'This assessment was submitted before AI triage was enabled, or the function did not run. Review manually below.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Function ran but failed — show a clear failure state.
  if (triage.error || (!triage.impression && !triage.draftFeedback)) {
    return (
      <Card className="!bg-warning-bg !border-warning/30">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning-text mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-warning-text">AI triage failed</p>
            <p className="text-xs text-muted mt-0.5">
              {triage.error || 'No content returned. Review the assessment manually below.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="!border-primary/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Brain size={14} />
          </div>
          <div>
            <p className="text-sm font-medium text-obsidian">AI clinical triage</p>
            <p className="text-2xs text-muted">
              Generated {new Date(triage.generatedAt).toLocaleString('en-GB')} · {triage.model} · {triage.usage?.input ?? 0} → {triage.usage?.output ?? 0} tokens
            </p>
          </div>
        </div>
        <Badge variant={SUITABILITY_VARIANT[triage.suitability]}>
          {SUITABILITY_LABEL[triage.suitability]}
        </Badge>
      </div>

      {/* Clinical impression */}
      {triage.impression && (
        <div className="bg-cream/60 rounded-md p-3 mb-3">
          <p className="text-2xs text-hint uppercase tracking-wider mb-1.5">Clinical impression</p>
          <p className="text-sm text-obsidian leading-relaxed">{triage.impression}</p>
        </div>
      )}

      {/* AI-detected red flags */}
      {triage.redFlags.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs text-hint uppercase tracking-wider mb-1.5">AI-detected red flags</p>
          <div className="flex flex-wrap gap-1.5">
            {triage.redFlags.map((flag, i) => (
              <Badge key={i} variant="danger" icon={<AlertTriangle size={10} />}>{flag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suitability reason */}
      {triage.suitabilityReason && (
        <div className="mb-3">
          <p className="text-2xs text-hint uppercase tracking-wider mb-1.5">Why</p>
          <p className="text-sm text-obsidian leading-relaxed">{triage.suitabilityReason}</p>
        </div>
      )}

      {/* Recommended treatments */}
      {triage.recommendedTreatments.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs text-hint uppercase tracking-wider mb-1.5">Recommended treatments</p>
          <div className="flex flex-wrap gap-1.5">
            {triage.recommendedTreatments.map((t, i) => (
              <Badge key={i} variant="active">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Draft feedback letter — collapsed preview with "use this draft" CTA */}
      {triage.draftFeedback && (
        <div className="mt-4 pt-4 border-t border-sand">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-muted" />
              <p className="text-sm font-medium text-obsidian">Draft feedback letter</p>
              {triage.status === 'sent' && <Badge variant="active" icon={<Check size={10} />}>Sent</Badge>}
            </div>
            {triage.status !== 'sent' && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Sparkles size={12} />}
                onClick={onUseDraft}
              >
                Use this draft
              </Button>
            )}
          </div>
          <div className="bg-cream/40 rounded-md p-3 max-h-40 overflow-y-auto">
            <p className="text-sm text-obsidian leading-relaxed whitespace-pre-wrap">{triage.draftFeedback}</p>
          </div>
          <p className="text-2xs text-muted mt-1.5">
            AI-generated — must be reviewed and edited by a clinician before sending.
          </p>
        </div>
      )}
    </Card>
  );
};
