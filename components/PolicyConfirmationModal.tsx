import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page } from '../types';

interface PolicyConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onNavigate: (page: Page) => void;
}

const PolicyConfirmationModal: React.FC<PolicyConfirmationModalProps> = ({ isOpen, onConfirm, onNavigate }) => {
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [hasReadCancellation, setHasReadCancellation] = useState(false);

  const canConfirm = hasReadPrivacy && hasReadCancellation;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-clinical-dark/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-8 md:p-12 overflow-y-auto no-scrollbar">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-3xl text-primary">verified_user</span>
                </div>
                <h2 className="text-3xl font-black text-text-main tracking-tight uppercase">Clinical Agreement</h2>
                <p className="text-text-muted mt-2 font-medium">Please review and confirm our clinical policies to continue to your dashboard.</p>
              </div>

              <div className="space-y-8">
                <div className="p-6 bg-bg-soft rounded-3xl border border-black/5">
                  <h3 className="text-sm font-black text-text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">privacy_tip</span>
                    Privacy Policy
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    Your clinical data is handled with the highest level of confidentiality. We use advanced encryption and strictly adhere to medical data protection standards.
                  </p>
                  <button 
                    onClick={() => onNavigate(Page.PrivacyPolicy)}
                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                  >
                    Read Full Privacy Policy
                  </button>
                  <div className="mt-6 flex items-center gap-3">
                    <button 
                      onClick={() => setHasReadPrivacy(!hasReadPrivacy)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${hasReadPrivacy ? 'bg-primary border-primary text-white' : 'border-black/10 bg-white'}`}
                    >
                      {hasReadPrivacy && <span className="material-symbols-outlined text-sm font-black">check</span>}
                    </button>
                    <span className="text-[11px] font-bold text-text-main">I have read and accept the Privacy Policy</span>
                  </div>
                </div>

                <div className="p-6 bg-bg-soft rounded-3xl border border-black/5">
                  <h3 className="text-sm font-black text-text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">event_busy</span>
                    Cancellation Policy
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    To ensure all patients receive timely care, we require at least 48 hours notice for cancellations or rescheduling.
                  </p>
                  <button 
                    onClick={() => onNavigate(Page.CancellationPolicy)}
                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                  >
                    Read Full Cancellation Policy
                  </button>
                  <div className="mt-6 flex items-center gap-3">
                    <button 
                      onClick={() => setHasReadCancellation(!hasReadCancellation)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${hasReadCancellation ? 'bg-primary border-primary text-white' : 'border-black/10 bg-white'}`}
                    >
                      {hasReadCancellation && <span className="material-symbols-outlined text-sm font-black">check</span>}
                    </button>
                    <span className="text-[11px] font-bold text-text-main">I have read and accept the Cancellation Policy</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-bg-soft border-t border-black/5">
              <button
                disabled={!canConfirm}
                onClick={onConfirm}
                className={`w-full py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                  canConfirm 
                    ? 'bg-primary text-clinical-dark shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Confirm & Continue to Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PolicyConfirmationModal;
