import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'novogenics_cookie_consent';

type ConsentChoice = 'accepted' | 'declined' | null;

function getStoredConsent(): ConsentChoice {
  try {
    return (localStorage.getItem(STORAGE_KEY) as ConsentChoice) ?? null;
  } catch {
    return null;
  }
}

function storeConsent(choice: 'accepted' | 'declined') {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // private browsing or storage blocked — don't crash
  }
}

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Small delay so the banner doesn't flash before the page paints
    const t = setTimeout(() => {
      if (getStoredConsent() === null) setVisible(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleAccept = () => {
    storeConsent('accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    storeConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[200] p-4 md:p-6 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl border border-black/5 pointer-events-auto overflow-hidden">
        {/* Gold accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-accent-gold to-primary/30" />

        <div className="p-5 md:p-6">
          <div className="flex gap-4 items-start mb-4">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5 shrink-0">privacy_tip</span>
            <div>
              <h2 className="text-sm font-black text-text-main mb-1">Your privacy matters</h2>
              <p className="text-[11px] leading-relaxed text-text-muted">
                We use strictly necessary cookies to keep you signed in and ensure the portal works correctly.
                We do <strong>not</strong> use advertising cookies or sell your data.
                As a UK-registered clinical service we comply with UK GDPR and the Privacy &amp; Electronic
                Communications Regulations.{' '}
                <button
                  onClick={() => setShowDetails(d => !d)}
                  className="underline text-primary hover:text-accent-gold transition-colors focus:outline-none"
                >
                  {showDetails ? 'Hide details' : 'Learn more'}
                </button>
              </p>
            </div>
          </div>

          {showDetails && (
            <div className="mb-4 bg-bg-soft rounded-xl p-4 text-[11px] leading-relaxed text-text-muted space-y-2">
              <p><span className="font-black text-text-main">Strictly necessary cookies</span> — Firebase Authentication session tokens (encrypted, HttpOnly). These are required for the portal to function and cannot be disabled.</p>
              <p><span className="font-black text-text-main">No analytics or marketing cookies</span> are set. We do not use Google Analytics, Facebook Pixel, or any third-party tracking on this platform.</p>
              <p>You can withdraw consent at any time by clearing your browser cookies or contacting us at <span className="text-text-main font-bold">info@novogenics.co.uk</span>.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={handleDecline}
              className="btn-clinical btn-clinical-secondary order-2 sm:order-1 text-[10px]"
            >
              Decline non-essential
            </button>
            <button
              onClick={handleAccept}
              className="btn-clinical btn-clinical-primary order-1 sm:order-2 text-[10px]"
            >
              <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
              Accept & continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
