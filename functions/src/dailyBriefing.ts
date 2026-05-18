/**
 * Scheduled daily briefing — runs every morning at 07:00 Europe/London.
 *
 * Aggregates overnight + today data, hands it to Claude Haiku to produce a
 * conversational 4–6 line briefing, writes to `daily_briefings/{date}`.
 *
 * The Today panel reads the latest briefing and renders it as the lead card.
 * Cost target: < $0.001 per briefing (one Haiku call per day per clinic).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './index.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5';

interface BriefingMetrics {
  todayAppointments: number;
  yesterdayCompleted: number;
  newAssessmentsOvernight: number;
  reviewedAwaitingFollowup: number;
  unreadFromClients: number;
  overduePayments: number;
  overduePaymentTotal: number;
}

interface BriefingDocument {
  date: string;                  // YYYY-MM-DD (Europe/London)
  generatedAt: string;           // ISO timestamp
  model: string;
  summary: string;               // 2–3 sentence overview from Claude
  bullets: string[];             // 3–5 punchy bullets
  metrics: BriefingMetrics;
  usage: { input: number; output: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function londonDateStr(d = new Date()): string {
  // Europe/London formatted YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
}

function yesterdayLondon(d = new Date()): string {
  const y = new Date(d);
  y.setUTCDate(y.getUTCDate() - 1);
  return londonDateStr(y);
}

// ── Trigger ──────────────────────────────────────────────────────────────────

export const dailyBriefing = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'Europe/London',
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async () => {
    const today = londonDateStr();
    const yesterday = yesterdayLondon();
    logger.info(`[dailyBriefing] running for ${today}`);

    // ── Gather metrics ───────────────────────────────────────────────────────
    const metrics = await gatherMetrics(today, yesterday);

    // Skip Claude call entirely if the clinic is completely idle — saves cost.
    const isQuiet = Object.values(metrics).every(v => v === 0);
    if (isQuiet) {
      logger.info('[dailyBriefing] clinic is quiet, writing static briefing');
      await writeBriefing({
        date: today,
        generatedAt: new Date().toISOString(),
        model: 'none',
        summary: 'A quiet start to the day — no sessions booked, no overnight messages, and no outstanding follow-ups.',
        bullets: ['Use this window to plan the week, prepare patient records, or seed new content for the website.'],
        metrics,
        usage: { input: 0, output: 0 },
      });
      return;
    }

    // ── Call Claude ──────────────────────────────────────────────────────────
    try {
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.4,
        system: buildSystemPrompt(),
        messages: [
          { role: 'user', content: `Today: ${today}\nYesterday: ${yesterday}\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}\n\nGenerate the briefing as JSON.` },
        ],
      });

      const textBlock = message.content.find(b => b.type === 'text');
      const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
      const jsonStr = raw.startsWith('```') ? raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim() : raw;

      let parsed: { summary: string; bullets: string[] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // If Claude returned freeform text, fall back to summary-only.
        parsed = { summary: raw.slice(0, 400), bullets: [] };
      }

      await writeBriefing({
        date: today,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        summary: String(parsed.summary ?? '').trim(),
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 6) : [],
        metrics,
        usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
      });

      logger.info(`[dailyBriefing] done — ${message.usage.input_tokens}→${message.usage.output_tokens} tokens`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[dailyBriefing] failed', { error: msg });
      // Write a fallback so the panel still shows something useful.
      await writeBriefing({
        date: today,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        summary: `Today: ${metrics.todayAppointments} session${metrics.todayAppointments === 1 ? '' : 's'} booked. ${metrics.reviewedAwaitingFollowup} reviewed patient${metrics.reviewedAwaitingFollowup === 1 ? '' : 's'} awaiting follow-up.`,
        bullets: [],
        metrics,
        usage: { input: 0, output: 0 },
      });
    }
  },
);

// ── Internal ─────────────────────────────────────────────────────────────────

async function gatherMetrics(today: string, yesterday: string): Promise<BriefingMetrics> {
  // Today's appointments
  const todayAptsSnap = await db.collection('appointments')
    .where('date', '==', today)
    .where('status', 'in', ['Confirmed', 'Pending'])
    .get();

  // Yesterday's completed sessions
  const yestAptsSnap = await db.collection('appointments')
    .where('date', '==', yesterday)
    .where('status', '==', 'Completed')
    .get();

  // New assessments in last 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const newClientsSnap = await db.collection('clients')
    .where('createdAt', '>=', dayAgo)
    .get();
  const newAssessmentsOvernight = newClientsSnap.docs.filter(d => d.data().status === 'Assessment Submitted').length;

  // Reviewed clients awaiting follow-up (>48h in Reviewed status)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const reviewedSnap = await db.collection('clients')
    .where('status', '==', 'Reviewed')
    .get();
  const reviewedAwaitingFollowup = reviewedSnap.docs.filter(d => {
    const reviewDate = d.data().assessmentData?.reviewDate;
    return reviewDate && reviewDate <= twoDaysAgo;
  }).length;

  // Unread messages from clients (recipient = admin convention)
  const unreadSnap = await db.collection('messages')
    .where('recipientId', '==', 'all-admins')
    .where('read', '==', false)
    .limit(50)
    .get();

  // Overdue payments — sum across all clients
  const allClientsSnap = await db.collection('clients').limit(500).get();
  let overduePayments = 0;
  let overduePaymentTotal = 0;
  const todayMs = Date.now();
  allClientsSnap.docs.forEach(d => {
    const payments = (d.data().payments ?? []) as Array<{ status: string; dueDate?: string; amount: number }>;
    payments.forEach(p => {
      if (p.status === 'Pending' && p.dueDate && new Date(p.dueDate).getTime() < todayMs) {
        overduePayments++;
        overduePaymentTotal += p.amount;
      }
    });
  });

  return {
    todayAppointments: todayAptsSnap.size,
    yesterdayCompleted: yestAptsSnap.size,
    newAssessmentsOvernight,
    reviewedAwaitingFollowup,
    unreadFromClients: unreadSnap.size,
    overduePayments,
    overduePaymentTotal,
  };
}

async function writeBriefing(brief: BriefingDocument): Promise<void> {
  await db.collection('daily_briefings').doc(brief.date).set(brief);
}

function buildSystemPrompt(): string {
  return `You are the morning briefing assistant for the Novogencis hair restoration clinic in Cheadle, UK. You speak directly to the doctor team (Dr Aminah, Dr Waqas) as they sign in for the day.

Tone: calm, professional, focused. No filler. Sound like a sharp practice manager, not a bot.

Given today's metrics, produce a JSON object with:
{
  "summary": "2 sentences. Highlight the most important thing about today. If sessions today, mention how many. If overnight activity is worth noting, lead with that.",
  "bullets": [
    "3 to 5 short action-oriented bullets — most pressing first",
    "Each bullet < 15 words",
    "Skip empty buckets — don't say 'no overdue payments'"
  ]
}

Return ONLY the JSON, no markdown fences, no preamble.`;
}
