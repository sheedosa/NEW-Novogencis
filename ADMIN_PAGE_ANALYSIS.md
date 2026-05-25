I have all the context I need. Now I'll produce the full deep analysis directly as my final assistant message. The user explicitly said this is a "thorough analysis document" — I'll deliver it as text in my response (per my system instructions: do NOT write report .md files, return findings directly).

---

# Novogenics Admin — Page-by-Page Deep Analysis

**Scope:** 18 admin surfaces. Audience: a two-doctor clinic (Dr Aminah, Dr Waqas) running booking + clinical notes + payments. Goal: prepare the platform for an AI-powered SaaS evolution.

**File reference baseline:**
- Shell + booking modal: `/Users/rasheedamer/Projects/NEW-Novogencis/pages/AdminPage.tsx` (1,181 lines)
- ClientRecord (snapshot / plan / files / activity / money): `/Users/rasheedamer/Projects/NEW-Novogencis/pages/admin/ClientRecord.tsx` (1,613 lines — large mega-file)
- Panels live under `/Users/rasheedamer/Projects/NEW-Novogencis/pages/admin/panels/`
- Settings: `/Users/rasheedamer/Projects/NEW-Novogencis/pages/admin/SettingsDrawer.tsx`
- Appointment notes: `/Users/rasheedamer/Projects/NEW-Novogencis/pages/admin/AppointmentNotesDrawer.tsx`
- Types: `/Users/rasheedamer/Projects/NEW-Novogencis/types.ts`
- Shared admin state: `/Users/rasheedamer/Projects/NEW-Novogencis/pages/admin/context.ts`
- Design tokens: `/Users/rasheedamer/Projects/NEW-Novogencis/index.css`

---

## 1. Today — `pages/admin/panels/TodayPanel.tsx`

### 1.1 Page purpose
"Tell me what to do today, what to worry about, and what's coming next."

### 1.2 Currently shown information (top-to-bottom)
1. PageHeader: greeting + friendly date + "Book appointment" primary action.
2. (Mobile-only conditional) "Up next" hero card — appears when an appointment is < 3 hours away. Shows time-until, patient avatar/name, type, prep flags (form unsigned / payment pending / policies pending / notes missing), and Call + Open Chart buttons.
3. Compact strap-line row: 4 inline metrics — session count today, GBP revenue today, new patients this week, open tasks (with "needs you" click target → Inbox).
4. AI: Today's briefing (Claude-generated, gold AISurface) — summary paragraph + numbered bullets + generated-at timestamp + model name.
5. AI: Follow-ups ready — collapsible rows of cold leads (stale hours, draft subject, expandable to show draft body), Open & review + Dismiss.
6. AI: Today's signals (Clinic Radar) — auto-detected business risks/opportunities computed locally. Five rule classes: at-risk active patients (60+ days no visit, no upcoming), reviewed-but-not-contacted (3+ days stuck), conversion momentum delta (last 14d vs prior 14d), treatment-plan completion imminent, overdue feedback (>48h). Each opens a relevant deep link.
7. Main 2-column grid:
   - Left (2/3): "Run sheet · {date}" — list of today's appointments. Each row shows time, avatar, name (+ checkmark if policies accepted), type, inline prep flags, status badge. Tap → opens patient chart.
   - Right (1/3): "Needs you" action queue (pending triage, unread from clients, top 3 open tasks); "Tomorrow" teaser (count + first 3 appointments).

### 1.3 Currently available actions
- Book appointment (header CTA + EmptyState CTA).
- Tap "Needs you" strap-line → opens Inbox.
- Tap any radar/follow-up card → deep link (Inbox, Patients, Practice).
- Expand a follow-up row → view AI draft → Open & review (opens chart) / Dismiss (updates Firestore flag).
- Tap a run-sheet row → opens patient chart.
- Mobile-only: Call (tel: link) and Open Chart from the Up Next hero.
- "Full calendar" arrow on run sheet → switches to Schedule.
- "Inbox" arrow on Needs You → switches to Inbox.

### 1.4 Doctor's job-to-be-done
"I'm starting the day. I want to know: who's coming in, did anything break overnight, is there anyone I need to chase, am I making money?" The doctor scans Today for ≤ 30 seconds before either starting their first session or attacking their inbox.

