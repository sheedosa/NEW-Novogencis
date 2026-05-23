# Mobile UX Deep Audit — Admin + Client Portals

The user's complaint: *"the layout and UI of sections are not suited for mobile view where the user needs to scroll across and it looks and feels like a desktop page."*

This audit confirms it. The platform was built desktop-first with `lg:` responsive modifiers added on. Every tab in both admin and client portals has at least one of: horizontal scroll, multi-column grids that don't stack right, master/detail layouts that don't collapse, modals that aren't bottom-sheets, padding optimised for desktop, fonts too small, or critical content buried below sidebars.

---

## TL;DR

| Surface | Tabs/Sections | Native-feel | Workable | Desktop-cramped | Broken |
|---------|--------------|-------------|----------|-----------------|--------|
| **Admin** | 12 panels + ClientRecord + drawer | 2 (Platform Health, Settings) | 4 (Today, Patients, Money, Marketing) | 4 (Inbox, Insights, Appointments, Assessments) | 2 (Calendar Week view, Messages) |
| **Client** | 6 tabs + intake + auth | 0 | 1 (Messages) | 5 (Overview, Assessments, Profile, AssessmentPage, AuthPages) | 1 (Treatments) |

Plus 5 critical issues in ClientRecord and 1 in InteractiveForm.

**Total findings**: ~75 issues. **Root cause**: mostly a few recurring patterns that can be fixed in cross-cutting sweeps rather than per-section.

---

## The 5 Patterns That Cause 80% of Issues

| # | Pattern | Where it appears | Fix |
|---|---------|------------------|-----|
| 1 | **`lg:grid-cols-12` 8/4 sidebar layouts that don't reorder on mobile** | Treatments, Appointments, Profile, Assessments, MessagesPanel, AssessmentsPanel | Add `order-first lg:order-none` to sidebar; or absorb sidebar into top section |
| 2 | **Master/detail panels with no mobile collapse** | MessagesPanel, AssessmentsPanel show both list and detail simultaneously | Mirror ClientsPanel pattern: `${selected ? 'hidden md:flex' : 'flex'}` |
| 3 | **Excessive padding `p-5 md:p-8 lg:p-10`** on cards | Almost every panel | Sweep to `p-4 md:p-6` |
| 4 | **Hand-rolled modals not using shared `<Modal>`** | 5 in ClientRecord, 1 in InteractiveForm | Migrate all to `<Modal>` for bottom-sheet on mobile |
| 5 | **4-column stat grids that stack 1×4 vertically on mobile** | Today, Money, Patients, Insights, Marketing, Overview | Change `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` → `grid-cols-2 lg:grid-cols-4` |

Fixing just these 5 patterns would resolve ~60% of the issues.

---

## CRITICAL — Mobile-breaking issues

### Admin

1. **CalendarPanel Week view forces horizontal scroll**
   `pages/admin/panels/CalendarPanel.tsx:310-311` — `<div className="min-w-[640px] sm:min-w-[800px]">` on a 360px viewport guarantees horizontal scroll. Defaults to "day" mode on mobile (good) but user can still switch back to Week.
   **Fix:** Disable Week view button at `<sm`, or replace with vertical agenda.

2. **MessagesPanel + AssessmentsPanel don't collapse on mobile**
   `MessagesPanel.tsx:81`, `AssessmentsPanel.tsx:68` — both render list AND detail full-width on mobile. User selects an item, has to scroll past the entire list to find the detail.
   **Fix:** When `selectedThreadId`/`triageSelectedId` is set, hide the list on mobile.

3. **ClientRecord hand-rolled modals** (5 of them — Reschedule, Quick Edit, Add Phase, Add Rx, Add Payment)
   `ClientRecord.tsx:1171, 1232, 1361, 1430, 1478` — none use the shared `<Modal>` component, so no bottom-sheet, no drag-dismiss, no safe-area handling.
   **Fix:** Migrate all 5 to `<Modal>`.

4. **InteractiveForm modal also hand-rolled**
   `components/InteractiveForm.tsx:209` — patients sign clinical consent forms on mobile in a centered desktop modal.
   **Fix:** Convert to shared `<Modal>`.

5. **InboxPanel rows too dense**
   3 actions (Snooze + Delete + Primary button) crammed next to icon + title + 2-line subtitle + time. Primary button often clips on 360px.
   **Fix:** Stack as cards on mobile.

