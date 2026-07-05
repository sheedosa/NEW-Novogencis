# Novogenics Platform Audit — July 2026

**Scope:** full platform — public website, patient portal, doctor (admin) system, payments, security, deployment.
**Method:** 3 exploration passes → adversarial verification (11 independent verifier agents, each instructed to *disprove* findings) → 6 fix streams, each verified and committed separately.
**Branch:** `audit-userflows-fixes` · commits `98720f7 … 38a0bfa`.

---

## Part 1 — For the clinic (plain English)

### What was broken and is now fixed

1. **A patient who paid was dropped on the homepage.** After paying a deposit through the secure payment link, Stripe sent the patient back to the site — but the site didn't recognise the return address and showed the *marketing homepage* with no acknowledgement. Patients had no idea whether their payment worked. **Fixed:** they now land in their portal with a clear "Payment received — thank you" message (and a friendly message if they cancelled).

2. **The website contact form did nothing.** The "Send us a message" form on the Contact page had no working submit — every enquiry typed into it was silently lost. **Fixed:** it now emails the clinic inbox, shows a confirmation, and if sending ever fails the visitor sees your phone number and email instead of nothing. *(One activation step needed — see "What we need from you".)*

3. **A signup hiccup could strand a new patient.** If the database write failed halfway through account creation, the patient ended up with an account that had no records — and retrying said "email already in use". **Fixed:** failures now roll back cleanly or preserve the assessment so signing in finishes the job automatically.

4. **Silent failures in the doctors' admin.** Eleven places (marking payments paid, saving treatment phases, adding prescriptions/payments, replying from the Inbox, deleting appointments, saving session notes…) showed nothing if a save failed — the screen looked fine while the change was never saved, and some buttons could get stuck on "Saving…" forever. **Fixed:** every one now shows a clear error message, keeps your typed content for retry, and buttons disable while saving so double-clicks can't double-charge or double-write.

5. **Marking a deposit paid now confirms the booking automatically.** Previously the appointment stayed on "Awaiting deposit" until someone remembered a second manual step.

6. **All website images and app icons were hosted on Google Drive links.** If any Drive file was moved or its sharing changed, doctor portraits, the logo, the blog images — even the app icon — would vanish from the live site. **Fixed:** all 23 references now use images stored inside the website itself.

7. **New patients now get an email-verification note.** A typo'd email address used to mean the patient silently never received anything from the clinic. Signup now sends a verification email and the portal shows a gentle reminder banner (it never blocks them).

8. Smaller fixes: payment links now say they're valid for 24 hours (they always were — patients just weren't told); photo galleries work with keyboard/screen readers; logging out fully clears preview-mode and any temporarily-stored assessment data on shared computers.

### What we checked and found already healthy
Database security rules (patients can only see their own data; payment/clinical data is server-controlled; no role self-promotion), database indexes, hosting security headers (HSTS/CSP), secrets handling, error boundaries, audit logging of clinical actions, and the patient portal's defensive coding (a claimed "crash risk" list was checked line-by-line and found already fully guarded).

### ⚠️ What we need from you (nobody else can do these)

1. **Stripe go-live (your decision — currently on hold as agreed).** The payment system's webhook — the part that automatically marks payments as paid — **has never received a single event from Stripe**, and the deployed payment code is an older version (no Apple/Google Pay, no saved cards, and a known partial-refund display bug). Until the doctor meeting settles this, the manual "Mark paid" button (now hardened) is the working path. The full go-live checklist is in Part 2.

2. **Email sending keys.** The live website was built without its email-service keys, so **every email the platform tries to send from the browser (welcome emails, "new message" alerts, payment-link emails, and the new contact form) currently does nothing**. In-app notifications still work, and the server-sent emails (consent forms, appointment reminders, aftercare) are a separate system and unaffected. To activate: create the EmailJS templates/keys and add them to the build environment, then rebuild + deploy. Until then, the contact form shows visitors your phone/email as a fallback rather than failing silently.

3. **PRF in the booking system.** Still waiting on the `service-account.json` key file (Firebase Console → Project Settings → Service Accounts → Generate key → save to the project folder) so the four PRF treatments can be seeded into the booking dropdown. The PRF content on the website is already live.

