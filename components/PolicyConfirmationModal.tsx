import React, { useState } from 'react';
import { Page } from '../types';
import { ShieldCheck, Shield, CalendarX2, Check, ExternalLink } from 'lucide-react';
import { Modal, Button } from './ui';

interface PolicyConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onNavigate: (page: Page) => void;
}

const PolicyRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  acceptLabel: string;
  accepted: boolean;
  onToggle: () => void;
  onRead: () => void;
}> = ({ icon, title, description, acceptLabel, accepted, onToggle, onRead }) => (
  <div className="border border-sand rounded-lg p-4 bg-ivory">
    <div className="flex items-center gap-2.5 mb-2">
      <span className="text-muted">{icon}</span>
      <h3 className="text-sm font-medium text-obsidian">{title}</h3>
    </div>
    <p className="text-sm text-muted leading-relaxed mb-3">{description}</p>
    <button
      onClick={onRead}
      className="text-xs text-obsidian hover:underline inline-flex items-center gap-1 mb-4"
    >
      Read full policy <ExternalLink size={11} />
    </button>
    <label className="flex items-start gap-2.5 cursor-pointer group select-none">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${
          accepted ? 'bg-obsidian border-obsidian text-white' : 'border-sand bg-white hover:border-muted'
        }`}
        aria-pressed={accepted}
      >
        {accepted && <Check size={11} strokeWidth={3} />}
      </button>
      <span className="text-sm text-obsidian">{acceptLabel}</span>
    </label>
  </div>
);

const PolicyConfirmationModal: React.FC<PolicyConfirmationModalProps> = ({ isOpen, onConfirm, onNavigate }) => {
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [hasReadCancellation, setHasReadCancellation] = useState(false);

  const canConfirm = hasReadPrivacy && hasReadCancellation;

  return (
    <Modal
      open={isOpen}
      onClose={() => { /* no-op; user must accept */ }}
      title="Clinical agreement"
      subtitle="Please review and accept to continue"
      size="md"
      closeOnBackdrop={false}
      footer={
        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={onConfirm}
            leadingIcon={<ShieldCheck size={14} />}
          >
            Continue to dashboard
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <PolicyRow
          icon={<Shield size={15} />}
          title="Privacy policy"
          description="Your clinical data is handled with strict confidentiality, encryption in transit and at rest, and full GDPR + UK medical data protection compliance."
          acceptLabel="I have read and accept the privacy policy"
          accepted={hasReadPrivacy}
          onToggle={() => setHasReadPrivacy(!hasReadPrivacy)}
          onRead={() => onNavigate(Page.PrivacyPolicy)}
        />
        <PolicyRow
          icon={<CalendarX2 size={15} />}
          title="Cancellation policy"
          description="To ensure all patients receive timely care, we require at least 48 hours notice for cancellations or rescheduling."
          acceptLabel="I have read and accept the cancellation policy"
          accepted={hasReadCancellation}
          onToggle={() => setHasReadCancellation(!hasReadCancellation)}
          onRead={() => onNavigate(Page.CancellationPolicy)}
        />
      </div>
    </Modal>
  );
};

export default PolicyConfirmationModal;