6. **AdminPage BottomNav "Patients" never highlights**
   `AdminPage.tsx:981` — sends `clients` but `resolvedTab` becomes `patients`. Active comparison fails.
   **Fix:** Change item id to `patients`.

7. **Fixed-height panels sit behind BottomNav**
   `AssessmentsPanel.tsx:56` and `MessagesPanel.tsx:63` use `lg:h-[calc(100vh-9rem)]` without accounting for the 64px BottomNav on mobile.

### Client

8. **Treatments tab — Program Overview buried at bottom on mobile**
   `lg:grid-cols-12` 8/4 layout means patients scroll past every historical session before seeing current program details.
   **Fix:** `order-first lg:order-none` on the right rail.

9. **Appointments tab — Booking Policy + change-request card at bottom**
   Same 8/4 pattern. Patients scroll past every appointment to find cancellation policy.
   **Fix:** Same `order-*` reordering.

10. **Profile tab — no sticky save**
    Edit a long form on mobile, keyboard up, save button off-screen.
    **Fix:** `position: fixed` footer with Cancel/Save when editing.

11. **AssessmentPage DOB picker — 3 separate `<select>` dropdowns**
    Day/Month/Year as three native dropdowns. iOS opens 3 separate roller wheels.
    **Fix:** Single `<input type="date">`.

12. **Messages height calc is wrong**
    `h-[calc(100dvh-16rem)]` doesn't account for portal-topbar + PageHeader + BottomNav. Chat composer hides behind nav or wastes space.
    **Fix:** Use `flex-1 min-h-0` inside flex parent that already accounts for chrome.

13. **Assessment photos open in new tab instead of in-place lightbox**
    `ClientDashboard.tsx:1115` uses `<a target="_blank">` — disorienting on iOS Safari.
    **Fix:** Use the existing `lightboxImage` state pattern.

14. **TimelineStep horizontal layout broken on mobile**
    `ClientDashboard.tsx:1031-1040` — 4 steps + 3 connectors don't fit in 360px width. Labels are 10px.
    **Fix:** Vertical timeline on mobile.

### Cross-cutting

15. **Inputs trigger iOS zoom-on-focus**
    Many inputs use `text-sm` (14px) which is below the iOS 16px minimum that prevents auto-zoom.
    **Fix:** Override input/select base styles to `text-base sm:text-sm`.

---

## HIGH-PRIORITY — Significant UX gaps

### Admin
- Inbox/Patients/ClientRecord filter chips use `overflow-x-auto` with no fade affordance — users don't know more chips exist
- Stats grids stack 1×4 vertically instead of 2×2 on mobile (Today, Money, Patients, Insights, Overview)
- MoneyPanel payment rows too dense — 6 properties per row at 360px
- ClientsPanel stats hidden entirely on mobile (`hidden lg:grid`)
- ClientRecord Files tab renders Forms + Gallery sequentially as one giant scroll
- Hover-only "Send New Form" dropdown — can't open on touch
- TodayPanel ordering — heavy AI/radar cards bury the run sheet below the fold
- Booking modal time `<select>` with 27 options creates a 270px-tall picker

### Client
- Overview tab: 3 stat cards stack 1×3 instead of 2×1
- Stats cards use `p-5 md:p-8 lg:p-10` — too much padding mobile
- Welcome PageHeader eats 80px on every tab with redundant subtitle
- Appointment cards' status badge wraps to second line on long names
- Gallery photos open lightbox correctly but assessment photos don't (inconsistent)
- Profile avatar is a generic icon — no profile photo upload
- Auth: "Forgot?" link too small/grey
- AssessmentPage gender selector tiles `py-8 md:py-10` create 140px tap targets that don't fit on screen together
- AssessmentPage submit footer too tall (`p-5 md:p-8`) — eats 20% of mobile viewport
- No auto-scroll-to-bottom in messages
- No read receipts (single/double tick)
- No write batching for mark-all-read (write storm)
- AssessmentPage uses `h-screen` not `100dvh` — iOS Safari bottom bar clips
- AssessmentPage custom camera UI fragile — should use `capture="environment"` input
- ClientDashboard sidebar overlay backdrop missing in JSX (CSS exists)

---

## TOP 10 FIXES — Ranked by Impact × Ease

