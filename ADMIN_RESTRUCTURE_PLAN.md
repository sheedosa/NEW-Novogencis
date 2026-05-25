# Admin Restructure Plan — Why Doctors Are Confused

## TL;DR

The admin has **two generations of code layered on top of each other**:
- Old: Overview / Assessments / Appointments / Messages / Clients
- New: Today / Inbox / Calendar / Patients / Money / Insights / Marketing

Both still exist. The 4 old panels are **dead code** (1,257 lines, not imported but still in the repo). The internal vocabulary still references both. The result is a dashboard with **8 sidebar items**, **3-6 ways to do every task**, and **the patient record (where 80% of clinical work happens) hidden behind a tab**.

**The fix is structural, not cosmetic.** Move from 8 top-level items to 5.

---

## What's wrong

### 1. Too many top-level items
- Doctors see 8 sidebar items (Today, Inbox, Calendar, Patients, Money, Insights, Marketing, Settings)
- Working memory limit is 7±2 — we're at the edge
- 3 of those (Money, Insights, Marketing) are **founder-facing, used weekly or monthly** — but they take prime sidebar real estate every day

### 2. The same task lives in 2-6 places
**Reviewing a new assessment** can be started from: Today → Needs you, Today → Clinic Radar, Inbox → Assessments filter, Notification bell, Patients → search → click row, Patients stat card. **6 entry points.**

**Replying to a patient message:** Today → Needs you, Inbox → Messages, Notification bell, Patients → ClientRecord → Activity, ⌘K → patient → Activity. **5 entry points.**

Each lands at slightly different surfaces. Each leaves different residual state.

### 3. The patient record is the workhorse but invisible
Most clinical work happens inside **ClientRecord** — the 5-tab patient drilldown (Snapshot, Plan, Files, Activity, Money). But it doesn't appear in the sidebar. Doctors have to know to go to Patients → search → click row → land in record.

### 4. Two AI surfaces compete for attention on Today
The Today panel has **8 content blocks** including 3 separate AI cards (Briefing, Follow-ups, Clinic Radar). Doctors don't know what's "the" AI signal. Plus a 4th notification: morning briefing toast.

### 5. Three notification surfaces for the same data
- Notification bell dropdown
- Today panel "Needs you" card
- Inbox panel filtered list

All three show: new assessments, unread messages, unsigned forms, overdue payments, open tasks. The doctor reads the same items in 3 places.

### 6. Per-session clinical notes have no home
Doctors mark a session "Completed" with one click — but there's **no place to write per-appointment SOAP notes**. The only `notes` field is on the booking modal at creation time. After-session notes get stuffed into patient-level Internal Notes (which becomes a wall of text) or skipped entirely.

### 7. "View as test patient" looks like real navigation
It sits in the user-profile menu (bottom of sidebar), available to all admins including doctors. Doctors have accidentally triggered it and ended up in the patient portal wondering what happened.

### 8. Calendar Week view, dead panels, etc.
The codebase has:
- 4 dead panels (`OverviewPanel`, `AssessmentsPanel`, `AppointmentsPanel`, `MessagesPanel`)
- Legacy `'overview'` as initial tab state with a mapping back to `'today'`
- Notification handler uses old vocabulary (`'assessment'`, `'communications'`, `'forms'`)
- Hover-only "Send New Form" dropdown (broken on touch)

---

## The Restructure — 5 sections

```
┌─ CLINIC ─────────────┐
│ 🌞 Today             │  daily landing
│ 📥 Inbox             │  everything that needs me
│ 🗓 Schedule          │  formerly "Calendar"
│ 👥 Patients          │  registry + ClientRecord
├─ PRACTICE ───────────┤
│ 📊 Practice          │  NEW — absorbs Money, Insights, Marketing
├─ SYSTEM (tech only) ─┤
│ ❤️ Platform health   │
└──────────────────────┘
⚙ Settings (separate, bottom)
```

Doctors see **5 main items + Settings**. Inside Miller's 7±2. Matches the BottomNav we already use on mobile.

---

### 🌞 Today — simplify

**Remove:**
- 4-KPI row at the top (duplicates Run sheet + Inbox)
- 2 of the 3 AI cards — combine Briefing / Follow-ups / Radar into one "AI assistant" with internal rotation

