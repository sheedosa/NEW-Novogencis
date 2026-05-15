# Cloud Functions runbook

The `functions/` package houses all server-side logic. Everything is
pinned to `europe-west2` (London) to keep patient data in the UK/EEA.

## What's deployed

| Function | Trigger | Purpose |
|---|---|---|
| `onPatientErased` | Firestore: `users/{uid}` update where `erasedAt` flips from unset to set | Hard-deletes the Firebase Auth account so the user can never sign in again. Records the action in `system_logs`. |
| `cleanIntakeUploads` | Scheduler: `0 2 * * *` Europe/London | Removes `temp/` Cloud Storage objects older than 24 hours so abandoned-intake uploads do not accumulate. |
| `mirrorAuditLog` | Firestore: writes to `clients`, `appointments`, `messages` | Independent server-side audit mirror. Guarantees a `system_logs` entry exists even if a client skipped its own `logClinicalAction` call. Attributed to `"system"` (Firestore v2 triggers do not surface the originating uid). |
| `createStripeCheckoutSession` | HTTPS callable | Admin-only. Creates a Stripe Checkout Session with a server-signed amount (£10k cap) so payment messages no longer rely on a static `buy.stripe.com` link. |

## First-time setup

1. Install the Firebase CLI globally: `npm i -g firebase-tools`.
2. From the repo root: `firebase use --add` and pick the clinic's project.
3. Install dependencies: `(cd functions && npm install)`.
4. Configure the Stripe secret (live key, store it in Secret Manager,
   never the repo):
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
5. Deploy: `firebase deploy --only functions`.

## Local emulation

```bash
cd functions
npm run serve
```

The emulator suite picks up `functions/lib/index.js`, so make sure
`npm run build` has been run (the `serve` script does this for you).

## Operational notes

- **Logs**: `firebase functions:log --only <name>` or the Cloud Logging
  console. Mirror entries appear as actor `"system"` in `system_logs`.
- **Rolling back**: redeploy a previous git ref. Functions are stateless;
  the only side effects are Firestore writes and Auth deletions, which
  are already idempotent (`erasedAt` is the trigger condition, not a
  payload).
- **Secrets rotation**: `firebase functions:secrets:set STRIPE_SECRET_KEY`
  then redeploy `createStripeCheckoutSession`. Older versions stop
  reading the secret immediately.
- **Costs**: all four functions are well within the Spark plan free
  tier for a single-clinic load. The scheduler and audit mirror run
  on every write, so monitor `firestore.googleapis.com/document.write`
  for unexpected spikes.

## Updating

After editing anything under `functions/src/`:

```bash
cd functions
npm run build      # type-check + emit lib/
firebase deploy --only functions
```

CI builds the functions on every PR (`.github/workflows/ci.yml`) so
type regressions are caught before merge.