4. **novogenics.co.uk updates** still require the manual **Deploy** in Hostinger hPanel after GitHub `main` is updated — a git push alone doesn't change the custom domain.

### Decisions awaiting you (no action taken; happy to advise)
- **"Payment plans available via Klarna"** appears on the site, but there is no Klarna integration in the platform. If Klarna is arranged off-platform, no change needed; if not, the claim should come off the site.
- **Error monitoring** (e.g. Sentry): recommended for a live medical platform, but it's a new vendor with data-processing implications — your call.
- **Patient list limit:** the admin currently live-loads the most recent 100 patients. Fine today; needs pagination as the clinic grows.
- Timezone-edge date handling (a UK 00:00–01:00 BST quirk), revenue-forecast prices, and blog/pricing content being code-managed — all catalogued in Part 2 as backlog.

---

## Part 2 — Technical appendix

### Adversarial verification verdicts

| # | Claim | Verdict | Key evidence |
|---|-------|---------|--------------|
| V1 | Stripe deploy stale / secret unset / webhook unregistered | **PARTIAL** | Deployed functions dated 2026-06-29 10:23 UTC, commit `2f6a1d7` (saved cards, wallets, partial-refund fix) landed 12:15 UTC — **deployed code is pre-fix**. `STRIPE_WEBHOOK_SECRET` **exists** (v1 ENABLED, bound). Webhook function log shows **zero HTTP invocations ever** — consistent with unregistered endpoint (dashboard check = owner). |
| V2 | EmailJS keys unset → client emails no-op | **PARTIAL (core confirmed)** | Vite statically compiled the unset `VITE_EMAILJS_*` vars → the guard became unconditionally true → **the entire @emailjs/browser library was dead-code-eliminated from dist**. All 8 client-triggered email types no-op. MailerLite Cloud-Function emails (consent/reminders/aftercare) are a separate pipeline, unaffected. |
| V3 | Orphaned assessment photo blobs | **PARTIAL** | Abandoned-flow blobs under anonymous UIDs are orphaned forever (no cleanup, no linkWithCredential). **But completed-flow photos stay referenced by the client doc — a naive age-based lifecycle rule would delete live patient photos.** Safe fix = referenced-URL-aware scheduled cleanup (gated functions work). |
| V4 | Payments stuck 'Pending' forever if webhook fails | **PARTIAL** | No automated reconciliation, and 'Awaiting deposit'→'Confirmed' lived only in the webhook. Manual "Mark paid" exists and overdue Pending payments surface prominently. **Fixed in Stream D:** manual mark-paid now mirrors the webhook's appointment advance. Optional "check with Stripe" callable catalogued for the gated stream. |
| V5 | Signature can exceed 200KB rule cap | **Mostly refuted** | Canvas is fixed 800×160; worst drawable signature ≈ 44KB, 4.5× under the cap; failure UX already exists. Noted asymmetry: `completedForms` on the client doc has no size cap (slow-burn toward the 1MB doc limit) — backlog. |
| V6 | Social crawlers see homepage OG for all pages | **CONFIRMED (architectural)** | No prerender; hash routing structurally hides routes from servers. Static OG fallback is good quality; its image was Drive-hosted → fixed in Stream E (self-hosted absolute URL). Per-page OG = path routing + prerender; catalogued, not worth it now. |
| V7 | sessionStorage health-data exposure | **PARTIAL** | Mechanics exactly as claimed but risk overstated: failure-path-only, tab-scoped, 30-min TTL. Hardened in Stream F (corrupt stash discarded, missing timestamp = expired, cleared on logout). Owner: record in ROPA. |
| V8 | Name denormalisation + timezone-naive dates | **PARTIAL** | Name drift real for appointments/tasks only (display-only harm; payments/messages join live). Timezone: ~31 `toISOString().split('T')[0]` sites misdate 00:00–01:00 BST; the three Firestore *write* sites are the ones that matter — paidDate writes fixed in Stream D via `localTodayISO()`; full sweep = backlog. |
| V9 | @anthropic-ai/sdk unused in functions | **CONFIRMED** | Zero imports (comment only). Removal + stale `functions/lib` clean = gated functions stream. Owner may also destroy the old `ANTHROPIC_API_KEY` secret. |
| S1 | Bare-await admin mutations sweep | **CONFIRMED — 11 sites** | All fixed in Stream D (list in commit `8582323`). TodayPanel clean; 6 previously-protected sites confirmed protected. |
| S2 | ClientDashboard null-guard sweep | **REFUTED** | Line-by-line audit of all 2,035 lines: every access defended; pre-plan/pre-assessment data states render fallbacks, not crashes. **Do not re-flag.** |