| # | Fix | Files | Effort | Impact |
|---|-----|-------|--------|--------|
| 1 | **Reorder Treatments + Appointments + Profile** so sidebar content (Program Overview, Booking Policy, etc.) appears first on mobile via `order-*` | ClientDashboard.tsx (3 sections) | S | Massive — fixes user's #1 complaint |
| 2 | **Collapse master/detail in MessagesPanel + AssessmentsPanel** — when item selected, hide list on mobile | MessagesPanel.tsx, AssessmentsPanel.tsx | S | Fixes 2 broken panels |
| 3 | **Replace Calendar Week view** with vertical agenda on mobile (no more 640px horizontal scroll) | CalendarPanel.tsx | M | Removes biggest horizontal scroll trigger |
| 4 | **Migrate ClientRecord's 5 hand-rolled modals** + InteractiveForm to shared `<Modal>` | ClientRecord.tsx, InteractiveForm.tsx | M | 6 modals become native bottom-sheets |
| 5 | **Stat grid sweep** — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` → `grid-cols-2 lg:grid-cols-4` | All admin panels | S | Stats scannable in 1 mobile screen |
| 6 | **Padding sweep** — `p-5 md:p-8 lg:p-10` → `p-4 md:p-6` across cards | Client portal + admin panels | S | Returns 20% mobile screen real estate |
| 7 | **Convert Inbox + Money rows to stacked cards on mobile** | InboxPanel.tsx, MoneyPanel.tsx | M | Two key admin panels become tappable |
| 8 | **Force `text-base sm:text-sm` on inputs/selects** to prevent iOS zoom-on-focus | Input.tsx, raw inputs in Calendar, ClientRecord forms | S | Forms stop zooming on iOS |
| 9 | **AssessmentPage DOB** — single `<input type="date">` instead of 3 selects | AssessmentPage.tsx | S | Massive UX improvement for intake |
| 10 | **Vertical TimelineStep on mobile** + sticky save bar on Profile | ClientDashboard.tsx (2 sections) | M | Two visible patient pain points fixed |

---

## NATIVE-APP PATTERNS MISSING

Prioritised for impact:

**Must have (Sprint 2 candidates):**
- Pull-to-refresh on lists (messages, appointments)
- Optimistic UI on message send + appointment requests
- Bottom-sheet modals (mostly covered by Modal migration)
- Auto-scroll to bottom in chat
- Keyboard avoidance (composer not hidden when keyboard opens)
- In-place image lightbox for ALL photo views (currently inconsistent)
- Read receipts on messages
- Native date pickers (`<input type="date">`) replacing all custom

**Should have:**
- Skeleton screens vs spinners (component exists, unused in client)
- Haptics on important taps (send, confirm, submit)
- Sticky CTAs (save buttons that follow keyboard)
- "Add to Calendar" for appointments
- Background notifications via service worker

**Nice to have:**
- Biometric auth (Face ID / WebAuthn) for returning sessions
- Swipe-to-dismiss notifications
- FAB for new message/request
- Tab-bar hide on scroll

---

## RECOMMENDED SPRINT

**Sprint 2 — "Mobile-first redesign"** (~5 working days):

**Day 1: Cross-cutting sweeps**
- Stat grid: `grid-cols-2 lg:grid-cols-4` everywhere
- Padding sweep: `p-5 md:p-8 lg:p-10` → `p-4 md:p-6`
- Input zoom fix: `text-base sm:text-sm` on Input + Select
- BottomNav active state bug fix

**Day 2: Reorder + collapse**
- Reorder Treatments, Appointments, Profile with `order-*`
- Collapse master/detail in MessagesPanel + AssessmentsPanel
- Hide stats card on mobile in ClientsPanel: remove `hidden lg:grid`

**Day 3: Modal migration**
- Migrate ClientRecord's 5 hand-rolled modals to `<Modal>`
- Migrate InteractiveForm to `<Modal>`
- All become bottom-sheets with drag-dismiss

**Day 4: Calendar + heavy panels**
- Replace Calendar Week view with vertical agenda on mobile
- Convert Inbox rows to stacked cards
- Convert Money payment rows to stacked cards
- Fix MessagesPanel + AssessmentsPanel fixed-height panels behind BottomNav

**Day 5: Polish + intake**
- AssessmentPage DOB → `<input type="date">`
- AssessmentPage padding/sizing reductions
- AssessmentPage `100dvh` + safe-area
- Vertical TimelineStep on mobile
- Sticky save bar in Profile edit
- Test on real iPhone + Android device
- Commit, deploy, verify
