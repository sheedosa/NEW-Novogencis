# Novogencis — UI/UX Design Brief

> A complete inventory of every tab, panel, and shared element across the **admin
> dashboard** (used by doctors) and the **client portal** (used by patients).
> Feed this document to a design-focused Claude session to drive a polished UI
> redesign without missing features.

**Platform:** Novogencis — a private regenerative hair restoration clinic in
Cheadle, UK. Patients complete a virtual assessment, receive AI-assisted
clinical feedback from Dr Aminah Amer's team, then book PRP / Exosome /
Microneedling treatments.

**Stack:** React 19, TypeScript, Tailwind CSS, Firebase (Auth + Firestore +
Storage + Cloud Functions in `europe-west2`). Anthropic Claude is used for
assessment triage (Sonnet 4.6), daily briefing (Haiku), reply drafts (Haiku),
and follow-up message drafting (Sonnet).

**Current design language:** Warm-premium SaaS / wellness clinic. Light theme.
Off-white ivory background, obsidian text, gold (`#C9A86A`) as the primary
accent, sage green / indigo / warning / danger as secondary status colours.
Inter for UI, Playfair Display for brand moments.

---

## Table of contents

1. [Design system tokens](#design-system-tokens)
2. [Admin dashboard](#admin-dashboard)
   - [Cross-cutting admin shell](#cross-cutting-admin-shell)
   - [Today panel](#today-panel)
   - [Inbox panel](#inbox-panel)
   - [Calendar panel](#calendar-panel)
   - [Patients panel + ClientRecord](#patients-panel--clientrecord)
   - [Assessments panel](#assessments-panel)
   - [Messages panel](#messages-panel)
   - [Money panel](#money-panel)
   - [Insights panel](#insights-panel)
   - [Marketing panel](#marketing-panel)
   - [Platform health panel](#platform-health-panel)
   - [Settings drawer](#settings-drawer)
   - [Booking modal](#booking-modal)
   - [Command palette (⌘K)](#command-palette-k)
3. [Client portal](#client-portal)
   - [Cross-cutting client shell](#cross-cutting-client-shell)
   - [Overview tab](#overview-tab)
   - [Treatments tab](#treatments-tab)
   - [Appointments tab](#appointments-tab)
   - [Assessments tab](#assessments-tab)
   - [Messages tab](#messages-tab)
   - [Profile tab](#profile-tab)
4. [Design opportunities — what to redesign](#design-opportunities)

---

## Design system tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `primary` (gold) | `#C9A86A` | Brand accent, primary CTAs, active nav, key metrics |
| `primary-dim` | `#A8894F` | Hover / pressed gold |
| `primary-soft` | `#F4EDD9` | Soft positive moments, AI surfaces |
| `obsidian` | `#1A1916` | Body text, dark surfaces |
| `ivory` | `#FAFAF8` | Page background — warm off-white |
| `cream` | `#F4F3EF` | Hover bg, secondary surface |
| `sand` | `#E8E6E1` | Borders (0.5px) |
| `muted` | `#6E6A65` | Secondary text |
| `hint` | `#A39E97` | Tertiary text, placeholders |
| `success` | `#3B8C5F` / `#E8F0EB` / `#2D6E47` | Active, paid, completed |
| `warning` | `#C68726` / `#F8F0DB` / `#8B5E1A` | Pending, attention |
| `danger` | `#C04A4A` / `#F4E3E1` / `#8A3535` | Overdue, cancelled |
| `info` | `#3B6FB8` / `#E5ECF5` / `#2B5285` | Neutral data |

Chart palette: sage `#7FA288`, terracotta `#C49072`, indigo `#6B7FB8`, slate `#94A3B8`.

### Typography

- **Family:** Inter (UI), Playfair Display (brand/hero), JetBrains Mono (code/IDs)
- **Scale:** `2xs: 10/14`, `xs: 12/16`, `sm: 13/18`, `base: 14/20`, `md: 15/22`, `lg: 17/24`, `xl: 20/28`, `2xl: 24/32`, up to `6xl: 60/68 -0.03em`
- **Eyebrow pattern:** `text-[10px] font-medium uppercase tracking-[0.12em] text-primary` (used above page titles, above list-row titles for categorisation)
- **Stat label:** `text-[11px] uppercase tracking-[0.06em] text-hint font-medium`
- **Stat value:** `text-[26px] font-medium tracking-[-0.01em] leading-[1.05]`

### Spacing

- Sidebar width: 240px (collapsed: 64px)
- Header height: 52px
- Panel gap: 16px
- Card padding: `16px 18px` (compact `12px 14px` when density=compact)
- Page gutters: `px-6 md:px-10 lg:px-20`

### Radius / shadow

- `sm: 6px`, `md: 10px` (inputs/badges), `lg: 14px` (cards), `xl: 18px` (modals), `2xl: 24px` (hero)
- `card`: `0 1px 2px rgba(15,15,16,0.04)` + `0 0 0 0.5px rgba(15,15,16,0.04)`
- `panel`: `0 4px 16px -4px rgba(15,15,16,0.08)`
- `modal`: `0 20px 48px -12px rgba(15,15,16,0.18)`
- `focus`: `0 0 0 3px rgba(201,168,106,0.25)`

### Components (in `components/ui/`)

`Button` (variants: primary, secondary, ghost, danger; sizes: sm/md/lg; supports leadingIcon, trailingIcon, loading) ·
`Card` (tones: default, dark, subtle, **elevated**; optional **accent stripe** in gold/sage/info/danger/warning) ·
`CardHeader` (title, subtitle, leadingIcon, trailing) ·
`Stat` (label, value, hint, delta pill, icon, **accent stripe**) ·
`Badge` + `StatusBadge` (variants: active, pending, new, review, inactive, danger, ai) ·
`PageHeader` (eyebrow, title, subtitle, actions) ·
`Input`, `Select`, `Textarea` ·
`Modal`, `BottomNav`, `SidebarItem`, `EmptyState`, `Skeleton`, `CommandPalette`.

### Status visualisation

Every status string (`Active`, `Pending`, `Reviewed`, `Cancelled`, etc.) maps to a `StatusBadge` variant. Stat cards use a **left accent stripe** (3px) to categorise — info=neutral, sage=positive financial, gold=brand/conversion, warning=attention, danger=urgent.

### AI surface convention

Anything Claude-generated is marked with a **Sparkles icon + "AI" badge** (variant `ai` = obsidian bg with gold text). Doctors always review and approve patient-facing AI content before it sends.

---

## Admin dashboard

### Cross-cutting admin shell

**Left sidebar (240px / collapsible to 64px)**
- Logo at top + collapse toggle
- "CLINIC" section label
- Nav items (active = gold left border, gold text):
  - Today
  - Inbox — badge with `inboxBadge` count (combined unread + triage + unsigned forms + pending payments + open tasks)
  - Calendar
  - Patients
  - Money — badge with `moneyBadge` count
  - Insights
  - Marketing
- "SYSTEM" section label (technical admin only)
  - Platform health
- Settings button (opens drawer)
- **Account switcher** at bottom: avatar + name + "Viewing as [doctor]" indicator (tech admin can preview as Aminah/Waqas)

Hidden behind hamburger menu below `lg:` (1024px). Slides in as overlay with backdrop.

**Top bar (52px)**
- Hamburger (mobile only)
- Breadcrumb: `Admin / [active-tab]`
- Quick-find (⌘K) input — opens command palette
- Notification bell with red badge (unread count)
- Sign-out icon button

**Notification dropdown**
- Filter tabs: All · Assessments · Messages · Appointments
- List of notifications with type icon, title, body, "Mark all read" link
- Clicking a notification routes to relevant panel + marks read

### Today panel

**Purpose:** Doctor's morning briefing + at-a-glance clinic state for the day.

**Sections top → bottom:**
- PageHeader: "Good [morning/afternoon/evening], [name]" + date + "Book appointment" CTA
- **Stat row** (4 cards): Sessions today (info), Revenue today (sage), New patients · 7d (gold), Open tasks (warning)
- **AI: Today's briefing card** (gold-accent elevated card) — Sparkles icon + "AI" badge, 2-3 sentence Claude-generated summary + 3-5 bullets, generation timestamp + model
- **AI: Follow-up suggestions card** (warning-accent) — collapsible list of cold leads with pre-drafted nudge messages, "Open & review" / "Dismiss" actions
- **Clinic radar card** (dark gradient) — auto-detected signals worth attention (e.g. "3 reviewed patients waiting for outreach")
- **Run sheet** — today's appointments timeline with patient cards, prep flags per appointment (unsigned form, pending payment, etc.)
- **Right column** (desktop only): "Needs you" (X items, jumps to Inbox), unread message previews, "Tomorrow" preview card

**Primary actions:** Book appointment, mark task complete, open client chart, jump to inbox.

**Pain points:** Right column feels sparse with low data. Run sheet empty state is functional but visually flat. Multiple AI cards stacked vertically can feel busy — could collapse into a single "AI assistant" section.

### Inbox panel

**Purpose:** Unified queue of every task/message/form/payment that needs admin attention.

**Sections:**
- PageHeader: "Inbox" + "X items need you" + "New task" CTA
- **Filter chips:** All · Tasks · Assessments · Messages · Forms · Payments (each with count badge)
- **Row list** — each row has:
  - Coloured **left stripe** by type (info=assessment, gold=message, warning=form, sage=payment, danger=high priority)
  - **Type-tinted icon** in matching bg
  - Category **eyebrow** ("PAYMENT", "FORM", "MESSAGE", "TASK")
  - Title + subtitle + time ago
  - Primary action button ("Open", "Open thread", "Reply")
  - Secondary action (snooze, delete for tasks)

**Primary actions:** Open thread, reply, snooze, delete task, open patient chart, take payment, mark task done.

**Pain points:** Long lists (50+) get monotonous despite the type stripes. No bulk actions. Empty state for filters could be more helpful.

### Calendar panel

**Purpose:** Doctor's appointment calendar with day / week / list views.

**Sections:**
- PageHeader: "Calendar" + date + "Book appointment" CTA
- **Controls row:** previous/today/next, view toggle (Day / Week / List)
- **Filters:** clinician filter chip, treatment-type filter chip
- **Week view:** 7-column grid with hour rows, appointment blocks coloured by clinician, clickable empty slots to book
- **Day view:** single-column hour grid (default on mobile)
- **List view:** chronological list of upcoming appointments
- **Above grid (when relevant):** "This week's workload" heatmap — 7-column horizontal bar chart with capacity %

**Primary actions:** Click slot to book, click appointment to edit/reschedule, change view, filter.

**Pain points:** Week view requires horizontal scroll on tablets (`min-w-[640px]`). Time labels (e.g. "9:00 am") wrap on narrow time columns. Appointment blocks are visually busy when stacked.

### Patients panel + ClientRecord

**Purpose:** Master patient registry + drill-down to individual patient record.

**List view sections:**
- PageHeader: "Clients" + count + "Export CSV" CTA
- **Stat row** (4 cards): Total registry (info), Active protocols (sage), Pending review (warning), Conversion rate (gold)
- **Smart segments** (horizontal chip row): All, New leads, Due follow-up, Active, At risk, Lapsed 90d+
- **Search bar** + status dropdown filter
- **Virtualised table** — 3-column grid (Client | Status | Actions), virtualised with @tanstack/react-virtual; on mobile collapses to card layout with status under name

**ClientRecord (when a patient is selected) — tabs:**
1. **Overview** (default) — Patient header card (avatar + status + key metadata), Feedback editor (large textarea with autosave), Upcoming bookings card + Recent activity card (two-up)
2. **Communications** — full message thread with AI Draft button (Sparkles icon)
3. **Forms** — list of sent forms + their signed state, "Send form" dropdown
4. **Gallery** — photo grid (before/after, clinical photos), upload area with image processing
5. **Assessment** — full read-only assessment answers, AI triage results (impression, red flags, suitability, draft feedback)
6. **Treatment** — treatment plan phases editor (Planned / Active / Completed / On Hold), prescriptions list
7. **Financials** — payment history, outstanding balance, "Add payment" form, send-payment-link action

**Primary actions:** Edit status, save feedback, send form, upload photo, add prescription, log payment, send payment link, book appointment, message patient, view AI triage, approve AI draft feedback.

**Pain points:** ClientRecord has 7 sub-tabs which is a lot. Vertical density is high — lots of cards stacked. Gallery doesn't show "before/after" pairing visually. Treatment plan phase editor is functional but visually flat.

### Assessments panel

**Purpose:** Triage queue for newly-submitted assessments awaiting clinical review.

**Sections (two-pane layout):**
- **Left pane (queue):**
  - "Awaiting review" pending list with red-flag count badges per patient
  - "Recently reviewed" collapsed list
- **Right pane (detail of selected patient):**
  - Dark patient header card with status + "Full record" link
  - **AI triage card** (gold accent, elevated) — Sparkles icon + "AI clinical triage" + suitability badge (strong candidate / suitable with caveats / not suitable), clinical impression paragraph, AI red flags list, suitability reason, recommended treatments (chips), **draft feedback letter** preview + "Use this draft" CTA
  - Patient-reported red flags card (danger-bg) — flagged answers from screening
  - Assessment summary card — first 8 Q&A pairs in 2-col grid, "View all" → ClientRecord
  - Feedback editor (dark card) — large textarea, sends notification + email on save, advances queue

**Primary actions:** Use AI draft, edit feedback, submit feedback (changes status to Reviewed + notifies client), open full record.

**Pain points:** When AI draft is "ready", the doctor still has to scroll past triage card to see editor. Could promote the draft → editor flow visually.

### Messages panel

**Purpose:** Two-pane chat interface for clinic-to-patient messaging.

**Sections:**
- **Left pane (thread list):** Search + thread rows (avatar + name + last message preview + unread badge + relative time)
- **Right pane (selected thread):**
  - Patient header (avatar + name + status link to chart)
  - Message thread (scrollable, admin messages right-aligned dark, patient left-aligned light)
  - Message input (textarea + "Quick actions" expander for forms/payments + **AI Draft Sparkles button** + send)

**Primary actions:** Send message, draft with AI, send form, send payment request, mark thread read, jump to chart.

**Pain points:** Thread list on mobile takes full width — switching between threads requires going back. Quick-actions dropdown is functional but visually heavy.

### Money panel

**Purpose:** Practice financial dashboard.

**Sections:**
- PageHeader: "Money" + "Payments across all patients this month" + "Export CSV"
- **Stat row** (4 cards): Received this month (sage + trend pill), Outstanding (info + item count hint), Overdue (danger conditional), Avg days to pay (gold)
- **Aging buckets card** — stacked bar of outstanding £ by age (Not yet due, 1-7d, 8-30d, 30+d) + breakdown grid with colour dots
- **This month forecast card** — projected revenue (received + value of confirmed appointments), Last month total, methodology note
- **Tabs row:** Outstanding · Paid · All + search input
- **Payments table:** patient · description · amount · status pill · due/paid date · "Mark paid" action

**Primary actions:** Mark paid, export CSV, view patient.

**Pain points:** Aging buckets feel academic — could be more visual (donut, sparkline). Forecast card is text-heavy; an actual chart would land harder.

### Insights panel

**Purpose:** Clinic-level analytics: conversion, revenue, retention, ops.

**Sections:**
- PageHeader: "Insights" + "Conversion, revenue and clinic operations"
- **Stat row** (4 KPIs with accent stripes): Conversion rate (gold), Revenue · 30d (sage + delta pill vs prior 30d), Sessions done · 30d (info + delta), No-show rate (danger if >10%)
- **"What changed this period" card** (dark gradient) — narrative bullets auto-generated from period comparison ("Revenue up 100% over last 30 days" / "New patient acquisition slowed (-100%)")
- **Conversion funnel** (horizontal bar): New inquiry → Assessment → Reviewed → Contacted → Converted
- **Revenue trend chart** (12 week area chart, gold fill)
- **Treatment mix** (donut chart, sessions by type)
- **Weekly bookings** (paired bar chart — booked vs completed, 8 weeks)
- **Cancellation / no-show breakdown**

**Primary actions:** Time-range filter (planned), drill into segments (planned).

**Pain points:** Charts use small `fontSize: 11-12` — could be larger / colour-coded by metric. The "what changed" narrative is great copy but visually a wall of dark cards; could be split into prominent callouts.

### Marketing panel

**Purpose:** Acquisition + funnel + campaign attribution (UTM-driven).

**Sections:**
- PageHeader eyebrow "MARKETING" + "Acquisition & funnel" + time range toggle (30d / 90d / All time)
- **Stat row:** Leads captured (info), Top source (sage), Funnel conversion (gold), Attribution rate (warning if <50%)
- **Conversion funnel chart** (horizontal bars, 2/3 width) + **Lead sources donut** (1/3 width)
- **Campaign performance table** — UTM campaign · leads · converted · rate (colour-coded pill)
- **Source detail table** — source × medium × leads × share %
- **Connection cards** (3-col): Google Analytics 4, Meta/Instagram, Google Business Profile — each with "Not connected" badge + "Open admin" link
- **"How attribution works" subtle card** explaining UTM tagging + example URL

**Primary actions:** Switch time range, connect external sources (links out), copy example UTM URL.

**Pain points:** Big chunks of empty state until UTM-tagged traffic flows. Connection cards advertise integrations that aren't actually wired yet — needs clearer "preview" labelling.

### Platform health panel

**Purpose:** Technical-admin-only status overview.

**Sections:**
- PageHeader: "Platform health" + "System status and environment"
- **3 status cards:** Database (Firestore — Operational), Security rules (Active & enforced), API connectivity (Auth + Functions)
- **Admin management card** (rasheedamer99@gmail.com only) — instructions to use CLI `npm run admin:set-claims` / `npm run admin:verify`
- **Test patient seeder** — "Seed / reset test patient" button (technical admin only)
- **Build & environment** card — frontend stack, project ID, region

**Primary actions:** Seed test patient, view env.

**Pain points:** Very utility — no design issues, but it's the dullest panel. Could surface Cloud Functions status, recent function invocations, error rate.

### Settings drawer

**Purpose:** Side drawer (right-side, slide-in) for per-admin preferences + clinic-wide templates.

**Sections (tabs at top):**
1. **Preferences** — Density toggle (Comfortable / Compact), "Viewing as" selector (tech admin only — preview as Aminah / Waqas / all)
2. **Templates** — list of reusable message/note/email templates with edit/copy/delete, "New template" CTA, expand-to-full-screen toggle
3. **Staff** — placeholder (no implementation yet)

**Primary actions:** Toggle density, switch view-as, manage templates, copy template body.

**Pain points:** Templates UX is functional but could feel more like a CRM template manager — categorisation, search, usage counts.

### Booking modal

**Purpose:** Create or edit an appointment.

**Sections:**
- Modal header with patient name (or "New appointment")
- Form: client search/select, treatment type dropdown, date picker, time slot picker, clinician picker, notes textarea
- Action row: Cancel · Save

**Pain points:** Date + time are separate fields — could be merged with smart slot suggestions based on clinician availability.

### Command palette (⌘K)

**Purpose:** Power-user keyboard shortcut to jump anywhere.

**Sections:**
- Search input at top
- Grouped results: Navigate (Go to Today / Inbox / etc.), Patients (live patient name search), Actions (Book appointment, Send form…)
- Footer hints: ↑↓ to navigate, ↵ to select, esc to close

**Pain points:** Discoverability — admins don't know it exists until shown. Needs a subtle "⌘K" hint somewhere.

---

## Client portal

### Cross-cutting client shell

**Left sidebar (desktop, lg+)**
- Logo at top
- "MY CARE" section label
- 6 nav items: Overview, Treatments, Appointments, Assessments, Messages (badge with unread count), Profile
- User profile card at bottom (avatar + name + "Client portal")

**Mobile bottom navigation**
- 4 visible items: Home (Overview), Appointments, Messages (badge), Profile
- Treatments + Assessments accessible via Overview tab actions or breadcrumb (not in bottom nav)
- Active state: gold underline at top of icon

**Top bar**
- Breadcrumb: `Portal / [active-tab]`
- "Treatment journey" progress bar with % (hidden on mobile)
- Notification bell with red unread badge
- Sign-out icon

**Notification popover**
- Filter tabs: All · Messages · Appointments · Feedback
- Notification rows with type icons (MessageSquare, CalendarCheck, Star, FileText, CreditCard, BadgeCheck)
- Unread rows: primary/5 bg + left primary border
- "Mark all read" link
- Click routes to relevant tab

### Overview tab

**Purpose:** Patient's landing page. Reassures + summarises where they are in their journey.

**Sections top → bottom:**
- PageHeader: "Welcome back, [first-name]" + "Account status: [status]" + package-status badge
- **Conditional banner** (one of):
  - 🟡 **"Awaiting clinical review"** — gold-accented clickable banner with ClipboardList icon, copy "Your assessment is with the clinical team · Typically reviewed within 48 hours · Tap to view what you submitted" → opens Assessments tab
  - 🟢 **"Feedback ready"** — sage-accented banner with CheckCircle icon, copy "Your clinical team has reviewed your assessment · Tap to read your personalised feedback" → opens Assessments tab
- **Stat row** (3 cards): Next appointment, Treatment plan progress (with gold progress bar + %), Your clinician (dark card with primary stethoscope)
- **Quick actions card** — 2x2 grid of ghost buttons (Request visit, View progress, Message clinic, My assessment)
- **(Right column on dark card)** — "What's next" / clinician note / latest activity

**Patient actions:** Tap banner → assessments, book/request visit, message clinic, view treatment progress, view assessment.

**Pain points:** Two CTAs in the quick-actions card both go to Messages tab — feels redundant. Clinician dark card has lower text contrast than other cards. The conditional banner is a great pattern but only fires on specific status combinations.

### Treatments tab

**Purpose:** Detailed view of the patient's treatment plan, sessions, gallery, prescriptions.

**Sections:**
- PageHeader: "Your treatment journey" + subtitle
- **Plan summary card** — plan title + adminNotes + total phases / sessions completed across plan
- **Phases timeline** — each phase as a card with: name, description, status badge (Planned/Active/Completed/On Hold), sessions planned vs completed, session progress bar, date range
- **Session timeline** — chronological list of appointments (date card + type + clinician + status)
- **Progress gallery** — grid of clinical photos with date labels, click to open lightbox
- **Prescriptions list** — drug name, dosage, instructions, start/end date, status

**Patient actions:** View photo gallery, view phase details, click "Request next session" to deep-link to Messages.

**Pain points:** Empty state for patients without a plan ("No treatment plan assigned yet") is bland — they may worry. Phase visualisation is functional but could feel more like a true timeline with vertical connector lines. Prescription cards have low visual differentiation by status.

### Appointments tab

**Purpose:** Manage upcoming + past appointments.

**Sections:**
- PageHeader: "Appointments" + "Upcoming and past sessions" + "Request visit" CTA
- **Appointment cards** (sorted, upcoming first):
  - Date in calendar-style cream block (month abbr + day)
  - Type + time
  - Clinician name (if assigned)
  - Status badge
  - "Upcoming" marker for confirmed/pending future appointments
  - Inline action panel: "Request reschedule" → opens textarea, "Request cancel" → opens textarea, "Back" to collapse
- **Right column (desktop only):**
  - Booking policy card (48h notice, arrival time, prep guidance)
  - Rescheduling help dark card with copy

**Patient actions:** Request visit (opens Messages), request reschedule (sends message), request cancel (sends message), expand/collapse action panel.

**Pain points:** "Request" language is correct (admin reviews + confirms) but lacks success-state feedback. Booking policy not visible on mobile. Empty past-appointment state could be more encouraging.

### Assessments tab

**Purpose:** Show the patient what they submitted + the clinical team's feedback.

**Sections (state-dependent):**
- PageHeader: "Assessments" + "Your clinical reviews and feedback"
- **If feedback exists:**
  - Dark navy "Clinical Feedback" card with primary blur decoration, italic quote of feedback, reviewer name + review date
- **If awaiting review:**
  - White card with gold accent: ClipboardList icon, "Thanks [name], your clinical team has it" + 48-hour reassurance copy
  - **Visual timeline:** Submitted ✓ → Under review ● (pulsing) → Feedback ready ○ → Book consultation ○ (4 steps with connector lines, gold for completed, sand for pending)
  - Submission timestamp below
- **"Submitted Information" card:**
  - 2-col grid of key extracted fields: Screening Conditions, Triggers, Lifestyle, Medical History, Medications, Lifestyle & Hair Care
  - **"Photos You Uploaded" gallery** — responsive grid of assessment photos (2/3/4 cols by viewport), click to open in new tab
  - **"Detailed Responses"** — all Q&A pairs (photos excluded), each in a bordered row

**Patient actions:** View feedback, view photos, view detailed responses.

**Pain points:** When clinical feedback IS available, the timeline isn't shown (could still summarise the journey visually). Photo gallery uses anchor tags rather than a proper lightbox modal — opens in new tab, not optimal.

### Messages tab

**Purpose:** Two-way messaging with the clinic.

**Sections:**
- **Chat header card:** Stethoscope icon, "Novogenics Clinical Support", green dot "Direct Portal Access", "< 24h response"
- **Message thread** (scrollable):
  - Clinic messages: white bubble left-aligned with clinician icon
  - Patient messages: dark obsidian bubble right-aligned, read-receipt indicator ("· Read")
  - **Form-type messages:** FileText icon + form title + "Open Interactive Form" button → opens InteractiveForm modal
  - **Payment-type messages:** CreditCard icon + amount + "Complete Payment" button → external Stripe link
  - Timestamps below each message
- **Sticky composer:** MessageInputForm — textarea + send button (no AI draft button on client side, intentionally)

**Patient actions:** Send message, open + complete form (signature pad + field entry), pay via external link.

**Pain points:** No typing indicator. No read receipt for clinic-sent messages (only patient-sent show read state). Form opens a modal which is correct, but the "Open Interactive Form" button could communicate urgency if the form is overdue.

### Profile tab

**Purpose:** View + edit personal information.

**Sections (2-column on desktop):**
- **Left (1/3 width):**
  - Avatar card (large initials, full name, Client ID `monospaced`, status badge)
  - Account status card (Policies acceptance — CheckCircle or X)
- **Right (2/3 width):**
  - Personal information form (Phone, Date of birth, Gender select, Address)
  - "Edit profile" toggles into edit mode with Save Changes + Cancel buttons

**Patient actions:** Edit profile, save changes, cancel edit.

**Pain points:** No email displayed (it's the auth identifier — could surface read-only). No password change action. No avatar upload. Policies acceptance shows status but no way to re-read policies from this card.

---

## Design opportunities

### High-impact UI redesigns to commission

**A. Reduce visual repetition.** Many panels use the same generic card pattern (white bg + sand border). The system has elevation + accent tokens but they're underused. Identify the 2-3 most important cards per panel and elevate them (`tone="elevated"` + accent stripe); flatten everything else.

**B. Stronger feature differentiation for AI surfaces.** Daily briefing, AI triage, AI follow-ups, and AI draft buttons should share a recognisable visual language (currently consistent with Sparkles + "AI" badge, but could go further — a faint gradient bg, a soft glow on hover, an "AI" status colour scheme).

**C. Patient-side reassurance throughout.** The Overview banner + Assessments timeline are great. Extend the same warmth into Treatments (current empty state is clinical) and Profile (currently a form, could feel more personal).

**D. ClientRecord 7-tab density.** Doctors spend most of their time here. The Overview sub-tab has a lot vertically stacked. Consider grouping related cards into expandable sections, sticky tab nav, or a more compact two-column layout.

**E. Mobile admin parity.** Calendar week view is unusable below `sm:` (auto-switches to day). ClientRecord vertical stack works but the inbox/messages two-pane split needs a back-button pattern for thread switching.

**F. Patient mobile bottom nav.** Currently 4 items (drops Treatments + Assessments). Reconsider — Assessments is the most engaging tab for new patients waiting for feedback, deserves placement.

**G. Quieter, fewer notifications.** Notification pattern is solid but volume can overwhelm. Group multi-message threads into a single "3 new messages from [Patient]" entry.

**H. Empty states with warmth.** Many panels say "No X yet" — for a clinical wellness brand, these could be more inviting (illustration, soft copy, gentle next-step CTA).

**I. Status colour clarity.** Currently many statuses map to the same badge variant. Consider a tighter palette: Submitted (info) → Reviewed (gold) → Contacted (sage) → Converted (success-text) → Active (deep sage) → Lapsed (muted). A status that's progressed should look more "advanced" visually.

**J. Treatment phase timeline.** Currently cards stacked vertically. A true vertical timeline with connector lines + phase numbers would communicate progression much better and is a signature pattern for clinical/wellness UI.

**K. Visual marketing data.** The Marketing tab has charts but feels analytical. For a small clinic running modest campaigns, the source breakdown could be more visual (channel logos, comparative emoji-bar style).

**L. Booking modal modernisation.** Current modal is functional but feels admin-only. Could become the centrepiece flow with smart slot suggestions, clinician availability indicators, prep checklist.

### Hard constraints to preserve

- **Light theme only** (warm ivory, never dark mode default)
- **Gold (`#C9A86A`) as the primary accent** — Novogenics brand identity
- **Inter for UI, Playfair Display for hero moments only**
- **GDPR / UK clinical sensibility** — patient information is dignified, never gimmicky
- **All AI content is doctor-approved before it reaches the patient** — design must always make the "review before sending" loop obvious
- **Mobile-first** — every panel must work at 375px width
- **No emojis in patient-facing surfaces** unless explicitly requested

### Components ready to lean on

Already built in `components/ui/`:
- `Stat` with `accent` + `delta` + `hint` props
- `Card` with `tone="elevated"` + `accent` props
- `Badge` and `StatusBadge` with seven variants
- `PageHeader` with `eyebrow`
- `CommandPalette`, `BottomNav`, `Modal`, `Skeleton`, `EmptyState`

Lucide for icons throughout. Recharts for analytics. Motion (Framer) for transitions.

---

*This document was generated as a complete inventory snapshot of Novogencis at
commit `c044a63` for a UI redesign engagement. Pair it with the live deployment
at `https://gen-lang-client-0344977334.web.app` and screenshots from each panel
for full context.*