**Also refuted during design (do not re-flag):** patient message send "silent loss" (has catch+toast+draft-preserve); `replySending` stuck (try/finally); `nextAppointment.time` crash (guarded); createRefund frontend double-click (**no frontend caller exists**); Patients-page layout "unimplemented" (shipped in `13324b5`).

### Fix-stream commits

| Stream | Commit | Contents |
|--------|--------|----------|
| A | `98720f7` | Hash router parses query params; payment success/cancel toasts; replaceState cleanup |
| B | `43b0e62` | Auth-orphan rollback; clients-write retry + stash-recovery path; email-already-in-use copy; logout clears preview flag; soft email verification + portal banner |
| C | `56fd7a9` | `sendContactFormEmail` (non-silent) + fully working contact form with honeypot and visible fallback |
| D | `8582323` | 11 mutation sites hardened (toasts, busy guards, stuck-"Saving…" fixes); deposit mark-paid auto-advances appointment; `localTodayISO()` |
| E | `807a3b6` | 23 Drive references → self-hosted `/public/icons` + `/public/images`; og/JSON-LD absolute URLs; preconnect removed |
| F | `38a0bfa` | 24h payment-link copy; keyboard-accessible gallery; pendingAssessment stash hardening |

**Verification:** `tsc --noEmit` + `vite build` clean after every stream. Preview-verified: payment success/cancel redirects (single toast, params stripped, plain/unknown hashes unaffected), contact-form failure fallback with draft preserved, all 7 public pages render with zero broken/external images, About-page portraits + header logo confirmed visually. Note: a headless-preview artifact (hidden tab → no rAF → framer-motion exit animations paused) makes toasts persist in automated checks; verified not a product issue.

**Live-only tests still outstanding (cannot run from preview):** real Stripe checkout round-trip incl. webhook write (WS5 — gated with go-live), EmailJS delivery to the clinic inbox (needs keys), PWA install on a physical phone.

### Stripe go-live checklist (gated — run after the doctor meeting)
1. Stripe Dashboard → Developers → Webhooks → add endpoint `https://europe-west2-gen-lang-client-0344977334.cloudfunctions.net/stripeWebhook` with events `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`.
2. Copy the endpoint's `whsec_` signing secret; confirm it matches the stored secret (`firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` to rotate if not).
3. Deploy current code: `cd functions && npm run build` (consider `rm -rf lib` first to purge stale AI files) then `firebase deploy --only functions` — this ships wallets, saved cards, and the partial-refund fix. Optionally `npm uninstall @anthropic-ai/sdk` first (V9).
4. `firebase deploy --only firestore:rules` if any rules changed by then (e.g. `contactSubmissions`).
5. Run WS5: full test-mode payment → webhook marks Paid → appointment auto-confirms → partial + full refund round-trip.
6. Settle the saved-card consent wording (checkout stores cards via `setup_future_usage: off_session`).

### Backlog (catalogued, deliberately not done)
Scheduled referenced-URL-aware cleanup for abandoned assessment blobs (LC2) · admin-callable "check with Stripe" reconciliation · full `localTodayISO` sweep (~28 remaining display sites) · appointment clientName render-time join or rename fan-out · `completedForms` size cap · pagination for clients/messages listeners · per-page OG (needs path routing + prerender) · Sentry/monitoring decision · move pricing/blog content to Firestore · migrate client-triggered emails to the MailerLite function pipeline (removes browser email keys entirely) · #97–99 UI backlog · Stripe-B2 charge-saved-card (post consent decision).