**Keep:**
- Greeting
- Run sheet (today's appointments — promote as the focal point)
- "Needs you" sidebar (links to Inbox filters)
- Tomorrow preview

**Replace KPIs with:** a single inline strap-line in the page header — *"3 sessions · £840 today · 2 things need you"*

---

### 📥 Inbox — make it the only "needs you" surface

**Add:**
- **Reply-in-place** for message items (expand row to show last 3 turns + composer — no navigation)
- **Review-in-place** for assessment items (expand to show AI triage + answers + feedback editor)
- **Mark-paid-in-place** for payment items (already works)

**Wire:** Notification bell click → opens Inbox (not its own dropdown)

**Result:** One canonical place for "things that need me." No more triple-counting.

---

### 🗓 Schedule (renamed from Calendar)

**Rename:** "Calendar" → "Schedule" everywhere (industry standard term)

**Remove from this panel:** Workload heatmap (move to Practice → Operations — it's a business metric)

**Add:** Per-appointment notes editor — clicking an appointment opens a side drawer with `time / client / type / doctor / notes / status` — all editable. Closes the SOAP notes gap.

---

### 👥 Patients — promote search

**Add:** Always-visible patient search in the top bar (currently only ⌘K, hidden on mobile)

**Inside ClientRecord:**
- Split "Files" into "Forms" + "Photos" (or sub-tabs inside Files) — they're unrelated entities
- Move "Assessment Q&A summary" from Activity tab → Snapshot (Activity should be conversations only)

**Keep:** Sticky patient bar, 5-tab structure, Internal Notes editor, Lifecycle dropdown, FeedbackEditor

---

### 📊 Practice — NEW

**Sub-tabs:**
- **Overview** — high-level KPIs + "What changed" narrative
- **Money** — current MoneyPanel
- **Insights** — current InsightsPanel charts
- **Marketing** — current MarketingPanel
- **Operations** — workload heatmap + future staff utilisation

**Result:** Doctors who don't care about business never visit this surface. Founder gets one consolidated place for it.

---

### ❤️ Platform health (tech admin only)

No change.

---

## Top 10 Quick Wins (each under 1 day)

| # | Change | Impact |
|---|--------|--------|
| 1 | **Delete the 4 dead panels** (OverviewPanel, AssessmentsPanel, AppointmentsPanel, MessagesPanel) | -1,257 lines, less codebase confusion |
| 2 | **Fix initial activeTab** from `'overview'` → `'today'`, remove legacy mapping | Stops "tab name doesn't match what's visible" weirdness |
| 3 | **Reduce Today KPIs to a single strap-line** | +120px above the fold |
| 4 | **Combine 3 AI cards into one** with tabs | One AI focal point |
| 5 | **Rename Calendar → Schedule** | Industry vocabulary; clarity |
| 6 | **Move "View as test patient" to Settings** | Stops accidental triggers |
| 7 | **Inline Reply in Inbox** for messages | Removes 2-screen detour for most common task |
| 8 | **Add per-appointment notes editor** to Schedule + ClientRecord | Closes SOAP notes gap |
| 9 | **Patient search always-visible in top bar** | Most-used action becomes one tap |
| 10 | **Notification bell → opens Inbox** instead of its own dropdown | Single source of truth for "needs me" |

---

## Bigger Structural Changes (each 1-3 days)

| Change | Effort |
|--------|--------|
| Build new "Practice" section with sub-tab routing | 1-2 days |
| Migrate Money + Insights + Marketing into Practice tabs | 1 day |
| Inline expand pattern in Inbox (reply, review, mark-paid in place) | 2-3 days |
| URL routing for admin sub-views (`/admin/patients/:id/snapshot`) | 1-2 days |
| Per-appointment notes side drawer + editing | 1 day |
| Split ClientRecord Files into Forms + Photos | 0.5 day |

**Total restructure:** ~7-10 working days

---

## What NOT to change (already working)

- Smart segments in Patients (new-leads, due-followup, at-risk, lapsed) — rare and valuable
- ClientRecord sticky-bar + 5-tab structure
- AssignedBadge + "My patients" toggle (essential for two-doctor gender-segregated practice)
- Booking modal's live conflict warning
- AI badge / AISurface — distinguishes AI from human-written content (clinical trust)
- CSV exports
- Density toggle
- Audit logging (`logClinicalAction`) — regulatory

---

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Doctors who've memorised 8-tab sidebar hunt for Money/Insights/Marketing | One-time tooltip on first visit to new "Practice" item |
| Removing notification bell dropdown breaks a familiar pattern | Keep dropdown for 1 release as transition; show badge on Inbox |
| URL routing is structural | Defer — quick wins don't depend on it |
| Per-appointment notes is a data change | `Appointment.notes` already exists in types — pure UI work |
| Inline Inbox reply is bigger build | Half-step: opens a side drawer with composer, not full inline |
| Doctors who use "View as test patient" daily | Survey first; if used daily, leave but move to Settings |

---

## The Three Phases

### Phase 1 — Foundation cleanup (2 days)
Quick wins 1, 2, 5, 6, 10. Plus delete dead panels. Plus rename Calendar.

### Phase 2 — Today + Inbox redesign (2-3 days)
Quick wins 3, 4, 7. Single AI surface. Inline Inbox actions. KPI reduction.

### Phase 3 — Practice section + per-appointment notes (3-4 days)
New "Practice" sidebar item. Migrate Money/Insights/Marketing under it. Add per-appointment notes editor. Add top-bar patient search.

**Total: ~7-9 days of focused work.** After Phase 1 alone the doctors should feel meaningful relief.

---

## The Bottom Line

The dashboard isn't broken — it's **overgrown**. The fix is to prune, consolidate, and promote what doctors actually use. The new structure tells them:

- "Right now" → **Today**
- "Things needing me" → **Inbox**
- "When am I working" → **Schedule**
- "Tell me about a patient" → **Patients**
- "How's the clinic doing" → **Practice**

That's how a clinician thinks. The current dashboard scatters those concepts across 8 sidebar items. The proposed restructure aligns the IA with the mental model.
