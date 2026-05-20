import React from 'react';

interface AISurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stronger glow for hero AI surfaces (daily briefing). Default is subtle. */
  strong?: boolean;
  children: React.ReactNode;
}

/**
 * AI Surface — a card variant with a gold gradient hairline border + soft glow.
 * Reserved for Claude-generated content: daily briefing, AI triage card, AI
 * reply drafts. Patients should immediately recognise this visual identity as
 * "AI-assisted, doctor-reviewed".
 */
export const AISurface: React.FC<AISurfaceProps> = ({
  strong = false,
  className = '',
  children,
  ...rest
}) => (
  <div className={`ai-surface ${strong ? 'ai-strong' : ''} ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export default AISurface;
