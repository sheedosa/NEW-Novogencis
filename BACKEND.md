# Novogenics — Backend Operations Guide

> This document is the single source of truth for the platform's Firebase
> backend: how data is shaped, how queries run, how to deploy, and what to
> watch when the clinic grows.

## At a glance

| Layer            | Implementation                                  |
| ---------------- | ----------------------------------------------- |
| Database         | Firestore (Native mode)                         |
| Authentication   | Firebase Auth (email/password)                  |
| File storage     | Firebase Storage (gallery + assessment photos)  |
| Hosting          | Firebase Hosting (`dist/` output from Vite)     |
| Security         | Firestore rules + Storage rules (in this repo)  |
| Audit trail      | Firestore `system_logs` collection (immutable)  |

The whole backend is defined by four files at the repo root:

- `firestore.rules`        — every collection's read/write authorisation
- `firestore.indexes.json` — composite indexes that make queries fast at scale
- `storage.rules`          — Storage paths + image validation
- `firebase.json`          — hosting headers, CSP, deploy targets

## Data model

| Collection      | Doc ID                  | Owner          | Notes                                                                      |
| --------------- | ----------------------- | -------------- | -------------------------------------------------------------------------- |
| `users`         | Firebase Auth UID       | self or admin  | `role`, `adminType`, `fullName`, `email`. Role escalation is rule-blocked. |
| `clients`       | matches `users` UID     | self or admin  | The clinical record. Status & treatmentPlan are admin-only-mutable.        |
| `appointments`  | autoId                  | admin          | Clients read their own; admin reads all. Clients cannot edit.              |
| `messages`      | autoId                  | sender + to    | Includes `type: 'form' \| 'payment'` cards in addition to plain chat.      |
| `notifications` | autoId                  | recipient      | Created from client code (validated by rules). Recipient-only mark-read.   |
| `tasks`         | autoId                  | admin only     | Internal to-do queue.                                                      |
| `templates`     | autoId                  | admin only     | Reusable copy (SOAP notes, aftercare emails).                              |
| `system_logs`   | autoId                  | admin only     | Immutable audit trail. Never updated or deleted.                           |

## How writes are authorised

Every collection has three rule layers:

1. **`isAuthenticated()`** — must be signed in
2. **Resource-level check** — usually `isOwner(uid)` or `isAdmin()`
3. **Field-level guard** — the most important layer

The field-level guard prevents privilege escalation and partial-write attacks:

```javascript
// Clients can update their own contact info but NOT their status,
// treatmentPlan, prescriptions, payments, or internalNotes.
allow update: if isAdmin() ||
              (isOwner(clientId) &&
               isValidClient(request.resource.data) &&
               request.resource.data.status == resource.data.status &&
               fieldsOnly([
                 'name', 'phone', 'address', 'dob', 'gender',
                 'doctorPreference', 'gallery', 'completedForms',
                 'policiesAccepted', 'assessmentData'
               ]));
```

This pattern is repeated for `messages` (recipients can only flip `read` /
form-signing fields) and `notifications` (recipients can only flip `read`).

## Composite indexes

Firestore needs an index for any query that combines `where()` with a
different `orderBy()` field, or that uses multiple `where()` on different
fields. The required indexes are all in `firestore.indexes.json`.

Highlights:

- `notifications` (`recipientRole` + `createdAt DESC`) — admin notif list
- `notifications` (`recipientId` + `createdAt DESC`) — client notif list
- `appointments` (`clientId` + `date ASC`) — patient appointment timeline
- `appointments` (`date` + `status`) — today's run sheet
- `appointments` (`doctorId` + `date`) — per-clinician calendar
- `messages` (`recipientId` + `read` + `createdAt DESC`) — inbox unread + sort
- `messages` (`type` + `isSigned` + `createdAt DESC`) — unsigned forms
- `clients` (`status` + `createdAt DESC`) — segment lookups
- `tasks` (`assigneeId` + `status` + `dueDate`) — my open tasks
- `system_logs` (`adminId` + `timestamp DESC`) — actor history
- `system_logs` (`targetId` + `timestamp DESC`) — patient chart history

**Adding a new query?** Run it in the app. If the console shows a
`failed-precondition: The query requires an index` error, the error
message has a one-click link to create it in Firebase Console. Then mirror
the new index into `firestore.indexes.json` so future deploys keep parity.

## Storage paths

| Path                                | Read                    | Write                                     |
| ----------------------------------- | ----------------------- | ----------------------------------------- |
| `gallery/{clientId}/{file}`         | admin or owner          | admin or owner (valid image only)         |
| `assessments/{clientId}/{file}`     | admin or owner          | admin / owner / auth'd intake `C-*` ID    |

Constraints on every write: ≤ 10MB, content type `image/(jpeg|png|webp)`.

## Deploying

