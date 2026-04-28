# Novogenics Hair Restoration

This is a React/Vite application for Novogenics Hair Restoration.

## Deployment on Hostinger

1. Connect your GitHub repository to Hostinger via the **Git** section in hPanel.
2. Set the **Deployment Directory** to `public_html`.
3. Use the following **Post-deployment command**:

```bash
export PATH=$PATH:/usr/local/bin
npm install
npm run build
cp -r dist/* .
cp dist/.htaccess .
```

4. Ensure you do **NOT** add any environment variables in the Hostinger dashboard, as the application uses `firebase-config.json` for its configuration.
