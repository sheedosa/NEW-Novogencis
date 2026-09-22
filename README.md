# Novogenics Hair Restoration

React/Vite application for Novogenics Hair Restoration — marketing site, patient
portal and clinical admin panel, backed by Firebase.

## Local development

```bash
npm install
npm run dev        # dev server on :3000
npm run build      # production build into dist/
npm run type-check
npm run lint
```

## Deployment

The site deploys to **GitHub Pages** at [novogenics.co.uk](https://novogenics.co.uk)
automatically on every push to `main`, via
`.github/workflows/deploy-pages.yml`. No secrets or environment variables are
needed — the Firebase client config lives in `firebase-applet-config.json`.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the GitHub Pages setup, the DNS
records for the custom domain, and the security-header trade-offs that come with
static hosting.

The Firebase backend (Firestore, Auth, Storage and the Cloud Functions in
`functions/`) deploys separately:

```bash
npm run deploy:rules
npm run deploy:indexes
npm run deploy:all
```