The deploy scripts are wired up in `package.json`:

| Command                       | What it does                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `npm run deploy:rules`        | Push `firestore.rules` only — fast, no build needed         |
| `npm run deploy:indexes`      | Push `firestore.indexes.json` only — schedules new indexes  |
| `npm run deploy:storage`      | Push `storage.rules` only                                   |
| `npm run deploy:firestore`    | Both rules + indexes                                        |
| `npm run deploy:hosting`      | Build + push site                                           |
| `npm run deploy:all`          | Build + push everything (rules, indexes, storage, hosting)  |

**Prerequisites:** `firebase login` once on the deploying machine, and a
`firebase use <project-id>` target set (or pass `--project` per command).

**Index builds are async.** After `deploy:indexes`, Firebase Console shows
each index in "Building" for a few minutes (sometimes hours for large
collections). Queries against an in-progress index will work but slowly.

## Authorisation — current state vs. recommended evolution

**Today:** `isAdmin()` reads the user's document on every rule evaluation
(`get(/databases/$(database)/documents/users/$(uid))`). One Firestore read
per request that touches a protected collection.

**Recommended evolution:** promote `adminType` to a Firebase Auth custom
claim, set by a Cloud Function on admin bootstrap:

```javascript
// in a Cloud Function
await admin.auth().setCustomUserClaims(uid, { admin: true, adminType: 'doctor-female' });
```

Then rules read directly from `request.auth.token.admin`, no doc read,
quicker + cheaper. The current rules already check the custom claim first:

```javascript
return request.auth.token.admin == true || /* fallback to doc read */;
```

So when you ship the Cloud Function, no rule changes are needed.

## Scaling notes

| Concern                                | Where to watch / fix                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Admin loads all clients (limit 100)    | `App.tsx` Clients sync. Page when > 100, or filter at query time.               |
| Admin loads all appointments           | `App.tsx` Appointments sync. Add date-range filter once volume justifies.       |
| Admin loads all messages (limit 150)   | Already capped. Move to per-thread loading when threads exceed this.            |
| Notifications limited to 50            | Soft cap; older notifs simply don't show. Add a "load more" later.              |
| Tasks limited to 200                   | Plenty for one clinic.                                                          |
| Storage cost on photo galleries        | 10MB cap per image. Add a Cloud Function to downscale on upload (~200KB out).   |
| Audit logs grow forever                | Add a scheduled Function to archive `system_logs` older than 365 days.          |

## Backup strategy

1. **Enable Point-in-Time Recovery (PITR)** on Firestore via Console.
   Free for 7-day history, paid for 35-day.
2. **Weekly scheduled exports** to a Cloud Storage bucket. Configurable via
   the gcloud CLI:
   ```
   gcloud firestore export gs://novogenics-backups/$(date +%Y-%m-%d)
   ```
3. **Keep `firestore.rules`, `firestore.indexes.json`, `storage.rules`,
   `firebase.json` in git.** They are the deployable definition of the
   backend's behaviour.
4. **Audit logs** in `system_logs` are immutable and append-only — they
   are themselves a partial backup of "what happened."

## Cloud Functions — proposed next steps (not yet implemented)

| Function                       | Trigger                | Purpose                                      |
| ------------------------------ | ---------------------- | -------------------------------------------- |
| `setAdminClaims`               | Firestore user write   | Mirror `role`/`adminType` to Auth claims     |
| `imageOptimisation`            | Storage finalize       | Resize gallery photos to ≤ 1600px            |
| `dailyBriefingScheduler`       | Cron 07:00 daily       | Insert "Today's clinical briefing" notif     |
| `appointmentReminderScheduler` | Cron hourly            | 24h-before reminder messages to patients     |
| `archiveOldAuditLogs`          | Cron monthly           | Move `system_logs` > 365d to Cloud Storage   |
| `sendTransactionalEmail`       | Notification create    | EmailJS replacement for production SMTP      |

When the Functions runtime is set up, mirror the source under
`functions/src/` and add them to `firebase.json` `"functions"`.

## Smoke tests after a deploy

After `npm run deploy:firestore`, do these in the live app:

1. As an admin, open the **Inbox** — should load instantly (the
   `recipientRole + createdAt` index is doing its job).
2. As a patient, open the **Activity** tab in your record — should load
   the message thread instantly (the `senderId + createdAt` index).
3. As tech admin, go to Platform Health → **Seed test patient**. Should
   succeed without permission errors (proves the new collections rules
   are live).
4. Create a task in **Inbox** → confirm it persists across reload.
5. Send a test message from the patient portal → confirm the unread
   badge increments on the admin sidebar within a second or two.

If any of these fail with "Missing or insufficient permissions" or
"failed-precondition", check the Firebase Console → Firestore → Rules
(or Indexes) tab to see what hasn't propagated yet.
