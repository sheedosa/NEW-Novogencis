/**
 * Marketing / lead-source attribution service.
 *
 * Pattern: capture UTM params on the visitor's FIRST landing, persist to
 * localStorage so it survives the assessment flow, then attach to their
 * Client doc on account creation. This gives the Marketing tab real
 * attribution for every patient who completes an assessment.
 *
 * Anonymous pre-signup analytics (page views, bounce, sessions) come from
 * GA4 — that's its strength and it's free.
 */

import type { LeadSource } from '../types';

const STORAGE_KEY = 'novogenics_lead_source';

/**
 * Parse UTM params from current URL and persist to localStorage if this is
 * the visitor's first landing (no existing capture). Call once on app load.
 */
export function captureLeadSourceOnFirstVisit(): void {
  try {
    // Don't overwrite an earlier capture — the FIRST touch is what matters.
    if (localStorage.getItem(STORAGE_KEY)) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Only persist a capture if there's a UTM param OR an external referrer
    // (otherwise it's a return visitor with no marketing signal — leave blank).
    const hasUtm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
      .some(k => params.has(k));
    const externalReferrer = document.referrer && !document.referrer.includes(window.location.host);

    if (!hasUtm && !externalReferrer) {
      // Direct visit — capture that fact so we don't keep checking.
      const direct: LeadSource = {
        utm_source: 'direct',
        utm_medium: 'none',
        landingPage: url.pathname || '/',
        capturedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(direct));
      return;
    }

    const source: LeadSource = {
      utm_source: params.get('utm_source') || inferSourceFromReferrer(document.referrer) || 'unknown',
      utm_medium: params.get('utm_medium') || inferMediumFromReferrer(document.referrer) || 'referral',
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_term: params.get('utm_term') || undefined,
      utm_content: params.get('utm_content') || undefined,
      referrer: externalReferrer ? safeHost(document.referrer) : undefined,
      landingPage: url.pathname || '/',
      capturedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
  } catch {
    // localStorage can be blocked (private mode, quota); attribution is
    // optional, so swallow silently rather than break the app.
  }
}

/**
 * Returns the captured lead source if available. Use when creating a Client
 * doc to attach attribution to the patient record.
 */
export function getCapturedLeadSource(): LeadSource | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as LeadSource;
  } catch {
    return undefined;
  }
}

/**
 * Clear the stored lead source. Typically called after the Client doc is
 * created so a later visit by the same browser starts fresh.
 */
export function clearCapturedLeadSource(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeHost(referrer: string): string | undefined {
  try {
    return new URL(referrer).host;
  } catch {
    return undefined;
  }
}

function inferSourceFromReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined;
  const host = safeHost(referrer)?.toLowerCase() ?? '';
  if (host.includes('google'))    return 'google';
  if (host.includes('bing'))      return 'bing';
  if (host.includes('duckduckgo')) return 'duckduckgo';
  if (host.includes('facebook'))  return 'facebook';
  if (host.includes('instagram')) return 'instagram';
  if (host.includes('tiktok'))    return 'tiktok';
  if (host.includes('youtube'))   return 'youtube';
  if (host.includes('linkedin')) return 'linkedin';
  if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
  return undefined;
}

function inferMediumFromReferrer(referrer: string): string | undefined {
  const host = safeHost(referrer)?.toLowerCase() ?? '';
  if (['google', 'bing', 'duckduckgo'].some(s => host.includes(s))) return 'organic';
  if (['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'x.com'].some(s => host.includes(s))) {
    return 'social';
  }
  return undefined;
}

// ── Aggregations used by the Marketing tab ──────────────────────────────────

/** Buckets clients by lead source for the breakdown chart. */
export function aggregateBySource(
  clients: { leadSource?: LeadSource }[],
): Array<{ source: string; medium: string; count: number }> {
  const map = new Map<string, { source: string; medium: string; count: number }>();
  for (const c of clients) {
    const source = c.leadSource?.utm_source || 'unattributed';
    const medium = c.leadSource?.utm_medium || 'unknown';
    const key = `${source}::${medium}`;
    const prev = map.get(key);
    if (prev) prev.count++;
    else map.set(key, { source, medium, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Groups by utm_campaign and computes conversion stats. */
export function aggregateByCampaign(
  clients: { status?: string; leadSource?: LeadSource }[],
): Array<{ campaign: string; leads: number; converted: number; conversionRate: number }> {
  const CONVERTED = new Set(['Converted', 'Active', 'Ongoing', 'Completed']);
  const map = new Map<string, { campaign: string; leads: number; converted: number }>();
  for (const c of clients) {
    const campaign = c.leadSource?.utm_campaign;
    if (!campaign) continue;
    const prev = map.get(campaign) || { campaign, leads: 0, converted: 0 };
    prev.leads++;
    if (CONVERTED.has(c.status || '')) prev.converted++;
    map.set(campaign, prev);
  }
  return Array.from(map.values())
    .map(r => ({ ...r, conversionRate: r.leads === 0 ? 0 : Math.round((r.converted / r.leads) * 100) }))
    .sort((a, b) => b.leads - a.leads);
}

/** Counts clients at each funnel stage (cumulative from Submitted → Converted). */
export function computeFunnel(
  clients: { status?: string }[],
): Array<{ stage: string; count: number }> {
  // Status hierarchy — each row counts clients at or beyond that stage.
  const stages = [
    { key: 'Assessment Submitted', label: 'Assessment Submitted' },
    { key: 'Reviewed',             label: 'Reviewed' },
    { key: 'Contacted',            label: 'Contacted' },
    { key: 'Converted',            label: 'Converted' },
  ];
  // Each stage's "passed through" set
  const STAGE_ORDER: Record<string, number> = {
    'New Inquiry':           0,
    'Assessment Submitted':  1,
    'Reviewed':              2,
    'Contacted':             3,
    'Converted':             4,
    'Active':                4,
    'Ongoing':               4,
    'Completed':             4,
  };
  return stages.map((s, idx) => ({
    stage: s.label,
    count: clients.filter(c => (STAGE_ORDER[c.status || ''] ?? -1) >= idx + 1).length,
  }));
}