### 1.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Greeting → strap-line → AI Briefing → Follow-ups → Radar → Run sheet + sidebar. The greeting + AI briefing dominate the visual weight (correct — these are the "morning narrative"). The strap-line is too thin and reads as decoration rather than data — it competes with the AI cards for primacy.
- **Density:** Three AI cards in sequence is the dominant pattern. When all three render with content this page becomes a long scroll (300vh+ on 1080p screens). Doctors who only want today's bookings have to scroll past 3 AI cards.
- **Card/section organisation:** The "Run sheet" makes sense as primary; "Needs you" + "Tomorrow" as sidekick. Good.
- **Whitespace:** Generous; ai-surface gold gradient borders add premium polish. No whitespace issues.
- **Primary actions:** "Book appointment" sits where expected (top-right). Tap targets in the Run sheet are full-row, which is correct.
- **Above the fold:** On 1440×900, the visible content is greeting + strap-line + briefing-summary header. Run sheet is below the fold. This is wrong for the primary use case (see today's bookings).

### 1.6 Layout analysis (MOBILE @ 375px)
- The Up Next hero (lines 294–373) is the strongest design element — it's an outstanding mobile primitive.
- Strap-line wraps to two rows; readable but loses scan-rhythm.
- AI cards (5p padding) consume ~70% of viewport each. Scrolling fatigue is real.
- Run sheet rows truncate type and use 12-line skeletons.
- Bottom-nav covers final 64px; nothing important is hidden behind it.
- Touch targets: Run-sheet rows are 64px (good); strap-line "needs you" is only 32px tall (borderline).

### 1.7 Confusion / friction points
- **"Needs you" strap-line metric is the only button in the row** but visually identical to the other three — doctors won't notice it's tappable.
- **Three AI cards in a row blur together** — Briefing, Follow-ups, Radar all use AISurface. Hard to know which one is decision-grade vs. opportunistic.
- **"Conversion momentum" radar item** speaks founder-language not doctor-language. ("Conversions up 14% over the last 14 days" — Dr Aminah is not going to translate that into an action.)
- **Tomorrow teaser duplicates information** that's also one tap away in Schedule. It's reassurance, not workflow.
- **"Follow-up suggestions" rely on a Firestore collection** (`followup_suggestions`) that's separate from the inbox — but logically they ARE inbox items. Doctors will wonder why some "follow-ups" live here and other "follow-up" tasks live in Inbox.

### 1.8 Information that's missing
- No clinical urgency surfacing: e.g. "Saba's PRP series ends today — schedule next phase."
- No revenue-of-today's-bookings vs. revenue-already-paid — doctors care about expected income from today's sessions.
- No "Yesterday recap" — did sessions go well, did anyone leave unhappy, any aftercare to send?
- No quick-actions: "Send aftercare to all yesterday-completed patients", "Confirm tomorrow's bookings via SMS."
- No room/equipment status (centrifuge ready, exosome kit count).
- No "missed yesterday" — overdue notes from yesterday's completed sessions.

### 1.9 Information that's redundant
- "New patients this week" in the strap-line is rarely actionable for a clinician (it's a founder metric).
- The full date in PageHeader (e.g. "Tuesday, 11 November") repeats inside the Run sheet header.
- Tomorrow teaser repeats schedule data the doctor will see when they hit Schedule.

### 1.10 Non-technical clinician language test
Mostly good. Problem terms:
- "Clinic Radar" / "Today's signals" — clinical language would be "Heads up" or "Worth your attention".
- "Conversion momentum" / "Conversions up X%" — marketing-speak.
- "Triage" — clinical, but used in a SaaS sense (lead triage). Could confuse.
- "Cold leads" in follow-up card — sales jargon.

### 1.11 Mobile vs desktop discrepancies
- Up Next hero only renders on mobile (`lg:hidden`) — desktop doctors don't get the imminent-appointment surface. Bad. The Up Next pattern is exactly what a desktop doctor wants at 09:00.
- Three AI cards on mobile = vertical avalanche; on desktop they form a logical column but still consume real estate.

### 1.12 Workflow / process clarity
The implicit flow:
1. Read briefing.
2. Glance run sheet.
3. Attack action queue.
4. Open first patient.

Steps 1–3 happen in parallel because each AI card competes for attention. Step 4 is where the doctor must context-switch — from "summary mode" to "patient mode" by tapping into the chart. The page does this well, but doesn't enforce the order — a confused doctor could spend 5 minutes reading AI cards before noticing the run sheet.

### 1.13 AI / automation opportunities (specific to Today)
1. **Auto-prioritised first-task.** Instead of a separate Up Next + Run sheet + Needs You + Radar, an LLM ranks all open items into a single "Start here" card. ("Start with: Open Saba's chart — she's at 09:30, her consent form is still unsigned, draft an SMS to nudge her now.")
2. **Yesterday recap.** AI summarises last 24 hours: completed sessions, notes status, payments received, refunds. ("Yesterday: 4 sessions completed; 1 set of notes still open — Saba 4pm PRP.")
3. **Predictive no-show risk.** Today's appointments shown with risk score (based on weekday, prior cancellation rate, message latency, deposit status).
4. **Auto-drafted aftercare for yesterday's completed sessions** queued for one-tap send.
5. **Daily revenue forecast vs target.** ("On track for £1,250 today — 8% above weekly average.")
6. **Conflict & gap detector.** ("11:30–12:30 is empty — Saba asked to move her Friday slot; suggest filling here?")
7. **Voice briefing.** "Hey Aminah, here's your morning brief" — generates a 30-second audio summary playable from the page.
8. **Auto-flag clinical risks.** If any of today's patients has a recent symptom message indicating concern (e.g. "I'm getting shedding"), surface to the doctor as a pre-session note.

### 1.14 Proposed redesign (concrete)
- **REMOVE:** strap-line row (move metrics into a small "Practice pulse" card below Run sheet), Tomorrow teaser (collapse into a "+1" tab on Run sheet), redundant "Up next" hero (merge with Run sheet first row by adding a "starting in X min" pulse).
- **MODIFY:** Collapse the three AI cards into a single "Morning brief" surface with three tabs (Summary / Follow-ups / Signals). Default to Summary.
- **ADD:** "Yesterday's loose ends" strip at the very top (e.g. "1 note pending, 2 aftercare emails not sent"). Move the AI briefing into a collapsible accordion under the Run sheet (read once → collapsed for the rest of the day).
- **RE-ORDER:** Run sheet first, then Needs You panel (full-width), then AI Brief, then Pulse metrics.
- **FIRST GLANCE:** Doctor sees the day's bookings as a vertical timeline with each row showing risk flags + a "Start session" CTA for the imminent one.

### 1.15 Rating
**Workable.** Already a solid surface (probably the strongest in the app), but it tries to do four jobs at once. Will need consolidation when AI features expand.

---

## 2. Inbox — `pages/admin/panels/InboxPanel.tsx`

### 2.1 Page purpose
"Everything that needs me, in one queue I can flatten."

### 2.2 Currently shown information
1. PageHeader: "Inbox" + "{N} items need you" + "New task" CTA.
2. Filter chip row: All / Tasks / Assessments / Messages / Forms / Payments — with counts per chip.
3. (Conditional) Bulk-actions bar — "Snooze all" + "Mark all done" — only renders when filter shows task-eligible items.
4. Unified list of all attention-needing items. Each item has:
   - Type chip (Assessment / Message / Form / Payment / Task)
   - Priority flag (red AlertTriangle for high)
   - Icon (per type, in a coloured tile)
   - Title
   - Subtitle (1–2 line preview)
   - Relative timestamp (Xm/h/d ago)
   - Primary action (Review / Reply / Open / Open thread / Done)
   - Secondary action (Snooze for tasks; "Open thread" for messages)
   - Delete action (tasks only)
   - Left-edge accent stripe (3px) by type
5. (Inline expansion) For message-type items, an inline reply pane: last 3 thread messages + reply textarea + Send/Cancel.
6. New Task Modal: title, notes, due date, priority, linked patient.

### 2.3 Currently available actions
- Set filter chip.
- Open new-task modal.
- Bulk snooze / bulk mark-done (when applicable).
- For each item: primary action, secondary action, delete (tasks), expand reply (messages).
- Within reply expansion: type + send / cancel.

### 2.4 Doctor's job-to-be-done
"Get the inbox to zero. Triage new assessments, reply to patients, complete tasks, snooze what I can't do today."

### 2.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Filter chips → bulk bar (if present) → list. Eye lands on count + filter row first. Good.
- **Density:** Stacked cards with breathing room. Each row averages 80–96px tall — slightly large for a power-user inbox at scale (100+ items would feel like a slog).
- **Organisation:** Sensible grouping by type via chips. The unified-list-with-types pattern is well-executed.
- **Whitespace:** Appropriate.
- **Primary actions:** Right-aligned, which is correct.
- **Above the fold:** Filter chips visible; ~5 items visible without scrolling. Workable.

### 2.6 Layout analysis (MOBILE @ 375px)
- Stacked card variant (lines 425–471) is good — title on top, subtitle below, action bar at bottom.
- Bulk bar wraps to 2 lines, slightly awkward.
- Reply textarea: 3 rows × full width — OK.
- Send button stacked next to Cancel — usable.
- Touch targets are 44px+ ✓.
- Inline reply works on mobile but takes a lot of vertical space.

### 2.7 Confusion / friction points
- **No grouping by patient.** Saba has an unread message + an overdue payment + a pending assessment review — they appear as three rows mid-list, not grouped. Doctor mentally re-groups.
- **"Done" on tasks** completes silently — there's no undo toast.
- **Snooze always = tomorrow.** No "Pick a date." Tasks that need to wait a week can't be snoozed for a week.
- **"Open thread" inside the reply expansion** is the secondary action — confusing because users expect "send" to be primary, not "navigate away".
- **Bulk-actions bar text "{N} tasks in view"** doesn't make the scope clear when not on Tasks filter.
- **Forms section** is just titled "Form unsigned" — without context about which patient is blocking and how long it's been.
- **Payments don't show how to chase** (no "Send reminder" button).
- **Assessments → Review** uses `setClientRecordTab('overview')` — opening the patient record's Snapshot. But the doctor opened "Assessment" — they expect the Assessment screen, not Snapshot.

### 2.8 Information that's missing
- Patient-level grouping option (toggle: list vs grouped).
- A search field (impossible to search the inbox).
- A sort toggle (oldest first, newest first, priority).
- For payments, the days-overdue + amount more prominently.
- For unsigned forms, "Resend" button.
- Empty-state delight (currently just "All caught up"). Doctors who clear inbox should get a small reward.
- "Postpone the whole inbox to tomorrow" mass action (end-of-day clearing).

### 2.9 Information that's redundant
- The relative time appears twice on mobile (badge area + below title).
- The icon tile + type chip + accent stripe is three signals for the same thing (item type).

### 2.10 Non-technical clinician language test
- "Triage" is used in `setTriageSelectedId` but doesn't appear in UI strings — safe.
- "Item" / "items need you" — clear.
- "Snooze" — universally understood.
- Filter chips are plain English ✓.

### 2.11 Mobile vs desktop discrepancies
- Reply expansion is identical — works on both but feels cramped on mobile.
- Bulk-action bar is buggy when wrapped (button overlap risk on smaller mobile widths).

### 2.12 Workflow / process clarity
Implicit flow per item: pick filter → read row → click primary action → either complete in place (reply) or deep-link out. The deep-link-out flow loses inbox context — when the doctor finishes the chart, they're not returned to Inbox automatically.

### 2.13 AI / automation opportunities (specific to Inbox)
1. **AI auto-triage.** Each new assessment gets an AI summary inline (suitability, red flags, suggested next action). Doctor approves or amends — they never need to open the full questionnaire unless they want to.
2. **Auto-grouping by patient.** AI clusters items into "Saba: 3 open items", showing them as a single accordion row.
3. **One-click "Send chase".** For overdue payments / unsigned forms, the action is a single tap that sends a pre-drafted nudge in the patient's tone of voice.
4. **Smart snooze.** AI suggests when to snooze ("Saba is on annual leave this week, snooze until 19 May").
5. **AI reply suggestions.** Inline reply expansion already has a Draft-with-AI button on the patient chart; add the same here.
6. **Predicted impact.** Sort by AI-predicted business value: "Replying to Saba now → 70% chance of conversion".
7. **Bulk-resolve plan.** "Clear my inbox in 12 minutes" — AI sequences the optimal order and lets the doctor knock them off.
8. **Auto-categorisation of free-text messages.** Patient asks a question → AI tags it (clinical / admin / billing) and pre-routes to the right team.

### 2.14 Proposed redesign
- **REMOVE:** The fixed Snooze=tomorrow button. Replace with a date picker dropdown.
- **MODIFY:** Add "Group by patient" toggle. Add a search box. Sort dropdown.
- **ADD:** AI-summary preview on each Assessment row. "Send reminder" button on overdue payments. Undo toast on Done/Delete.
- **RE-ORDER:** Priority items always pinned at top with a divider; rest in chronological order below.
- **FIRST GLANCE:** Filter chips, then a count strap-line ("3 priority, 12 routine"), then a grouped-or-flat list per the user's choice.

### 2.15 Rating
**Workable.** Strong primitive, doesn't yet feel intelligent. Needs grouping + AI summarisation.

---

## 3. Schedule — `pages/admin/panels/CalendarPanel.tsx`

### 3.1 Page purpose
"Show me the calendar and let me move/book appointments."

### 3.2 Currently shown information
1. PageHeader: "Calendar" + date range subtitle + "Book appointment" CTA.
2. Toolbar: nav arrows + Today button, view switcher (Day / Week / List), clinician filter, type filter.
3. Three view modes:
   - **Week (desktop):** 7-day × 14-hour grid. Time column + day columns. Today column tinted gold. Appointments rendered as absolutely-positioned coloured blocks (sage for Aminah, terracotta for Waqas). Empty slots clickable to open booking modal pre-filled.
   - **Week (mobile):** Vertical agenda — one card per day with appointment rows.
   - **Day:** Same grid pattern but single column.
   - **List:** Linear list of upcoming appointments. Each row: date column, name + type, inline status select dropdown, notes drawer button, delete button.
4. Color legend at bottom: Dr Aminah / Dr Waqas / Unassigned.
5. Appointment Notes Drawer (modal) opens via the sticky-note icon in List view.

### 3.3 Currently available actions
- Navigate week/day, jump to Today.
- Switch view.
- Filter by clinician (all / mine / Aminah / Waqas).
- Filter by treatment type.
- Click empty grid slot → opens booking modal pre-filled.
- Click existing appointment block → opens booking modal in edit mode.
- (List view only) Change status inline.
- (List view only) Open Notes drawer.
- (List view only) Delete appointment.
- Book appointment via header CTA.

### 3.4 Doctor's job-to-be-done
"See who's booked, find a free slot, drag a patient to a new time, see how full my week is." (Drag-and-drop is not currently supported — see 3.7.)

### 3.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Toolbar → grid. Today's column tinted, current appointments are doctor-coloured blocks. Good rhythm.
- **Density:** 14 rows × 7 cols = 98 cells per week. Each cell is 60px. Appointments overlay correctly with duration height. Reads well.
- **Card/section organisation:** Single card containing the grid. Could feel sparse without an at-a-glance "weekly load" stat.
- **Whitespace:** Generous; almost too much in the Day view where one column stretches full width.
- **Primary actions:** "Book appointment" top-right, clickable cells everywhere. Good.
- **Above the fold:** Toolbar + first 8 hours of the week visible on a 1080p screen.

### 3.6 Layout analysis (MOBILE @ 375px)
- Default view is Day (correct — Week grid would be unreadable).
- Week view on mobile uses vertical agenda — clean.
- List view: rows are 72px tall, inline status select is tappable.
- Filters: native `<select>` elements — fine for mobile.
- Touch targets: cells in Day grid are 60px (good); list-view buttons are 32×32 (small but acceptable).

### 3.7 Confusion / friction points
- **No drag-and-drop reschedule.** Doctors are conditioned by Google Calendar to drag. This forces them into the modal flow every time.
- **No undo on delete.** Confirmation modal helps but adds friction.
- **No "create busy slot / holiday / lunch" affordance** — calendar shows only patient appointments.
- **Status select in list view** is editable inline but Date/Time/Doctor are not — inconsistent.
- **Conflict detection isn't visible in the grid.** Two overlapping bookings would just stack visually with no warning. (Booking modal prevents new overlaps; existing ones aren't flagged.)
- **Clinician filter "mine" requires logged-in admin to be a doctor** — for tech admins this filter is meaningless but shown.
- **Hours hardcoded 09:00–22:00.** Real practice hours per `WorkingHoursConfig` should drive this — not yet wired.
- **The empty-state "Click a slot below" instructs Day-view-only behaviour** — but Week view also allows it. Inconsistent prompting.
- **Print/Export Schedule** isn't possible — doctors who like paper schedules can't get one.

### 3.8 Information that's missing
- Total bookings + total revenue for this week (capacity at a glance).
- Free-slot count.
- Per-clinician utilisation %.
- Patient deposit status visible on each block.
- Visual indicator for "this patient is new" / "this is their first session".
- "Buffer time" between sessions (set per treatment) isn't visualised.
- A timezone awareness indicator (patients abroad).

### 3.9 Information that's redundant
- The bottom legend takes vertical space that could be inferred from coloured initials on each block.
- "Today" button + the "Today" tint of the column — duplicate signals.

### 3.10 Non-technical clinician language test
- "Day / Week / List" — universal.
- "All clinicians / My patients" — clear.
- "PRP / Exosomes / Microneedling / Initial / Follow-up / Assessment" — clinical, fine.
- "EV-Enriched Plasma Session" — long. Doctors call it "Exosomes" in conversation; the system already aliases it in the filter dropdown but not in the block title.

### 3.11 Mobile vs desktop discrepancies
- Drag-to-reschedule (not present on either) would be unusable on mobile anyway — fine.
- Status inline editor only exists in List view — doesn't surface on Day/Week.
- Notes drawer only opens from List view, not from clicking a block in Day/Week — inconsistent. (Clicking a block opens the booking modal instead.)

### 3.12 Workflow / process clarity
The flow is: pick view → find slot → click → modal → confirm. It works but feels heavyweight for what should be a two-click action ("move Saba to 11:30").

### 3.13 AI / automation opportunities
1. **Smart slot suggestion.** When a patient asks "Can I move my Friday slot?", AI proposes 3 alternatives that fit clinician availability + buffer + the patient's prior pattern.
2. **No-show prediction overlay.** Each appointment gets a small risk dot — high-risk ones surface mitigation suggestions ("Send SMS reminder 24h prior").
3. **Auto-fill gaps.** AI identifies suitable patients to invite into vacant slots ("11:00 is open Thursday — Hana asked about an extra session; offer it to her?").
4. **Capacity coaching.** "You're at 92% utilisation next week. Worth blocking out admin time?"
5. **Conversational booking.** "Schedule Saba's next 4 PRP sessions, fortnightly, mornings only" → AI proposes a complete sequence.
6. **Auto-buffer insertion** after intense treatments.
7. **Holiday/leave AI** — paste an email "I'm away 14–18 May" and the calendar blocks itself.

### 3.14 Proposed redesign
- **REMOVE:** The bottom legend (move into a tiny inline ledger above the grid).
- **MODIFY:** Add drag-and-drop reschedule. Add weekly-capacity strap (e.g. "27 sessions · 82% utilisation · £6,800 booked"). Show deposit status on blocks (small dot icon).
- **ADD:** "Block time" button (for lunch, leave, training). Print / export.
- **RE-ORDER:** Toolbar → weekly-capacity strap → grid → legend.
- **FIRST GLANCE:** Doctor sees the week's shape with revenue + utilisation at top, and free slots highlighted softly.

### 3.15 Rating
**Workable.** Strong calendar foundation; missing the muscle-memory drag pattern that doctors expect.

---

## 4. Patients (registry) — `pages/admin/panels/ClientsPanel.tsx`

### 4.1 Page purpose
"My list of patients — find one, see their state, open their chart."

### 4.2 Currently shown information
- PageHeader: "Clients" + count + "My clients/All clients" toggle + "Export CSV".
- 4 KPI stats: Total registry (with 30d % delta), Active protocols, Pending review, Conversion rate.
- Smart-segment chips: All / New leads / Due follow-up / Active / At risk / Lapsed 90d+ — each with count badge.
- Mobile card list (virtualised): avatar, name + assigned badge + policies tick, ID + status badge.
- Desktop table (virtualised): client (name + email + phone), status + created-date, actions (View). Search bar + status filter dropdown.
- When a client is selected: switches to 2-column split — left rail = scrollable patient list with mini cards; right = the ClientRecord component (see sections 5–9).

### 4.3 Currently available actions
- Toggle Mine / All.
- Export CSV.
- Set smart segment.
- Search by name/email/ID/phone.
- Open status filter dropdown.
- Open a patient (table row, mobile card, or sidebar mini-card).
- Back to list from inside a record.

### 4.4 Doctor's job-to-be-done
"Find this specific patient and open their chart" — or — "Show me everyone at risk so I can prioritise outreach."

### 4.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** KPIs first (correct), then segments, then list. Doctors who want list-only have to scroll past two strips of metadata.
- **Density:** Comfortable.
- **Organisation:** Logical.
- **Whitespace:** Appropriate.
- **Primary actions:** Export CSV is high-prominence but is a low-frequency action — wastes header real estate.
- **Above the fold:** KPIs + segment chips + first 4 rows on 1080p.

### 4.6 Layout analysis (MOBILE @ 375px)
- KPI grid drops to 2×2.
- Segment chips horizontally scroll.
- Mobile card list compresses well.
- Touch targets: rows are 96px each — generous.
- Sidebar/main split breaks at `lg` (1024px) — between iPad portrait and full desktop. Mobile sees full-page list, taps to full-page record (good).

### 4.7 Confusion / friction points
- **Two filtering mechanisms** (smart segments + status dropdown) layer on each other — counts on the segment chips don't reflect the active status filter combined. Confusing if both used.
- **"My clients / All clients" toggle** is invisible to a doctor who's already filtered to "mine" globally — the segments show different counts.
- **The search bar only appears in the desktop table header** — not in the mobile list (mobile has its own search inside the card). Inconsistent visual position.
- **No bulk-action** — can't multi-select to send the same form to N patients.
- **Status dropdown lives behind a button** with the current status as label — doctors don't expect "Status filter" to look like a value picker.
- **The right-side ClientRecord component shoves the patient bar (`sticky top-[52px]`)** above the page — confusing because the parent ClientsPanel's filter UI scrolls underneath it.

### 4.8 Information that's missing
- A column showing "Days since last visit" — would supercharge the at-risk workflow.
- A column for unread messages count.
- Tags / labels (e.g. VIP, recurring revenue).
- LTV per patient.
- An "Add patient manually" affordance (currently only assessment submissions create patients).
- Bulk message send.
- Custom saved views ("My follow-ups for Saturday").

### 4.9 Information that's redundant
- Created date in the table is rarely scanned.
- "Conversion rate" KPI — founder metric; doctors don't act on it.

### 4.10 Non-technical clinician language test
- "Registry" — slightly jargon, but clinical-adjacent. OK.
- "Lapsed 90d+" — technical-feeling label.
- "Pending review" — clear.
- "Assigned" badge — clear once you know what it means; no tooltip explaining "appears when you delivered a session for this patient".

### 4.11 Mobile vs desktop discrepancies
- Search position differs (header vs in-card).
- Mobile shows status under the name; desktop shows it in a dedicated column.
- The 2-pane master-detail only exists on desktop — mobile correctly collapses to full-screen record.

### 4.12 Workflow / process clarity
Flow: pick a segment → optionally search → tap → record opens. Clear.

### 4.13 AI / automation opportunities
1. **Smart segments expand into AI-defined cohorts.** "Patients who would benefit from a top-up phase" — AI segments dynamically.
2. **Predicted lifetime value** column.
3. **Churn risk score** per row.
4. **Auto-tags** ("VIP — referred 3 friends", "Anxious — last consultation had concerns").
5. **Natural-language search.** "Show me men aged 35–45 who haven't booked a follow-up."
6. **Outreach orchestration.** "Send 'how are you?' to all my Active patients overdue 60+ days" — AI drafts personalised messages.

### 4.14 Proposed redesign
- **REMOVE:** Conversion-rate KPI (move to Practice).
- **MODIFY:** Combine smart segments + status filter into a single multi-faceted picker. Add "Days since last visit" column.
- **ADD:** Bulk select; bulk send; "Add patient" button; natural-language search.
- **RE-ORDER:** Search + segments first; KPIs collapsed by default.
- **FIRST GLANCE:** Big search field, smart segments below, list with scannable name/status/last-seen.

### 4.15 Rating
**Workable.** Solid, but cluttered with founder-data the doctor doesn't need.

---

## 5. Client Record — Snapshot tab — `pages/admin/ClientRecord.tsx` (snapshot)

### 5.1 Page purpose
"Everything I need to know about this patient before/during/after a session — at a glance."

### 5.2 Currently shown information
- Sticky patient bar (top): back button, avatar, name + policies tick, ID + age + gender, status badge (desktop only), Quick edit + Book appointment buttons.
- Sticky tab bar: Snapshot / Plan / Files / Activity / Money.
- Identity rail (desktop only, left 260px sticky): Contact (email, phone, DOB, address) card, Lifecycle card (status select + sessions/upcoming counts), Internal Notes editor.
- Main column (Snapshot):
  - 3 stat cards: Next session / Sessions completed / Pending forms.
  - Red flags card (conditional) — from assessment screening.
  - "Clinical feedback" card (gold accent) — FeedbackEditor for the doctor's reply to the assessment.
  - 2-up grid: Upcoming bookings (with Move buttons) / Recent activity (last 5 events).
  - Mobile-only: collapsed accordion of Contact + Internal Notes.
- Reschedule modal (date/time picker with conflict detection).
- Quick Edit modal (name/email/phone/address).

### 5.3 Currently available actions
- Back to list / change tab.
- Quick edit profile.
- Book appointment (pre-fills patient).
- Change lifecycle status (from rail).
- Edit internal notes (rail).
- Edit clinical feedback (main).
- Move (reschedule) an upcoming booking.
- Tap "View all" → switches to Activity tab.

### 5.4 Doctor's job-to-be-done
"Open Saba's chart, see who she is, where she is in her journey, what I owe her (feedback), and what she's done."

### 5.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Patient bar → tabs → 2-col split. Stats first in main column. Strong.
- **Density:** Information-rich but well-grouped. The 3 stat cards feel too granular for the first cards on the page.
- **Card/section organisation:** Identity rail vs. clinical content split makes sense.
- **Whitespace:** Good.
- **Primary actions:** Book appointment in the sticky bar — correct (always reachable).
- **Above the fold:** Patient bar + tabs + stat cards + half of red flags / clinical feedback.

### 5.6 Layout analysis (MOBILE @ 375px)
- Identity rail hidden; replaced by an accordion at the bottom.
- Status badge hidden from sticky bar (only desktop).
- 3 stat cards become 2-col + 1 full-width.
- Sticky bar + tabs consume ~96px vertically before content — manageable.
- Quick Edit button label hidden ("md:hidden") leaving just an icon — discoverable but ambiguous.

### 5.7 Confusion / friction points
- **"Clinical feedback" is the most important field** but lives below stats — should be at the top.
- **"Move" button on bookings reads "Move" not "Reschedule"** — fine but conflict-detection messaging only appears on submit, not while picking time.
- **Status select** on the rail mixes business statuses (New Inquiry, Reviewed) with clinical states (Active, Ongoing) — doctors don't always know which to pick.
- **No "Send message" inline** — to message Saba, doctor must switch to Activity tab. Big friction for a quick "tomorrow's session moved to 11" note.
- **Internal notes vs Clinical feedback** — both are doctor-authored text fields. The distinction (internal notes = private; clinical feedback = patient-visible reply to assessment) is not clearly labelled in UI.
- **The recent activity card** shows 5 mixed events (appointments + messages). Tapping doesn't expand — only "View all" works.
- **Quick edit lacks DOB** — only contact details — yet doctors sometimes need to correct DOB.

### 5.8 Information that's missing
- Allergies / medical history at-a-glance (only buried in assessment expansion).
- Photo (face) — only initials in avatar.
- Pronoun / preferred name.
- Last visit date (separate from "sessions completed").
- Outstanding balance number (only in Money tab).
- Doctor's last note (most recent SOAP).
- Quick-action bar (Send aftercare / Send form / Send payment link) — all live in other tabs.
- Risk-score (no-show, churn).
- Recent message preview.

### 5.9 Information that's redundant
- "Sessions completed" appears in stat card AND in the lifecycle rail card.
- "Upcoming" count appears in lifecycle rail AND as the first stat.

### 5.10 Non-technical clinician language test
- "Snapshot" — clear.
- "Clinical feedback" — clear.
- "Lifecycle" — slight jargon (sales-funnel-ish).
- "Pending forms" — clear.
- "Internal notes" — clear (with subtext "not visible to client").

### 5.11 Mobile vs desktop discrepancies
- Internal notes editor is duplicated (rail + mobile accordion). DRY violation; if there's ever a latency mismatch this could confuse.
- Status select position differs (rail on desktop; not visible on mobile until accordion expanded).

### 5.12 Workflow / process clarity
The mental model: identity (left) + clinical narrative (right). Reasonable. But the doctor's most common pre-session task — "remind me what I said last time" — isn't surfaced.

### 5.13 AI / automation opportunities
1. **AI "Brief me" header.** A 2-sentence summary above the stats: "Saba — 38F, in her 4th PRP cycle, last visit 14 days ago. You noted shedding had plateaued. She's overdue for her next session by 3 days."
2. **Assessment AI triage** — already structured via the AITriage type — surface inline at the top of Snapshot when status is `Assessment Submitted`.
3. **AI draft for clinical feedback** — give the doctor a starting paragraph based on assessment answers.
4. **Predict best next conversation** — "She's likely worried about thinning at the temples — open with that".
5. **Anomaly detection** — "She hasn't paid invoice #INV-014 yet (overdue 6d); also no progress photo this month."
6. **Auto-summary of journey timeline** — one paragraph summarising every event.
7. **Sentiment of recent messages** — quick emotional read.

### 5.14 Proposed redesign
- **REMOVE:** The redundant stat cards (Sessions Completed + Upcoming) — fold into the rail.
- **MODIFY:** Promote Clinical Feedback to the top of main column. Add a "Brief me" AI strip at the very top.
- **ADD:** Quick action bar (Send message / Send form / Send payment link). Last-note preview. Outstanding balance. Photo upload (face).
- **RE-ORDER:** Brief → Clinical feedback → Red flags → Upcoming + Recent activity.
- **FIRST GLANCE:** Doctor sees patient name + AI brief + what to do next (Move/Confirm/Reply) without scrolling.

### 5.15 Rating
**Workable.** Solid clinical context, but doesn't feel like a chart — feels like a CRM record.

---

## 6. Client Record — Plan tab — `pages/admin/ClientRecord.tsx` (plan)

### 6.1 Page purpose
"Plan and track a patient's treatment phases and any prescriptions."

### 6.2 Currently shown information
2-column grid (lg:8/4):
- **Left (8 cols):**
  - Treatment plan card: title + "Add phase" CTA. For each phase: index badge, name + description, status badge (Active/Planned/Completed/On Hold), edit button. Progress bar showing sessions completed / planned. Inline edit panel (status + sessions done + notes). Empty state for no plan.
  - Prescriptions card: "Add prescription" CTA. Each Rx row: drug name + dosage + instructions + date range, status badge, discontinue button if Active. Empty state.
- **Right (4 cols):** Plan overview gold-accent card — total phases / completed / sessions progress bar / active prescription count / plan notes.
- Add Phase modal (plan title, phase name, description, sessions planned, notes).
- Add Prescription modal (drug, dosage, instructions, prescriber, start/end dates).

### 6.3 Currently available actions
- Add phase, edit phase (inline), save phase edits.
- Add prescription, discontinue prescription.
- Read-only view of plan overview.

### 6.4 Doctor's job-to-be-done
"Set up Saba's 12-month PRP protocol. Then over time, update progress as each session completes. Add/discontinue prescriptions for minoxidil etc."

### 6.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Plan first, prescriptions below, overview right. Logical.
- **Density:** Plenty of whitespace — sometimes too much (the right column on a no-plan record is mostly empty).
- **Organisation:** Good split.
- **Whitespace:** Generous.
- **Primary actions:** "Add phase" / "Add prescription" — both top-right of their cards, correct.
- **Above the fold:** Patient bar + tabs + first phase or empty state.

### 6.6 Layout analysis (MOBILE @ 375px)
- Two columns collapse to one (right column ends up below).
- Phase card adapts to single-col.
- Modals (Add Phase, Add Rx) use mobile-friendly layouts (long forms, OK).
- Inline edit panel inside a phase has 2-col status+sessions grid — fits 375px.

### 6.7 Confusion / friction points
- **"Plan title" is required on first phase only** — non-obvious. Subsequent "Add Phase" doesn't ask. Existing title hidden.
- **Phases don't auto-update** when an appointment is marked Completed in Schedule. Doctor must manually edit phase's sessionsCompleted. Source-of-truth ambiguity.
- **"Sessions completed" in the phase** is independent of `clientAppointments` data. They can drift out of sync (e.g. 3 PRP appointments completed in Schedule, phase still says 1/4).
- **No way to delete a phase.**
- **No way to reorder phases.**
- **Prescription status flow is incomplete** — only Active → Discontinued. "Completed" can be set via add, but no UI to transition.
- **No interaction warnings** for prescriptions.
- **No "send prescription instructions to patient"** action.
- **Mobile inline edit panel** uses tiny text-2xs labels — borderline unreadable.

### 6.8 Information that's missing
- Total cost of the protocol vs collected payments.
- Visual timeline view of phases (Gantt-style).
- Suggested next phase template ("Maintenance" after "Intensive").
- Per-phase clinical milestones (e.g. "12 weeks: re-photograph").
- Treatment outcomes (improvement scoring).
- Patient-facing version of the plan ("share with patient" toggle).

### 6.9 Information that's redundant
- "Active prescriptions" count in the overview card duplicates what's already visible in the prescriptions card.
- Plan title appears in the heading area AND in the modal.

### 6.10 Non-technical clinician language test
- "Phase" — clear.
- "Sessions planned / completed" — clear.
- "Prescription" — clear (note the label says "Drug / Product Name" — broad enough for off-label products).
- "Discontinue" — clear.

### 6.11 Mobile vs desktop discrepancies
- Inline edit panel works on both but uses small text on mobile.
- Right overview column drops below on mobile — fine.

### 6.12 Workflow / process clarity
Flow: open Plan → click Add Phase → fill modal → save → manually update progress later. Disconnect between Plan and Schedule is the biggest friction.

### 6.13 AI / automation opportunities
1. **Auto-suggest a plan from assessment.** AI proposes phases (e.g. "3-month intensive PRP, then 9-month maintenance").
2. **Auto-link appointments → phase sessions.** When Schedule marks a PRP Completed, auto-increment the active phase's sessionsCompleted.
3. **Re-plan suggestion.** "Saba's plateaued at session 4 — consider adding microneedling combo phase."
4. **Prescription interactions check** via an LLM safety pass.
5. **Patient-facing plan summary** — AI generates a friendly version Saba can read.
6. **Predict optimal session cadence** based on response.
7. **Treatment outcome scoring** — AI reads photos + notes and rates progress.

### 6.14 Proposed redesign
- **REMOVE:** Plan title input from "Add Phase" modal — move to a single "Edit plan title" action.
- **MODIFY:** Auto-sync sessions completed from appointment records. Add timeline / Gantt visualisation. Phase reorder + delete.
- **ADD:** "Suggest plan with AI" CTA. Patient-facing-summary toggle. Cost-tracker.
- **RE-ORDER:** Plan overview (left) → Timeline (top) → Phases list (middle) → Prescriptions (bottom).
- **FIRST GLANCE:** Doctor sees a visual timeline of treatment phases with progress dots; one click per phase to edit.

### 6.15 Rating
**Cramped.** Plan ↔ Schedule disconnect is the biggest pain. Otherwise functional.

---

## 7. Client Record — Files tab (Forms + Photos) — `pages/admin/ClientRecord.tsx` (files)

### 7.1 Page purpose
"All documents and photos for this patient in one place — send a form, see what's been signed, manage progress photos."

### 7.2 Currently shown information
- Sub-tab bar: Forms / Photos.
- **Forms sub-tab:**
  - Heading + "Send New Form" dropdown listing every form in `FORMS` constant.
  - Mobile: cards with title, sent/signed dates, status badge, View Details button.
  - Desktop: table with title+status / timeline / actions.
  - Empty state.
- **Photos sub-tab:**
  - Heading + Compare toggle + Add Photo CTA.
  - When Compare mode on: a 2-pane Before/After picker showing the days-difference once both picked.
  - Grid: 2/3/4/5 cols responsive, photos with hover zoom, click → lightbox (or pick for compare).
  - Each photo: aspect-square image + badge (source: Clinical/Assessment) + label + uploaded date.
  - "Add new" tile at the end of the grid.

### 7.3 Currently available actions
- Switch sub-tab.
- Send a form (picks from dropdown).
- View form details (opens InteractiveForm modal).
- Upload photo (opens modal in AdminPage).
- Enter compare mode → pick A → pick B → see days-gap.
- Lightbox a photo.

### 7.4 Doctor's job-to-be-done
"Send Saba the consent form. Later, confirm she signed it. Upload progress photos after each session. Compare before/after for clinical review."

### 7.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Sub-tabs → heading → list/grid. Decent.
- **Density:** Forms table is comfortable; photo grid at 5 columns can feel cramped if many photos.
- **Organisation:** Good split between forms and photos.
- **Whitespace:** Photo grid borders are thin (good).
- **Primary actions:** Send New Form / Add Photo top-right. Standard.
- **Above the fold:** Sub-tabs + heading + first row of grid/table.

### 7.6 Layout analysis (MOBILE @ 375px)
- Sub-tab switcher is small (pill-style 13px text), works.
- Forms cards stack vertically — good.
- Photos grid: 2 cols on small screens — usable.
- Compare-mode 2-pane: gets cramped on 375px (selected image text overlay can clip).
- Add Photo CTA is full-width.

### 7.7 Confusion / friction points
- **The "Send New Form" dropdown** uses a click-toggle hover-style — works but the chevron transform is non-standard.
- **No form-status filter** — can't show "only unsigned".
- **No reminder action** for unsigned forms.
- **Photo labels are doctor-entered free text** — easy to drift ("vertex 4 weeks", "month 1 top of head", "session 2 — vertex"). No taxonomy.
- **Compare mode** is hidden behind a toggle and resets the selection when toggled off — accidental loss.
- **No before-after metadata** (e.g. session number, treatment, lighting condition).
- **No multi-photo upload.**
- **No way to delete a photo from this view** — gallery photos are write-only once uploaded.
- **Lightbox doesn't allow swiping** between photos.
- **InteractiveForm modal** treats form details as read-only — no inline edit / re-sign workflow.
- **Forms table column "Timeline" labels are tiny** ("Sent" / "Signed" in `text-2xs`).
- **Mixed font sizes** (`text-2xs md:text-2xs`) on labels — visual fragmentation.

### 7.8 Information that's missing
- Tag or category per photo (vertex / temples / front / side).
- Photo session linking (which appointment did this photo belong to?).
- Document upload beyond forms + photos (e.g. lab results, GP letters).
- A "consent expired" warning if it's been > N months since signature.
- A digital signature audit trail (when, where, IP).
- E-signature integration status.

### 7.9 Information that's redundant
- "Sent" date is in card header + table column; same with "Signed".
- "Source: Clinical/Assessment" badge — useful but takes premium top-right space on every tile.

### 7.10 Non-technical clinician language test
- "Sent & Signed Forms" — clear.
- "Pending" / "Signed" — clear.
- "Progress Gallery" — clear.
- "Compare / Exit Compare" — clear.
- "View Details" — slightly bureaucratic; "Open" would be friendlier.

### 7.11 Mobile vs desktop discrepancies
- Forms table on desktop has 3 columns; mobile uses cards.
- Photos: lightbox identical on both; compare mode harder to use on mobile.
- Send Form menu uses fixed positioning — on small mobile might overlap action button.

### 7.12 Workflow / process clarity
Send form → patient signs (separate portal flow) → admin sees signed status → opens to verify. Photos: take photo with phone → upload → label. Compare in office or remote.

### 7.13 AI / automation opportunities
1. **Auto-tag photos.** Vision model classifies vertex/temples/front/side automatically; tags + body location.
2. **Auto-progress score.** AI compares latest photo with baseline and produces a 0–100 improvement score.
3. **Best-comparison suggestion.** "Most striking improvement is week 0 → week 16, vertex view — show that?"
4. **Form-completion nudge.** AI sends personalised follow-up if a form's been unsigned for 24h.
5. **Consent expiry tracking.** AI flags consents older than 12 months when scheduling new treatments.
6. **Receipt/lab-result OCR** for uploaded documents.
7. **Photo quality check** — AI rejects blurry/cropped uploads at capture time.
8. **Auto-overlay alignment** for before/after.

### 7.14 Proposed redesign
- **REMOVE:** The redundant "Source" badge on photos (replace with a small dot).
- **MODIFY:** Add photo tagging (multi-select: vertex/temples/front/side). Add form filter. Add multi-photo upload.
- **ADD:** AI auto-tagger. Improvement-score widget. Re-send / chase action for forms. Document upload (PDF / lab results).
- **RE-ORDER:** A unified "Files & photos" timeline view (chronological mix) as a third sub-tab.
- **FIRST GLANCE:** Doctor sees Forms outstanding count + Photos last-added — fast triage of "have I done what I need to do?"

### 7.15 Rating
**Cramped.** The split into Forms + Photos is right, but each side lacks the tooling doctors need.

---

## 8. Client Record — Activity tab — `pages/admin/ClientRecord.tsx` (activity)

### 8.1 Page purpose
"All conversation history + intake questionnaire for this patient."

### 8.2 Currently shown information
- Communication Log card (450px mobile, 600px desktop):
  - Stream of messages between clinic and patient.
  - Bubbles: cream for client, primary-tint for clinic.
  - Form-type messages: gold-tile + "View Sent/Signed Form" button.
  - Payment-type messages: tile + Stripe link.
  - Text-type messages: plain bubble.
  - Time stamp per message.
- MessageInputForm (with AI Draft button when context is provided).
- Collapsible "Intake questionnaire" accordion (renders only when `assessmentData?.answers` exists):
  - "Hair concerns & goals" sub-card — first 5 questions.
  - "Medical & safety screening" sub-card — everything else, with red highlighting for significant answers.

### 8.3 Currently available actions
- Scroll messages.
- Open a sent/signed form (InteractiveForm modal).
- Open Stripe payment link in new tab.
- Type + send a new message.
- Draft with AI (when AI context is set).
- Expand/collapse questionnaire.

### 8.4 Doctor's job-to-be-done
"Catch up on what Saba and I have said. Reply if needed. Re-read her intake answers if something feels off."

### 8.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Messages dominate the page. Questionnaire is hidden behind an accordion.
- **Density:** Fixed-height (600px) scrollable log — comfortable.
- **Organisation:** Single card; works.
- **Whitespace:** Generous.
- **Primary actions:** Send (in input). Standard chat pattern.
- **Above the fold:** Most recent messages + input bar.

### 8.6 Layout analysis (MOBILE @ 375px)
- 450px-tall message log uses ~70% of viewport.
- Input at bottom is the obvious primary.
- Form / payment bubbles scale OK.
- Touch targets: bubble actions are full-width buttons — large enough.

### 8.7 Confusion / friction points
- **The Activity tab includes both Messages AND the intake questionnaire** — these are very different concepts. The questionnaire feels misplaced.
- **No message-type filter** — payments, forms, free-text all interspersed.
- **No search inside the thread.**
- **Read receipts are absent** — clinic doesn't know if Saba's seen the latest message.
- **AI Draft button** is small; doctors may not discover it.
- **Subject line on outgoing messages is always "Clinic Update"** — generic, customisable nowhere visible.
- **No attachments** — can't send a PDF or photo from the input.
- **No templates inline** — Settings has templates but you can't paste them in one tap from here.
- **Time stamp format inconsistent** (sometimes "Recently", sometimes "10:32 AM") — minor cognitive load.

### 8.8 Information that's missing
- Patient's last seen / online status.
- Channel indicators (was this SMS, email, in-app?).
- Tagging messages (clinical / admin / billing).
- Clinic-side internal annotation on a message ("she sounded worried here").
- Template picker inline.
- Attachment upload.
- "Mark as urgent" on a thread.
- Subject editor.

### 8.9 Information that's redundant
- The intake questionnaire would arguably be its own tab.
- The "Communication Log" card title is redundant when this whole tab is labelled "Activity".

### 8.10 Non-technical clinician language test
- "Communication Log" — slightly formal.
- "Intake questionnaire" — clear.
- "Clinical red flags" — clear.

### 8.11 Mobile vs desktop discrepancies
- Height (450px vs 600px) — sensible.
- Bubble width (90% mobile vs 80% desktop) — sensible.
- Input form layout consistent.

### 8.12 Workflow / process clarity
Clear: scroll → read → reply or open form → send. Friction comes from missing templates / search / attachments.

### 8.13 AI / automation opportunities
1. **Thread summary at top.** AI gives a 1-sentence summary of the most recent 5 exchanges.
2. **Smart reply** — 3 suggested replies as chips above the input.
3. **Sentiment indicator** per message.
4. **Auto-flag clinical content** — "Saba mentioned 'feeling tired'; tag for safety review?"
5. **Auto-translation** for non-English-speaking patients.
6. **Voice-to-text reply** for the doctor.
7. **Inferred intent** — "She's asking to reschedule" → 1-click "Suggest 3 alternative slots".
8. **Conversation timeline** with major events overlaid (sessions, forms, payments).

### 8.14 Proposed redesign
- **REMOVE:** The intake questionnaire accordion — move to a dedicated "Assessment" sub-tab on the Snapshot or to Snapshot itself.
- **MODIFY:** Rename to "Messages". Add filter (text/forms/payments). Add inline template picker. Add attachment upload. Add subject editor.
- **ADD:** AI summary strip. Smart-reply chips. Read receipts. Channel badges.
- **RE-ORDER:** AI summary on top → thread → input.
- **FIRST GLANCE:** Doctor sees the summary + last 3 messages + input ready.

### 8.15 Rating
**Workable.** Functional chat. Missing the polish that makes patient comms feel safe and modern.

---

## 9. Client Record — Money tab — `pages/admin/ClientRecord.tsx` (money / financials)

### 9.1 Page purpose
"All financial history for this patient — what's paid, what's pending."

### 9.2 Currently shown information
- 3 summary cards: Total received / Pending or overdue / Total invoiced.
- Payment history list — sorted newest first. Each row: description, reference (mono), paid/due date, amount, status badge, "Mark paid" button if Pending.
- Empty state.
- Add Payment modal (description, amount, currency, status, due date, reference).

### 9.3 Currently available actions
- View totals.
- Add a payment entry.
- Mark a pending payment paid (with auto-set paidDate).

### 9.4 Doctor's job-to-be-done
"Record a payment. Confirm a Stripe payment landed. Chase an outstanding invoice. Audit my receipts."

### 9.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** 3 summary cards → list. Clear.
- **Density:** List rows are 64px — comfortable.
- **Organisation:** Clean.
- **Whitespace:** Good.
- **Primary actions:** Add Entry top-right. Standard.
- **Above the fold:** Summary + ~6 list rows.

### 9.6 Layout analysis (MOBILE @ 375px)
- Stat grid: 1-col by default per sm:grid-cols-3 — wait, actually with the `sm:grid-cols-3`, on mobile it goes 1-col, taking 3 vertical cards. Could be 2x2 instead.
- Payment row keeps name/desc on top, status + Mark paid below — works.
- Add Payment modal long-form layout — OK.

### 9.7 Confusion / friction points
- **No Stripe/PayPal integration** — payments are manually entered. Doctor must remember/copy/paste from Stripe dashboard.
- **No "Send payment link"** from this tab — doctors must go to messages tab to send a Stripe link.
- **No refund workflow** — only status flip to Refunded.
- **No partial-payment support** — can't split £600 into 2× £300.
- **No invoice/receipt generation** — patient can't get a PDF.
- **Currency picker** allows any string — could yield inconsistent data.
- **No tax/VAT handling.**
- **No "linked to appointment"** — payments stand alone. Doctor can't see "this £250 was for Saba's PRP on 14 Aug".

### 9.8 Information that's missing
- Net revenue (after refunds, after platform fees).
- Per-treatment revenue split.
- Tax breakdown.
- Invoice number / receipt PDF.
- Patient payment method (Stripe / cash / bank transfer).
- LTV.

### 9.9 Information that's redundant
- "Total invoiced" = paid + pending — derived from the other two cards.

### 9.10 Non-technical clinician language test
- "Money" — folksy, clear.
- "Total received / Pending or overdue / Total invoiced" — clear.
- "Mark paid" — clear.
- "Reference" — small jargon, OK.

### 9.11 Mobile vs desktop discrepancies
- Stat grid: 1-col mobile (could be 2x2).
- Row layout identical conceptually.

### 9.12 Workflow / process clarity
Flow: confirm payment landed in Stripe → Add Entry → set Paid → patient sees nothing change in app (no receipt).

### 9.13 AI / automation opportunities
1. **Auto-reconcile with Stripe.** Webhook adds Paid entries automatically; AI matches description to patient/treatment.
2. **AI-drafted dunning sequence.** "Sara's invoice is 5 days overdue → suggest sending soft reminder #1."
3. **Refund-decision assistant.** "Customer cancelled with 36h notice — policy says non-refundable; AI drafts the polite response."
4. **Anomaly detection.** "PRP package usually £580; you entered £480 — typo?"
5. **Forecast cash flow** by patient.
6. **Predict slow payers.** Flag high-risk patients at booking time.
7. **Auto-generate receipts/invoices** with VAT.
8. **One-click "Send payment link"** that uses Stripe API + records as Pending.

### 9.14 Proposed redesign
- **REMOVE:** "Total invoiced" card (derive).
- **MODIFY:** Link payment to appointment. Stat grid 2x2 on mobile. Add patient method indicator.
- **ADD:** Stripe webhook auto-reconciliation. Send-link button. Receipt PDF. Dunning automation.
- **RE-ORDER:** Outstanding first (most actionable) → Received this period → History.
- **FIRST GLANCE:** Doctor sees outstanding amount big, dunning suggestion if applicable, then list.

### 9.15 Rating
**Cramped.** Functional manual ledger; not connected to any payment processor; doesn't help collect.

---

## 10. Practice → Overview — `pages/admin/panels/PracticeOverviewSubPanel.tsx`

### 10.1 Page purpose
"High-level snapshot of clinic performance — for the founder or for a doctor curious about the business."

### 10.2 Currently shown information
- PageHeader: "Practice" + 30-day subtitle.
- 4 KPIs:
  - Revenue (30d) £.
  - New patients (30d) + delta vs prior 30d.
  - Sessions completed (30d).
  - Outstanding £.
- Card: "What this view tells you" — narrative + pointers to Insights / Marketing / Money sub-tabs.

### 10.3 Currently available actions
- (Implicit) Click into other sub-tabs via the parent Practice tab bar.

### 10.4 Doctor's job-to-be-done
"Glance at the numbers, decide if I need to dig deeper."

### 10.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Title → KPIs → explanatory card.
- **Density:** Sparse — only 4 KPIs and a help card.
- **Organisation:** Clear.
- **Whitespace:** A lot.
- **Primary actions:** None.
- **Above the fold:** Everything.

### 10.6 Layout analysis (MOBILE @ 375px)
- KPIs go 2x2.
- Help card stacks below.
- Page renders cleanly, but feels under-utilised.

### 10.7 Confusion / friction points
- **The Overview is so sparse it doesn't justify itself** — the same 4 KPIs are duplicated on the more-detailed Insights view.
- **No trend chart / mini sparkline.**
- **No "what changed" narrative** (which Insights has).
- **The "What this view tells you" card is help text in production UI** — doctors will skim/ignore.
- **No time-range picker** — locked to 30 days.

### 10.8 Information that's missing
- Sparklines on KPIs.
- Headline "Last 30 days vs prior 30 days" comparison summary.
- Top performing treatments.
- "If you want detail, here are the 3 most interesting findings" — synthesised insights.

### 10.9 Information that's redundant
- The help card.
- KPIs essentially duplicate Insights.

### 10.10 Non-technical clinician language test
- "Overview" — clear.
- "Outstanding" — clear.
- "Sessions completed" — clear.

### 10.11 Mobile vs desktop discrepancies
- None; identical.

### 10.12 Workflow / process clarity
This page exists mostly as a "default landing" for Practice. Workflow: glance → drill into sub-tab.

### 10.13 AI / automation opportunities
1. **AI-generated weekly business brief** — natural-language summary on this page, refreshed each Monday.
2. **Predictive forecast.** "On current pace, you'll close the month at £24,200 — 8% above last month."
3. **Outlier identification.** "Booking cancellations dropped 40% this week — investigate?"
4. **Goal-vs-actuals.** Set a target → AI tracks progress + suggests interventions.
5. **Capacity-headroom calc** — "You have 12 free PRP slots next 2 weeks; advertising spend could fill 6."

### 10.14 Proposed redesign
- **REMOVE:** The help card.
- **MODIFY:** Add sparklines to each KPI. Add a time-range toggle (7d / 30d / quarter / year).
- **ADD:** AI weekly brief. Forecast card. Top 3 insights ("what changed").
- **RE-ORDER:** AI brief → KPIs with sparkles → trend chart.
- **FIRST GLANCE:** Doctor sees "Business is up 12% MoM — driven by exosomes" right at the top.

### 10.15 Rating
**Cramped.** Doesn't earn its real estate yet.

---

## 11. Practice → Money — `pages/admin/panels/MoneyPanel.tsx`

### 11.1 Page purpose
"Practice-wide payment ledger — collect, reconcile, forecast."

### 11.2 Currently shown information
- PageHeader: "Money" + "Payments across all patients this month" + Export CSV.
- 4 KPI stats: Received this month (+MoM%), Outstanding, Overdue, Avg days to pay.
- 2-up: Aging (Current / 1–7d / 8–30d / 30+d) with stacked bar + per-bucket breakdown, and "This month forecast" (received + value of confirmed appointments based on heuristic pricing).
- Filter chips: Outstanding / Paid / All.
- Search box (patient, description, reference).
- Payment list — stacked card on mobile, inline row on desktop. Each row: patient + description, amount, status, "Mark paid".

### 11.3 Currently available actions
- Filter chips.
- Search.
- Mark paid.
- Click row → opens patient's Money tab.
- Export CSV.

### 11.4 Doctor's job-to-be-done
"Find every patient who owes money. Mark received payments paid. Forecast cash flow."

### 11.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** KPIs → Aging + Forecast → filters → list.
- **Density:** Good. Aging strip is a great primitive.
- **Organisation:** Logical.
- **Whitespace:** Appropriate.
- **Primary actions:** Mark paid inline; click row to drill.
- **Above the fold:** KPIs + half of Aging/Forecast.

### 11.6 Layout analysis (MOBILE @ 375px)
- KPI grid: 2x2.
- Aging + Forecast: 1-col below.
- Filter chips + search: stacked vertically.
- Payment cards: stacked.
- Touch targets: Mark paid button is 32px — could be 40+.

### 11.7 Confusion / friction points
- **Forecast uses "heuristic pricing"** (TREATMENT_PRICES hardcoded in the file) — diverges from real list price. Could mislead.
- **No Stripe sync** — every payment must be entered manually, including the auto-suggested Mark Paid.
- **Pending vs Overdue logic** is calculated client-side in two places (here and per-row) — could drift.
- **No dunning workflow.** No "Send chase" button on a row.
- **No bulk mark-paid.**
- **Aging buckets are great, but no drilldown** — clicking a bucket doesn't filter the list.
- **Avg days to pay** is hard to interpret (good or bad? no benchmark).

### 11.8 Information that's missing
- Stripe payout schedule (when am I receiving net proceeds?).
- Fees taken.
- Net revenue line.
- Refunds summary.
- Tax/VAT collected (UK clinic).
- Per-treatment revenue.
- Revenue per clinician.
- Recurring vs one-off revenue.

### 11.9 Information that's redundant
- "Total invoiced" on patient Money tab vs Outstanding here — different totals.
- Filter chip "All" + the visible list (when no filter selected).

### 11.10 Non-technical clinician language test
- "Money / Received / Outstanding / Overdue / Aging / Forecast" — all clear.
- "Avg days to pay" — clear.

### 11.11 Mobile vs desktop discrepancies
- Stacked cards on mobile vs inline rows on desktop — consistent.
- Aging bar visible on both.

### 11.12 Workflow / process clarity
Flow: open Money → filter Outstanding → row by row, Mark paid (when Stripe says it landed) or click to deep-link into patient. Workable but heavy.

### 11.13 AI / automation opportunities
1. **Stripe auto-reconciliation.** Pending → Paid happens via webhook.
2. **Dunning automation.** Tiered chase emails/SMS auto-sent at 1d, 5d, 14d, 30d.
3. **Refund-decision assistant.** Given a cancellation, AI proposes the refund amount per policy.
4. **Cash-flow forecast** beyond the current month, with seasonality.
5. **Risk-of-non-payment score** per pending invoice (based on patient history).
6. **Detection of unusual transactions.**
7. **VAT/tax auto-classification.**

### 11.14 Proposed redesign
- **REMOVE:** Heuristic pricing (replace with real treatment prices).
- **MODIFY:** Click aging bucket → auto-filter list. Bulk Mark Paid. Add "Send chase" per row.
- **ADD:** Stripe webhook integration. Dunning sequences. Net revenue card.
- **RE-ORDER:** KPIs → Aging (clickable) → Forecast → List.
- **FIRST GLANCE:** Doctor sees overdue total prominent + recommended action ("3 patients to chase today — drafts ready").

### 11.15 Rating
**Workable.** Better than the per-patient Money tab; still needs Stripe integration.

---

## 12. Practice → Insights — `pages/admin/panels/InsightsPanel.tsx`

### 12.1 Page purpose
"Charts and trends — conversion, revenue, treatment mix, bookings."

### 12.2 Currently shown information
- PageHeader: "Insights" + subtitle.
- 4 KPIs: Conversion rate, Revenue 30d (with delta), Sessions done 30d (delta), No-show rate.
- "What changed this period" gold-accent card — auto-narrated insights for revenue, new patient acquisition, cancellations, treatment-mix shifts.
- 2x2 chart grid:
  - Conversion funnel (horizontal bar).
  - Revenue trend (area chart, 12 weeks).
  - Treatment mix (donut + legend list).
  - Weekly bookings (grouped bar — booked vs completed, 8 weeks).

### 12.3 Currently available actions
- Hover tooltips on charts (recharts default).
- No clicks/filters available.

### 12.4 Doctor's job-to-be-done
"Read the charts and understand if the practice is healthy."

### 12.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** KPIs → narrative → charts. Logical.
- **Density:** Heavy — 4 stats + narrative + 4 charts. Could overwhelm.
- **Organisation:** Good 2x2.
- **Whitespace:** OK.
- **Primary actions:** None — read-only.
- **Above the fold:** KPIs + maybe top of narrative.

### 12.6 Layout analysis (MOBILE @ 375px)
- KPIs: 2x2.
- Narrative cards: 1-col.
- Charts: 1-col, full width. Recharts adapts (220–240px tall each).
- Long scroll page.

### 12.7 Confusion / friction points
- **No time-range picker.** Locked to 30d for KPIs / 12 weeks for revenue / 8 weeks for bookings.
- **No drill-down** — can't click a funnel stage to see who's there.
- **Conversion funnel logic is cumulative** — but a layperson reading "Reviewed: 12" might think it's 12 in the Reviewed status, not 12 who reached Reviewed or beyond. Not signposted.
- **Cancellation narrative requires >50% spike** to surface — could surface earlier.
- **Treatment mix doesn't show £** — only counts. Doctors care about £.
- **Revenue chart axis** uses "£X.Yk" but tooltip shows full £ — inconsistent formatting.
- **No comparison vs previous year** — wellness practices are seasonal.

### 12.8 Information that's missing
- Customer lifetime value chart.
- Retention cohort matrix.
- Clinician utilisation comparison.
- Average revenue per patient.
- Booking-to-completion time.
- Refund rate.
- Lead-time-to-book.

### 12.9 Information that's redundant
- Conversion rate (here) + Conversion rate (on Marketing).
- Revenue 30d (here) + Revenue 30d (on Money and Overview).

### 12.10 Non-technical clinician language test
- "Conversion funnel" — slight jargon. "Patient journey" might be clearer.
- "Treatment mix" — clear.
- "No-show rate" — clear.

### 12.11 Mobile vs desktop discrepancies
- 2x2 grid collapses to 1-col on mobile — heavy scroll.
- Tooltip readability is fine on both.

### 12.12 Workflow / process clarity
Open → scan KPIs → read narrative → scroll charts. Read-only — no action triggered from this page. (Could be the point — but feels disconnected from the rest of the app.)

### 12.13 AI / automation opportunities
1. **AI-generated weekly insight summary.** Natural-language paragraph: "PRP volume is up 22% MoM; cancellations are concentrated on Tuesdays; Dr Aminah's utilisation hit 92%."
2. **Clickable charts → actions.** Click a funnel bottleneck → AI proposes intervention.
3. **Predictive trend lines.** "If this trajectory holds, you'll need a third clinician by Q4."
4. **Cohort retention chart with AI annotations.**
5. **Anomaly alerts** in real time (push-style).
6. **What-if scenario simulator.** "If we raise PRP price by £50, projected revenue impact = +£X."

### 12.14 Proposed redesign
- **REMOVE:** No removals; consolidate header KPIs (redundant with Money/Overview).
- **MODIFY:** Add time-range picker. Add per-chart drilldown. Add £ overlay on treatment mix.
- **ADD:** AI-narrative card on top (auto-summary of the period). Year-over-year comparison.
- **RE-ORDER:** AI narrative → charts in order of impact (revenue first).
- **FIRST GLANCE:** Doctor sees a paragraph of plain-English insight + 4 charts.

### 12.15 Rating
**Workable.** Charts are pretty but static. Founder-grade, not doctor-grade.

---

## 13. Practice → Marketing — `pages/admin/panels/MarketingPanel.tsx`

### 13.1 Page purpose
"Where do my patients come from, and which campaigns work."

### 13.2 Currently shown information
- PageHeader: "Marketing" + range picker (30d / 90d / All time).
- 4 KPIs: Leads captured, Top source, Funnel conversion (Submitted → Converted), Attribution rate.
- Conversion funnel chart (horizontal bar) + Lead sources donut.
- Campaign performance table (campaign / leads / converted / rate badge).
- Source detail table (source / medium / leads / share).
- "Connect external sources" — placeholder ConnectionCards for GA4, Meta/Instagram, Google Business (all "Not connected — Coming soon").
- "How attribution works" explainer card with `?utm_source=…` code example.

### 13.3 Currently available actions
- Range picker.
- (Connection cards) Open external admin in new tab.
- (Explainer) Read.

### 13.4 Doctor's job-to-be-done
For doctors: rarely visited. For the founder: "Which channel is profitable?"

### 13.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Range picker → KPIs → funnel+donut → campaign table → source table → connection cards → explainer.
- **Density:** Heavy.
- **Organisation:** OK.
- **Whitespace:** Plenty.
- **Primary actions:** Range picker.
- **Above the fold:** Range + KPIs.

### 13.6 Layout analysis (MOBILE @ 375px)
- KPIs: 2x2.
- Funnel+donut stack vertically.
- Tables: cards on mobile.
- Connection cards: 1-col.
- Long scroll.

### 13.7 Confusion / friction points
- **All external integrations are "Coming soon"** — half the page is unimplemented.
- **Attribution depends on UTM tags** — if the clinic doesn't tag URLs, the page is mostly empty.
- **The explainer card** is good but it's UI text-as-documentation.
- **Funnel duplicates Insights' funnel** (same data, slightly different presentation).
- **No spend data** — Marketing is showing leads but not £ cost-per-lead.
- **Same UTM data drives all charts** — if attribution rate is low (likely), the entire page is unrepresentative.

### 13.8 Information that's missing
- Cost per lead.
- Cost per conversion.
- Cohort behaviour by source (e.g. Instagram leads have higher LTV).
- Referral source (patient referrals, not paid).
- Top referring patients (advocates).
- Time-to-conversion by source.

### 13.9 Information that's redundant
- The whole "Connection cards" block (since they're not wired).
- Funnel chart (duplicates Insights).

### 13.10 Non-technical clinician language test
- "Leads / Funnel / Attribution / UTM / Campaign" — heavy jargon for a doctor.
- "First-touch attribution" — marketing-speak.

### 13.11 Mobile vs desktop discrepancies
- Mobile fallbacks for tables exist — works.

### 13.12 Workflow / process clarity
This is a founder/marketer page. The doctor never needs it. The structure works but the audience mismatch hurts.

### 13.13 AI / automation opportunities
1. **AI-narrative insights.** "Instagram drove 8 leads at £12 CAC; Google Ads drove 3 leads at £45 — concentrate spend."
2. **Channel attribution model** — multi-touch instead of first-touch.
3. **Auto-tag campaign URLs.** When a doctor pastes an ad URL, AI suggests UTM parameters.
4. **Lookalike audience identification** — "Your converting patients are 75% women aged 30–45 in Manchester."
5. **Auto-generated landing-page variants** with AI copywriting + A/B testing.
6. **Conversational planner.** "I have £500 to spend this week — where?"

### 13.14 Proposed redesign
- **REMOVE:** Connection cards (replace with a single "Connect integrations" CTA that links to a setup wizard).
- **MODIFY:** Add spend per source (manual entry or via Stripe/Meta sync). Drop the duplicate funnel.
- **ADD:** AI narrative card. Patient referral tracking.
- **RE-ORDER:** AI narrative → KPIs → source breakdown → referrals.
- **FIRST GLANCE:** Founder sees "Best channel this month: X — invest more" + supporting data.

### 13.15 Rating
**Cramped.** Founder-focused; structure right; missing the integrations that would make it real.

---

## 14. Practice → Operations — `pages/admin/panels/OperationsSubPanel.tsx`

### 14.1 Page purpose
"Capacity utilisation — am I full or quiet?"

### 14.2 Currently shown information
- PageHeader: "Operations" + subtitle.
- "This week's workload" card: vertical mini-bars per day, week total + % capacity.
- Placeholder card: "More operations metrics coming."

### 14.3 Currently available actions
- None.

### 14.4 Doctor's job-to-be-done
"Quick sanity check: was this week busy?"

### 14.5 Layout analysis (DESKTOP)
- **Visual hierarchy:** Workload chart → coming-soon.
- **Density:** Very low.
- **Organisation:** Single card + placeholder.
- **Whitespace:** Lots.
- **Primary actions:** None.
- **Above the fold:** Everything.

### 14.6 Layout analysis (MOBILE @ 375px)
- Single chart fits 375px.
- Placeholder card visible below.

### 14.7 Confusion / friction points
- **The "More coming" placeholder is shipped UI** — looks unfinished.
- **14 slots/day is hardcoded** (`SLOTS_PER_DAY = 14`). Doesn't reflect actual working hours.
- **Single week** — no comparison to last week.
- **No per-clinician breakdown.**
- **No revenue layered over capacity.**

### 14.8 Information missing
- Per-clinician utilisation.
- No-show rate (mentioned in copy but absent).
- Avg session length.
- Treatment-mix throughput.
- Capacity heatmap by hour, not just by day.

### 14.9 Information redundant
- Just the placeholder.

### 14.10 Non-technical clinician language test
- "Workload / Capacity" — clear.

### 14.11 Mobile vs desktop discrepancies
- Identical.

### 14.12 Workflow / process clarity
Glance → realise nothing actionable → leave.

### 14.13 AI / automation opportunities
1. **Hour-by-hour utilisation heatmap.**
2. **Optimal-staffing AI.** "Wednesday afternoons are consistently 50% — consider half-day."
3. **Bottleneck detection.** "The 3-week wait for a PRP slot is hurting conversion."
4. **Auto-schedule of clinic admin time.**
5. **Forecast capacity needs** for growth scenarios.

### 14.14 Proposed redesign
- **REMOVE:** Placeholder card.
- **MODIFY:** Add per-clinician bars. Add hour-of-day heatmap. Add last-vs-this-week comparison.
- **ADD:** Bottleneck signal card. Staff utilisation.
- **RE-ORDER:** Workload → heatmap → utilisation → AI bottleneck signal.
- **FIRST GLANCE:** Doctor sees this week vs last week + a key actionable signal.

### 14.15 Rating
**Cramped.** Shipped early; needs depth.

---

## 15. Settings drawer — `pages/admin/SettingsDrawer.tsx`

### 15.1 Page purpose
"Personal preferences, reusable text templates, staff info."

### 15.2 Currently shown information
Three tabs:
- **Preferences:** Density toggle (Comfortable / Compact), "View as" (tech admins only — switch workspace to Aminah/Waqas/All), Keyboard shortcuts list (⌘K, Esc, ↑↓), Developer section with "Preview patient portal" button.
- **Templates:** List of saved snippets sorted by category + title. Each row: category icon, title, body preview (3 lines clamp). Actions: copy, edit, delete. New/edit form: category, title, body. Empty state.
- **Staff:** Hardcoded 3-row staff list: Aminah, Waqas, Rasheed — name, role, email, hours. Note: per-day working hours editor is "coming in the next wave".

### 15.3 Currently available actions
- Switch tab.
- Change density.
- (Tech admin only) Switch viewing workspace.
- (Tech admin only) Open test patient view.
- Add/edit/delete/copy template.
- View static staff list.

### 15.4 Doctor's job-to-be-done
"Set my preferences. Manage my message templates."

### 15.5 Layout analysis (DESKTOP)
- 480px right-side drawer.
- Sections clear.
- Empty states present.

### 15.6 Layout analysis (MOBILE @ 375px)
- Drawer goes full-width.
- All tabs accessible.

### 15.7 Confusion / friction points
- **No "appearance / theme" controls beyond density** — no dark mode (intentional — see audit notes), no font-size, no compact-row toggle.
- **No notification preferences** (which alerts do I want emailed?).
- **No 2FA setup.**
- **Templates work but can't be tagged or grouped.**
- **"View as" only available for tech admin** but is shown disabled to doctors — pointless visual noise.
- **Staff is read-only** — adding a clinician requires code.
- **Working hours editor missing** — a critical absence for a clinic running scheduling.
- **No clinic profile (address, phone, business hours, email signature).**
- **No integrations panel** (Stripe, Mailgun, GA4 — they sit on Marketing today).

### 15.8 Information missing
- Profile / Avatar.
- Email signature.
- Notification settings.
- Working hours.
- Treatment catalogue editor (currently in Firestore only).
- Pricing editor.
- Clinic profile.
- Integration credentials.
- Audit log access.
- Data export / privacy controls (GDPR).

### 15.9 Information redundant
- Keyboard shortcuts could be a tooltip on the ⌘K hint in the top bar — overkill in settings.

### 15.10 Non-technical clinician language test
- "Density / Comfortable / Compact" — clear.
- "Preview patient portal" — clear.
- "Templates" — clear.
- "Per-day working hours editor coming in the next wave" — bizarre to expose roadmap copy in production.

### 15.11 Mobile vs desktop discrepancies
- Drawer behavior consistent.

### 15.12 Workflow / process clarity
Open settings → flip a toggle → close. Templates flow is fine.

### 15.13 AI / automation opportunities
1. **AI-suggested templates.** "Based on your last 30 sent messages, here are 3 reusable templates you should save."
2. **Smart placeholders.** Templates support `{first_name}`, `{appointment_date}` — AI suggests them.
3. **Multi-language templates.**
4. **AI auto-categorise templates.**
5. **Voice-input** for templates.

### 15.14 Proposed redesign
- **REMOVE:** Roadmap copy ("coming in the next wave").
- **MODIFY:** Make Staff editable. Add working hours editor. Promote integrations into Settings.
- **ADD:** Notification settings, profile, signature, clinic profile, treatment catalogue editor.
- **RE-ORDER:** Profile → Clinic → Staff → Templates → Notifications → Integrations → Developer.
- **FIRST GLANCE:** Open settings, see profile + clinic identity, with templates and staff as siblings.

### 15.15 Rating
**Cramped.** Functional skeleton, missing critical clinic-management features.

---

## 16. Booking modal — inside `pages/AdminPage.tsx` (lines 969–1086)

### 16.1 Page purpose
"Book or edit a patient appointment in one form."

### 16.2 Currently shown information
- Title + subtitle.
- Treatment select (sorted by price; shows name + duration).
- Treatment summary strap (duration only).
- Client select (all clients).
- Clinician select (Aminah / Waqas).
- Date input + Time select (30-min slots 09:00–22:00).
- Live conflict warning panel (red) when overlap detected.
- Clinical notes textarea.
- Cancel + Confirm buttons (Confirm disabled if conflict).

### 16.3 Currently available actions
- Pick treatment (auto-fills duration).
- Pick client.
- Pick clinician.
- Pick date / time.
- Type notes.
- Confirm or cancel.

### 16.4 Doctor's job-to-be-done
"Book Saba's next PRP next Tuesday at 11."

### 16.5 Layout analysis (DESKTOP)
- Single column form. Conflict warning prominent.
- Decent grouping.
- Confirm button standard placement.

### 16.6 Layout analysis (MOBILE @ 375px)
- Form stacks; usable.
- Treatment dropdown wide enough.
- Date + Time grid splits below sm:grid-cols-2 — fine.

### 16.7 Confusion / friction points
- **Treatment list shows name + duration** but not price. Doctor can't see if they're booking the £580 or £250 product.
- **No deposit/payment-link generation** triggered on booking — patient must pay via a separate flow.
- **No reminder of patient's allergies / red flags** when picking a patient.
- **No "first session?" detection.**
- **No conflict detail in the warning text on mobile** — could overflow.
- **Date input uses native HTML date picker** — fine but not customised.
- **No "find next available slot for clinician X" affordance.**
- **No recurring booking** — must book each phase manually.
- **Status defaults to "Confirmed"** — but maybe "Pending" is safer (until deposit paid).
- **No follow-up suggestion** — after booking PRP session 2 of 4, no nudge to also book session 3.
- **Notes field exists but is buried below** — easy to miss.
- **Email confirmation** — no clear indication that the patient gets notified.

### 16.8 Information missing
- Full price + deposit.
- Patient deposit status (was a deposit paid?).
- Patient's recent visits.
- Patient's plan phase (auto-tag this appointment to a phase?).
- Clinician availability heatmap inline.
- Buffer / setup time.

### 16.9 Information redundant
- Treatment summary strap only shows duration (which the select already shows).

### 16.10 Non-technical clinician language test
- "Treatment / Client / Clinician / Date / Time" — clear.
- "Booking conflict" — clear.

### 16.11 Mobile vs desktop discrepancies
- Form works on both; minor crowding on small phones.

### 16.12 Workflow / process clarity
Treatment → Client → Clinician → Date+Time → confirm. Clean.

### 16.13 AI / automation opportunities
1. **"Find me a slot" command.** "Saba's next PRP, Tuesday morning, with Aminah." → AI proposes 3 slots.
2. **Auto-link to plan phase.**
3. **Auto-create deposit invoice** at booking.
4. **No-show risk score** displayed inline.
5. **Recurring sequence creation** ("Book 4 sessions, fortnightly").
6. **Conflict resolution suggestion.** "If you move Hana from 11 to 11:30, Saba fits 11."
7. **Pre-fill from voice.** "Book Saba's PRP next Tuesday 11am" → modal opens pre-filled.

### 16.14 Proposed redesign
- **REMOVE:** The pointless "duration only" summary strap.
- **MODIFY:** Show price + deposit. Default to "Pending" status. Inline patient-context strip (allergies, last visit).
- **ADD:** AI slot finder, auto-deposit invoice, recurring sequence option.
- **RE-ORDER:** Treatment → Client (with context) → Clinician → Slot-finder OR manual date+time → notes → deposit info → Confirm.
- **FIRST GLANCE:** Doctor types/says intent; system proposes; doctor confirms in 1 tap.

### 16.15 Rating
**Workable.** Solid form. Needs slot-finding intelligence and Stripe-tie-in.

---

## 17. Appointment notes drawer — `pages/admin/AppointmentNotesDrawer.tsx`

### 17.1 Page purpose
"Edit clinical notes + status for one appointment."

### 17.2 Currently shown information
- Modal: title + subtitle ("Type · Date at Time").
- Patient + date block (avatar/icon, name, date+time, doctor name).
- Status pill row (6 statuses) — only one selectable.
- Clinical notes textarea (8 rows).
- Help text: "Notes are saved on the appointment record."
- Cancel + Save changes (disabled until dirty).

### 17.3 Currently available actions
- Change status (toggles dirty).
- Edit notes (toggles dirty).
- Save (calls onSave with both).
- Cancel.

### 17.4 Doctor's job-to-be-done
"Record SOAP notes for the session I just completed. Mark it Completed."

### 17.5 Layout analysis (DESKTOP)
- Single column modal.
- Top-down: identity → status → notes → footer.
- Sensible.

### 17.6 Layout analysis (MOBILE @ 375px)
- Status pill row wraps to 2 lines.
- Notes textarea ample.
- Footer buttons at bottom.

### 17.7 Confusion / friction points
- **No SOAP-structured input** — single textarea. Doctors aren't prompted for Subjective/Objective/Assessment/Plan.
- **No template insertion** — even though Templates exist in Settings.
- **No voice dictation** button.
- **No "previous note" reference** — doctor must close + open Activity to see what they wrote last time.
- **No save-on-blur** or autosave — easy to lose work if the doctor closes the modal accidentally.
- **No timestamp / author signature** in the notes content (just trust the appointment's `notes` field).
- **Status change is mixed with notes** — sometimes doctor just wants to mark Completed without writing notes (or vice versa). Coupling is awkward.
- **Notes don't sync to the patient's `internalNotes`** — they live on the appointment only. Doctor might write the same observation twice.

### 17.8 Information missing
- SOAP structure prompts.
- Voice-to-text.
- Previous note preview.
- Template picker.
- Spell-check confirmation.
- AI-summary of the session.

### 17.9 Information redundant
- Status pills + a redundant StatusBadge below them.

### 17.10 Non-technical clinician language test
- "SOAP notes" mentioned in placeholder — assumes doctor knows the acronym (yes, they do).
- "Clinical notes" — clear.

### 17.11 Mobile vs desktop discrepancies
- Status pill row wraps awkwardly on mobile.

### 17.12 Workflow / process clarity
Open drawer → toggle status → write notes → save. Clean — but feels heavyweight for a 5-second status change.

### 17.13 AI / automation opportunities
1. **Voice → SOAP.** Doctor dictates after session; AI structures into S/O/A/P.
2. **AI from photos + notes.** Capture photo + a 30-sec voice note; AI builds full SOAP entry.
3. **Auto-suggest follow-up tasks** ("Re-photograph at month 6; book next session in 21d").
4. **Compare with previous notes** — AI highlights changes ("Shedding intensity decreased from last session").
5. **Auto-mark Completed** when notes are saved.
6. **Aftercare auto-draft** based on session content.
7. **Template prefill** based on treatment type.

### 17.14 Proposed redesign
- **REMOVE:** Redundant status badge below pills.
- **MODIFY:** Split into SOAP sections (collapsible). Auto-save draft. Hide notes behind a "Add notes" expander when doctor just wants to mark Completed.
- **ADD:** Voice dictation button. AI structuring. Template picker. Previous note inline. Aftercare auto-draft prompt on Completed.
- **RE-ORDER:** Quick-action bar (Mark Completed without notes) → SOAP form (optional).
- **FIRST GLANCE:** Doctor sees the appointment header + a single "Complete & write SOAP" affordance.

### 17.15 Rating
**Cramped.** Closes the SOAP-notes gap minimally but misses the AI moment.

---

## 18. Top bar / shell / sidebar — `pages/AdminPage.tsx`

### 18.1 Page purpose
"Always-available chrome: navigation, search, notifications, user controls."

### 18.2 Currently shown information
- **Sidebar (desktop only above lg):**
  - Logo (or "N" badge when collapsed).
  - Section label: Clinic → Today (badge), Inbox (badge), Schedule, Patients.
  - Section label: Practice → Practice (badge), (Platform Health for tech admin).
  - Settings.
  - User profile block at bottom: avatar + name + role text + chevron. Click → opens account switcher popover (workspace switch for tech admin only).
- **Top bar:**
  - Mobile hamburger.
  - Breadcrumb: "Admin / {activeTab}".
  - Always-visible search button (desktop shows "Search patients…" with ⌘K hint; mobile shows just an icon).
  - Notifications bell (badge with unread count) — clicking SHOULD open notifications popover but the click handler navigates to Inbox instead. Note: the popover code exists (lines 889–941) but the bell button onClick now sets activeTab='inbox' (line 873), so the popover never appears.
  - Logout button.
- **Bottom nav (mobile only):** 4 surfaces (Today / Inbox / Schedule / Patients).
- **Morning briefing toast** — pops once a day if there are bookings.
- **Modals/drawers:** Booking, Form viewer, Gallery upload, Lightbox, CommandPalette, SettingsDrawer.

### 18.3 Currently available actions
- Navigate sidebar.
- Toggle sidebar collapse (desktop).
- Open mobile sidebar.
- Open command palette (search button or ⌘K).
- Open notifications popover (in code path, but the bell now navigates).
- Logout.
- Open settings drawer.
- Open account switcher (sidebar bottom).
- Bottom-nav navigation (mobile).
- Dismiss/View morning briefing.

### 18.4 Doctor's job-to-be-done
"Move between the 4 main surfaces. Search for a patient. See if there's anything new."

### 18.5 Layout analysis (DESKTOP)
- 240px sidebar (collapsible to 64px).
- 52px top bar.
- Clean Inter typography.
- Active nav uses cream bg + gold left-stripe — quiet and elegant.
- Nav badge counts are visible.

### 18.6 Layout analysis (MOBILE @ 375px)
- Sidebar slides in/out with backdrop.
- Bottom nav covers 4 surfaces with thumb-zone tap targets.
- Top bar collapses search to icon.

### 18.7 Confusion / friction points
- **Notification bell behavior conflict** — the popover code is present (lines 889–941) but the button onClick (line 873) navigates to Inbox and sets showNotifications=false. The popover is effectively dead UI. Doctors who tap the bell expect a list of notifications, not a navigation.
- **Two notification surfaces** — notifications popover (dead) + Inbox (alive). Confusing intent.
- **The breadcrumb "Admin / {tab}"** is decorative — Admin is never elsewhere.
- **The sidebar collapse toggle** is small and only visible on desktop.
- **The user-profile click opens "account switcher"** which on doctors is empty (they're not tech admins) — it's a UI hole.
- **Sidebar "Practice" section** has only 1–2 items — feels like a half-empty bookshelf.
- **No clinic name** in the top bar / sidebar header — only the logo.
- **No status indicator** (e.g. "you're offline" / "last synced X ago" / "patient portal status").
- **Always-visible search** is good but the empty placeholder ("Search patients…") doesn't communicate that it also navigates ("Go to Insights"). The CommandPalette is more powerful than the placeholder suggests.
- **Mobile bottom nav** doesn't include Practice — must use hamburger.

### 18.8 Information missing
- Online/offline indicator.
- Last data sync timestamp.
- Clinic/team selector (multi-tenant future).
- Help / support entry point.
- Audit/version indicator.
- Personal notification preferences shortcut.
- Active doctor avatar in top bar.
- Time of day awareness in greeting.

### 18.9 Information redundant
- Breadcrumb.
- Notifications popover code (dead).

### 18.10 Non-technical clinician language test
- "Today / Inbox / Schedule / Patients / Practice" — all clear, plain English.
- "Platform health" — only shown to tech admin (good).

### 18.11 Mobile vs desktop discrepancies
- Sidebar collapse only on desktop (expected).
- Bottom nav only on mobile (expected).
- Search location/behavior consistent.

### 18.12 Workflow / process clarity
- Sidebar → top-bar search → context-switch. Clean.
- The notification bell ambiguity is the biggest friction.

### 18.13 AI / automation opportunities
1. **Conversational top-bar.** Replace the search bar with an AI command bar: "Book Saba next Tuesday", "Show me overdue payments", "Draft aftercare for today's completed sessions".
2. **Proactive AI assistant** — popover that surfaces 1 thing it thinks you should do right now.
3. **Voice activation.**
4. **AI-prioritised nav.** Badges become smarter — not just counts, but "3 urgent" priority weighting.
5. **Conversation continuity.** Pick up where you left off ("You were drafting a reply to Hana — continue?").

### 18.14 Proposed redesign
- **REMOVE:** Dead notification popover code (replace with bell → Inbox or restore popover). Decide one path. The breadcrumb. Account switcher entry for non-tech users.
- **MODIFY:** Top-bar search becomes a conversational AI bar (typed + voice). Sidebar consolidates Practice into a single item (already does this). Add clinic name in header.
- **ADD:** Online status. AI assistant button always available. Help / changelog. Last-synced timestamp.
- **RE-ORDER:** Sidebar: Today → Inbox → Schedule → Patients → Practice → Settings. Bottom nav: Today, Inbox, Schedule, Patients (current).
- **FIRST GLANCE:** Doctor sees clean chrome, a single command bar, and clear nav.

### 18.15 Rating
**Workable.** Clean foundation; the notification-bell ambiguity is the only real bug.

---

# CROSS-CUTTING THEMES

## A. Two notification surfaces, no clear source of truth.
- Notifications popover (top bar, dead code path) + Inbox (live) + Today's "Needs you" + per-tab badges. Doctors will not know which is authoritative.

## B. Inconsistent action language across pages.
- "Open", "View", "View Details", "Review", "Open thread" — semantic neighbours used interchangeably.

## C. Filter chip rows are inconsistent.
- Inbox uses `.filter-chip` shared component with counts inside.
- Patients smart segments use custom inline obsidian-fill style.
- Money uses obsidian-fill style.
- Marketing uses different range-picker style.
- Schedule uses bg-cream toggle group for view, then native selects for filters.

## D. Stat cards repeat the same numbers in multiple places.
- Revenue 30d: Today's strap + Practice→Overview + Practice→Insights + Practice→Money.
- Outstanding £: Practice→Overview + Practice→Money + per-patient Money.
- Funnel/conversion rate: Patients + Insights + Marketing.

## E. Treatment pricing is fragmented.
- Treatments collection drives booking modal.
- MoneyPanel uses TREATMENT_PRICES hardcoded.
- No price shown on booking modal.
- Per-patient Money tab doesn't reference treatment IDs.

## F. Plan ↔ Schedule disconnect.
- Plan phase `sessionsCompleted` is manually updated. Appointments completed in Schedule don't auto-increment. Will cause silent drift.

## G. "Activity" tab mixes communication + intake data.
- Messages + the assessment questionnaire share one tab. Should be split.

## H. AI surfaces are not standardised.
- TodayPanel uses AISurface with gold-strong border.
- ClientRecord uses gold-accent UICard.
- Insights uses a regular Card with gold accent for "What changed".
- No shared "AI insight" component pattern.

## I. Sticky positioning is fragile.
- ClientRecord patient bar uses `top-[52px]` (raw pixels = topbar height).
- Tab bar uses `top-[108px]` (52 + 56).
- A small topbar height change breaks layering across many pages.

## J. The dummy-patient / test-view feature was moved to Settings → Developer.
- Good cleanup, but it's exposed to all users — should be hidden for non-tech-admin users entirely (currently disabled but visible).

## K. Mobile fallbacks are good but inconsistent.
- Tables → cards on mobile is done correctly for Money, Inbox, Marketing, Forms.
- Patients table uses inline mobile mode within the same component.
- Calendar uses different mobile primitives per view (Day grid / Week agenda / List rows).

## L. No global empty-state taxonomy.
- "All caught up", "No matches", "No clients yet", "Nothing in your inbox right now", "No payments yet" — each panel writes its own copy. A shared library would help tone.

## M. Audit logging is sprinkled but inconsistent.
- `logClinicalAction` is called in many handlers (reschedule, profile edit, feedback, payment, prescription) but not everywhere (e.g. status change in lifecycle rail isn't logged; appointment notes save isn't logged).

## N. The shared admin context is large.
- ~60+ fields on `AdminContextValue`. The memoised provider helps re-render, but it's becoming a god-object. Hard to know what comes from where.

## O. Sticky table headers + virtualised lists may misbehave.
- Tanstack-virtual + sticky `data-table` headers can be fragile (the patient table). On 1000+ patient lists this is the kind of edge that breaks.

## P. Sub-tabs vary in placement & style.
- Practice uses a top-of-page pill toggle.
- ClientRecord uses a sticky 5-tab bar.
- Files inside ClientRecord uses a tiny inline pill toggle.
- No design system for "sub-tab".

---

# TOP 20 CHANGES (impact × ease)

| # | Change | File(s) | Impact | Ease |
|---|--------|---------|--------|------|
| 1 | **Auto-increment phase `sessionsCompleted` when an appointment with linked treatmentId is marked Completed.** Today this is manual and will silently drift. | `pages/AdminPage.tsx` `handleBookingSubmit` + status update path; `types.ts` `Appointment.treatmentId` already exists. | High | Medium |
| 2 | **Fix the notification bell.** Decide: popover OR direct-to-inbox. Currently popover JSX is unreachable. Remove dead code or restore. | `pages/AdminPage.tsx` lines 869–941 | Medium | Easy |
| 3 | **Add inline "Send chase" on overdue payments** in Inbox + Money. Today doctors must context-switch. | `pages/admin/panels/InboxPanel.tsx`, `pages/admin/panels/MoneyPanel.tsx` | High | Medium |
| 4 | **Show treatment price + deposit in booking modal.** Currently only duration. | `pages/AdminPage.tsx` lines 989–1018 — extend the `selectedTreatment` summary. | High | Easy |
| 5 | **Add "Brief me" AI strip at top of ClientRecord Snapshot** — 2-sentence patient summary from Claude. | `pages/admin/ClientRecord.tsx` snapshot block (line ~389) | High | Medium |
| 6 | **Promote Clinical Feedback to top of Snapshot** (above stats). It's the doctor's #1 deliverable. | `pages/admin/ClientRecord.tsx` snapshot block | High | Easy |
| 7 | **Add SOAP structure + voice input + AI summary to AppointmentNotesDrawer.** | `pages/admin/AppointmentNotesDrawer.tsx` | High | Medium |
| 8 | **Add drag-and-drop reschedule** to CalendarPanel Week/Day grid. Doctors expect Google-Calendar-style. | `pages/admin/panels/CalendarPanel.tsx` | High | Hard |
| 9 | **Add a unified `<AICard>` component** so Briefing / Follow-ups / Radar / What-changed render with a shared design pattern. | new `components/ui/AICard.tsx` | Medium | Easy |
| 10 | **Standardise filter chip component** across Inbox/Patients/Money/Marketing. | New `components/ui/FilterChips.tsx` | Medium | Easy |
| 11 | **Stripe webhook → auto-reconcile Pending payments.** | `functions/` Cloud Function + write to client.payments | High | Hard |
| 12 | **Add "Send aftercare" inline on Run Sheet** after a session is marked Completed. | `pages/admin/panels/TodayPanel.tsx` Run sheet rows | High | Medium |
| 13 | **Hide test-patient developer feature** for non-tech-admin entirely. Currently rendered disabled. | `pages/admin/SettingsDrawer.tsx` Developer block | Low | Easy |
| 14 | **Move intake questionnaire** out of Activity tab into Snapshot (as an accordion) or its own "Assessment" sub-tab. | `pages/admin/ClientRecord.tsx` `viewTab === 'activity'` branch | Medium | Easy |
| 15 | **Add working-hours editor in Settings → Staff.** | `pages/admin/SettingsDrawer.tsx` Staff tab | High | Hard |
| 16 | **Add "Group by patient" toggle in Inbox.** | `pages/admin/panels/InboxPanel.tsx` | Medium | Medium |
| 17 | **Add per-photo tags + AI auto-tagging** in Photos sub-tab. | `pages/admin/ClientRecord.tsx` photos branch + new Cloud Function | High | Hard |
| 18 | **Add "Find me a slot" AI command** in booking modal. | `pages/AdminPage.tsx` booking modal | High | Hard |
| 19 | **Remove the Practice → Overview help card.** It's roadmap-copy. | `pages/admin/panels/PracticeOverviewSubPanel.tsx` | Low | Easy |
| 20 | **Add an "Outstanding £" inline metric** in the patient sticky bar so doctors don't need to open Money tab to know. | `pages/admin/ClientRecord.tsx` sticky patient bar | Medium | Easy |

---

# AI-FIRST WORKFLOW BLUEPRINT

## Booking workflow (future state)

- **Voice / text intent capture.** From any page, doctor says "Book Saba's next PRP next Tuesday at 11am with Aminah." AI parses → opens booking modal pre-filled.
- **Slot intelligence.** If the requested slot conflicts, AI proposes 3 alternatives ordered by clinician availability, patient preference history, and buffer constraints.
- **Automatic deposit invoice + payment link** generated at confirmation, sent via the patient's preferred channel (SMS / email).
- **Plan-phase linking.** AI auto-tags the appointment to the active treatment phase; increments `sessionsCompleted` upon completion.
- **Recurring sequence creation.** "Book her remaining 3 sessions, fortnightly" → AI produces a 3-session draft for the doctor to one-tap-approve.

## Clinical info input workflow (future state)

- **Pre-session AI brief.** When the doctor opens a patient chart 15 minutes before their session, AI generates a 1-paragraph brief: history, last note, current treatment plan, any concerns from recent messages, suggested talking points.
- **Voice-to-SOAP capture.** During or immediately after the session, doctor dictates. AI structures into Subjective/Objective/Assessment/Plan, fills in measurements/photos automatically from the camera feed.
- **Auto-completion of artifacts.** Session marked Completed → AI drafts aftercare email + suggests the next booking slot + updates plan-phase progress + flags follow-up tasks.
- **Smart referencing.** Doctor types "shed pattern is improving" → AI surfaces previous notes that referenced shedding for inline comparison.
- **Decision support.** AI reads the latest photo + notes and rates progression on a 0–100 scale; flags any clinical concerns ("she mentioned scalp tenderness — consider topical relief").

## Payment management workflow (future state)

- **Stripe-driven reconciliation.** No manual entry. Stripe webhook → client.payments updated → status Paid on the correct invoice.
- **Tiered AI dunning.** Overdue invoice at +1d, +5d, +14d, +30d auto-sends an escalating, personalised reminder in the patient's tone of voice; doctor approves the first draft, then auto-pilot.
- **Refund-decision assistant.** Cancellation triggers AI to compute refund per policy (`prp` / `exosome` / `consult` rules already in `types.ts`); drafts an empathetic response for doctor to approve.
- **Cash-flow forecast & anomalies.** Daily AI brief surfaces "Outstanding is up 23%; one patient (Saba) owes £840 — drafted chase ready" right on Today.
- **Per-treatment net revenue analytics.** AI segments revenue by treatment & clinician, flags margin compression, suggests pricing adjustments.

---

# "If I were Dr Aminah"

It's 08:45. Aminah opens the dashboard on her iPad in the consult room. Her morning runs from 09:00 to 13:00 — 4 sessions, no break. Today (`/today`) loads.

She glances at the greeting and the date. The friendly title is nice but doesn't help. Her eyes skip past it to the Up Next hero — yes, Saba is at 09:00. The hero shows "In 15 min", initials "SK", "PRP + Microneedling", and a flag: "Form unsigned." Aminah pulls a face — she sent the consent two days ago. She taps "Open chart". The page jumps to Patients (because the click handler calls `handleSidebarClick('patients')` rather than going to the chart directly). She has to wait a beat for the patient record to render. **Friction:** the deep link should bypass the patients list and load straight into the chart.

In Saba's Snapshot, she scrolls past the contact rail, the 3 stat cards (next session, sessions completed, pending forms — the last one shows "1"), and clicks into Files → Forms. She finds the unsigned consent. She taps a tiny "Send New Form" button and re-sends. **Friction:** there's no "Resend" button on the existing pending form — she had to send a fresh copy. The form sub-tab doesn't show her how to ask Saba directly via WhatsApp (the clinic's preferred channel) — only the in-portal email.

She returns to Snapshot. She wants to refresh her memory: what did she write last time? She opens Activity. The thread is mixed — payment links, form receipts, free-text messages. She has to scroll. She wants to find her note about Saba's shedding pattern. The accordion at the bottom holds the intake questionnaire — not what she needs. There's no search inside the thread. **Friction:** "previous notes" should be on Snapshot, not buried.

09:00. Saba arrives. Aminah does the session. 09:30. She needs to mark it Completed and write notes. From Schedule → List, she finds the 09:00 PRP, clicks the sticky-note icon, the AppointmentNotesDrawer opens. She types: "Treatment delivered to vertex and temple, well tolerated, no adverse reaction, scheduled follow-up in 14 days." She toggles status to Completed, hits Save. **Friction:** the notes don't auto-link to the Plan phase's `sessionsCompleted`. Aminah will have to remember, later in the day, to open Saba's chart → Plan → edit the active phase → +1 to sessionsCompleted. She probably won't.

09:50 — second session is in 10 minutes. She glances back at Today. The "Needs you" card still says "3 assessment(s) to triage" — same as 30 minutes ago, because the page didn't refresh. **Friction:** real-time sync is invisible. She doesn't trust the numbers.

11:30 — between sessions she opens Inbox to handle the assessment triage. She picks the assessment chip and sees 3 new assessment rows. The primary action is "Review" which jumps her into the patient's Snapshot. To read the actual assessment, she has to scroll down (intake questionnaire accordion) or switch to Activity tab. **Friction:** Review should land her on the assessment, not the snapshot.

12:45 — one assessment done, two to go. A message from Hana arrives: "Hi Aminah, do I need to fast before PRP?" In Inbox, she taps Reply, the expansion opens, she types "No need to fast, just bring your usual breakfast and hydrate well." Hits Send. The item slides out. Nice moment. **Friction:** she had no template insertion (she's typed this answer 12 times). Voice-to-text would have been faster.

13:30 — lunch (sort of). She opens the test-patient view by accident from a stray click in Settings → Developer. She didn't mean to. **Friction:** developer tools shouldn't be exposed in clinician settings.

15:00 — 4 more sessions ahead. Between sessions she remembers Saba's plan needs updating. Opens Saba → Plan → finds active phase → clicks the edit pencil → ticks sessionsCompleted from 2 to 3. Saves. **Friction:** the whole workflow exists only because the system doesn't auto-sync.

18:00 — end of day. She opens Practice → Money to check the day's takings. She marks 2 Stripe payments Paid manually (because there's no auto-reconciliation). **Friction:** she's doing accounting after a 9-hour clinical day.

18:30 — She glances at Practice → Insights out of curiosity. The "What changed" card tells her "Cancellations spiked +120%" — alarming. She has no way to click through to see who cancelled. **Friction:** insights are read-only billboards, not action surfaces.

She closes the laptop. Done.

**How the platform should have served her better:**
- Single AI strip at 08:45 saying: "Saba's at 09:00. Her consent isn't signed — drafted SMS ready to send. The session after will be Hana — she's anxious about PRP, your last note suggested gentle reassurance. By the way, 2 Stripe payments landed overnight — auto-marked Paid."
- Voice-dictated SOAP saved into both the appointment AND auto-incremented the plan phase.
- Inbox grouped by patient so Saba's 3 items showed as one accordion.
- Insights were clickable: tap "Cancellations" → see the list → AI suggests intervention.
- Test-patient view hidden unless Aminah was tech-admin.
- Predictive forecast on Today: "On track for £980 today — slightly ahead of weekday average."

Aminah's morning of 5 tasks (review assessments, see today's schedule, reply to messages, mark sessions complete with notes, check pending payments) currently takes her ~45 minutes of admin scattered across 10 hours. The AI-first redesign should compress that to ~12 minutes total, with most of it done conversationally between sessions.

---

**End of analysis.** All file paths referenced are absolute under `/Users/rasheedamer/Projects/NEW-Novogencis/`. The document is intentionally exhaustive per the request; the Top-20 table and AI-First Blueprint are designed to feed directly into a re-engineering roadmap.
