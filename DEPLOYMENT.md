# Deployment — GitHub Pages

The site is a static Vite/React SPA. GitHub Actions builds it on every push to
`main` and publishes `dist/` to GitHub Pages, served at **novogenics.co.uk**.

Nothing about the backend changes: Firestore, Auth, Storage and all eight Cloud
Functions (Stripe checkout/webhook/refunds, Resend email automations, contact
form) continue to run on Firebase in `europe-west2`. Stripe's webhook points at
a Cloud Function URL, not at this domain.

| | |
|---|---|
| Workflow | `.github/workflows/deploy-pages.yml` |
| Build output | `dist/` |
| Custom domain | `public/CNAME` → shipped as `dist/CNAME` on every build |
| Secrets required | none — the Firebase client config is committed in `firebase-applet-config.json`, which is correct for a browser bundle |

## One-time GitHub setup

1. **Plan.** Pages on a *private* repository requires GitHub Pro or Team. This
   repo is private, so publishing will fail until the account is upgraded (or
   the repo is made public, which would expose admin logic and Firestore rules
   — not recommended).
2. **Settings → Pages → Build and deployment → Source:** `GitHub Actions`.
3. **Settings → Pages → Custom domain:** `novogenics.co.uk`.
4. Wait for GitHub to validate DNS and issue the TLS certificate, then tick
   **Enforce HTTPS**.

## DNS records

Set these on whoever hosts DNS for `novogenics.co.uk` (currently Hostinger).

**Remove** the existing `A` / `AAAA` / `CNAME` records that point the apex and
`www` at Hostinger.

**Add** — apex to GitHub's Pages anycast addresses:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| AAAA | `@` | `2606:50c0:8000::153` | 3600 |
| AAAA | `@` | `2606:50c0:8001::153` | 3600 |
| AAAA | `@` | `2606:50c0:8002::153` | 3600 |
| AAAA | `@` | `2606:50c0:8003::153` | 3600 |
| CNAME | `www` | `sheedosa.github.io.` | 3600 |

The four `A` records are what actually serve the site; the `AAAA` records only add IPv6 reachability and can be skipped if your DNS panel makes them awkward. Confirm the current values against
<https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
before entering them — GitHub has changed these addresses before.

> **Leave every other record alone.** The `MX`, `TXT` (SPF) and DKIM records for
> `novogenics.co.uk` are what keep Resend's sending domain verified. Delete them
> and all patient email — consent forms, appointment reminders, aftercare,
> contact-form notifications — stops silently.

Verify before and after with `dig novogenics.co.uk +short` and
`dig www.novogenics.co.uk +short`.

Certificate issuance takes anywhere from ~15 minutes to 24 hours after DNS
propagates. The site is unreachable over HTTPS during that window, so make the
switch at a quiet time.

## Routing

The app routes on the URL hash (`#assessment`, `#admin` — see `handleHashChange`
in `App.tsx`), which is why GitHub Pages' lack of SPA rewrites is not a problem.

`public/404.html` covers the gap: `sitemap.xml` advertises clean paths
(`/about`, `/treatments`, …) and GitHub Pages serves `404.html` for any path it
cannot match, so that file maps a known path onto its hash route and redirects.
Its `KNOWN_PAGES` list must stay in sync with the `Page` enum in `types.ts`.

## Security headers — known gap

`firebase.json` declares a full header set, but **GitHub Pages serves a fixed
set of response headers and provides no way to add custom ones.** What survives
is carried in `index.html` as meta tags.

| Header | On GitHub Pages |
|---|---|
| `Content-Security-Policy` | ✅ meta tag (`frame-ancestors` is ignored in meta) |
| `Referrer-Policy` | ✅ meta tag |
| `Strict-Transport-Security` | ✅ supplied by Pages' *Enforce HTTPS* |
| `X-Frame-Options` | ❌ lost — clickjacking protection is weakened |
| `X-Content-Type-Options` | ❌ lost |
| `Permissions-Policy` | ❌ lost — camera/payment gating |
| `Cross-Origin-Opener-Policy` | ❌ lost |
| Cache-Control tuning | ❌ lost — Pages sets its own (~10 min) |

For a platform holding patient records this is a real regression. `firebase.json`
still carries the complete policy, so `npm run deploy:hosting` restores all of
it if you later move to Firebase Hosting.

**Smoke-test after the first deploy**, since the site previously ran with no CSP
at all and a blocked request fails silently: sign in, load the admin dashboard,
upload a gallery photo, and run one Stripe checkout end to end. Anything blocked
shows up in the browser console as a CSP violation, and the policy lives in one
`<meta>` tag in `index.html` if it needs widening.

## Rollback

The previous host is untouched until you repoint DNS, so rollback is just
restoring the old Hostinger `A` record. Beyond that, `firebase.json` is intact
and `npm run deploy:hosting` publishes the same `dist/` to Firebase Hosting.
